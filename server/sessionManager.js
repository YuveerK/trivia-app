import { randomBytes, randomInt, randomUUID } from 'crypto';
import { allPlayersAnswered, calculateScore, validateQuestionPack } from './gameLogic.js';
import { defaultQuestions } from './defaultQuestions.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SESSION_MAX_AGE_MS = 4 * 60 * 60 * 1000;
const PLAYER_GRACE_MS = 30_000;
const HOST_ABSENT_MS = 60_000;

/** @typedef {'lobby' | 'question' | 'results' | 'final'} Phase */

/** @param {Record<string, unknown>} session */
export function serializeSession(session) {
  const {
    roundTimer: _rt,
    hostAbsentTimer: _hat,
    playerGraceTimers: _pgt,
    hostSocketId: _hsi,
    hostReconnectToken: _hrt,
    ...rest
  } = session;
  return JSON.parse(
    JSON.stringify({
      ...rest,
      players: session.players.map((player) => serializePlayer(session, player)),
      questions: serializeQuestions(session),
    }),
  );
}

function generateCode() {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[randomInt(0, CODE_CHARS.length)];
  }
  return code;
}

function generateReconnectToken() {
  return randomBytes(32).toString('base64url');
}

function createPlayer(name, socketId, id = randomUUID(), reconnectToken = generateReconnectToken()) {
  return {
    id,
    socketId,
    reconnectToken,
    name: String(name).trim(),
    score: 0,
    answers: {},
    connected: true,
  };
}

function shuffleQuestionOptions(question) {
  const options = question.options.map((option, index) => ({
    option,
    originalIndex: index,
  }));

  for (let i = options.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }

  return {
    ...question,
    options: options.map((entry) => entry.option),
    correct: options.findIndex((entry) => entry.originalIndex === question.correct),
  };
}

function prepareQuestions(questions) {
  return questions.map((question) => shuffleQuestionOptions(question));
}

function canRevealQuestion(session, index) {
  if (session.phase === 'final') return true;
  if (index < session.currentRound) return true;
  return session.phase === 'results' && index === session.currentRound;
}

function serializeQuestions(session) {
  return session.questions.map((question, index) => {
    const showBody = index <= session.currentRound || session.phase === 'final';
    const out = showBody
      ? { q: question.q, options: question.options }
      : { q: '', options: [] };

    if (canRevealQuestion(session, index)) {
      out.correct = question.correct;
    }

    return out;
  });
}

function serializeAnswers(session, answers) {
  return Object.fromEntries(
    Object.entries(answers).map(([round, answer]) => {
      const roundIndex = Number(round);
      if (canRevealQuestion(session, roundIndex)) return [round, answer];
      return [round, { submitted: true }];
    }),
  );
}

function serializePlayer(session, player) {
  return {
    id: player.id,
    name: player.name,
    score: player.score,
    answers: serializeAnswers(session, player.answers),
    connected: player.connected,
  };
}

export class SessionManager {
  constructor() {
    /** @type {Map<string, any>} */
    this.sessions = new Map();
    /** @type {((code: string, out: { ended?: boolean, reason?: string, session?: any }) => void) | null} */
    this.onAfterPlayerChange = null;
    this.cleanupInterval = setInterval(() => this.pruneOldSessions(), 10 * 60 * 1000);
  }

  getActiveCount() {
    return this.sessions.size;
  }

  pruneOldSessions() {
    const now = Date.now();
    for (const [code, session] of this.sessions) {
      if (now - session.createdAt > SESSION_MAX_AGE_MS) {
        this.cleanupSession(code, 'Session expired.');
      }
    }
  }

  /**
   * @param {string} hostName
   * @param {string} hostSocketId
   * @param {unknown} questionsInput
   * @param {boolean} hostParticipates
   */
  createSession(hostName, hostSocketId, questionsInput, hostParticipates = true) {
    let questions = defaultQuestions;
    if (questionsInput != null && questionsInput !== '') {
      let parsed = questionsInput;
      if (typeof questionsInput === 'string') {
        try {
          parsed = JSON.parse(questionsInput);
        } catch {
          return { ok: false, error: 'Invalid JSON for custom questions.' };
        }
      }
      const v = validateQuestionPack(parsed);
      if (!v.valid) return { ok: false, error: v.error };
      questions = prepareQuestions(parsed);
    } else {
      const v = validateQuestionPack(defaultQuestions);
      if (!v.valid) return { ok: false, error: v.error };
      questions = prepareQuestions(defaultQuestions);
    }

    let code = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateCode();
      if (!this.sessions.has(code)) break;
      if (attempt === 4) {
        return { ok: false, error: 'Could not generate a unique session code. Try again.' };
      }
    }

    const hostId = randomUUID();
    const hostReconnectToken = generateReconnectToken();

    /** @type {any} */
    const session = {
      code,
      hostId,
      hostSocketId,
      hostReconnectToken,
      hostName: String(hostName).trim(),
      hostParticipates,
      players: hostParticipates
        ? [createPlayer(hostName, hostSocketId, hostId, hostReconnectToken)]
        : [],
      questions,
      currentRound: -1,
      phase: /** @type {Phase} */ ('lobby'),
      roundStart: null,
      roundDuration: 20,
      createdAt: Date.now(),
      roundTimer: null,
      hostDisconnected: false,
      pausedRemainingMs: null,
      hostAbsentTimer: null,
      playerGraceTimers: /** @type {Map<string, NodeJS.Timeout>} */ (new Map()),
    };

    this.sessions.set(code, session);
    return { ok: true, session };
  }

  /** @param {string} code */
  getSession(code) {
    if (!code) return null;
    return this.sessions.get(String(code).toUpperCase()) ?? null;
  }

  /**
   * @param {string} code
   * @param {string} socketId
   * @param {string} name
   */
  addPlayer(code, socketId, name) {
    const session = this.getSession(code);
    if (!session) return { ok: false, error: 'Session not found.' };
    if (session.phase !== 'lobby') {
      return { ok: false, error: 'This game has already started.' };
    }
    const trimmed = String(name).trim();
    if (!trimmed) return { ok: false, error: 'Name is required.' };
    const lower = trimmed.toLowerCase();
    if (session.players.some((p) => p.name.toLowerCase() === lower)) {
      return { ok: false, error: 'That name is already taken in this session.' };
    }
    const player = createPlayer(trimmed, socketId);
    session.players.push(player);
    return { ok: true, session, player };
  }

  /**
   * @param {string} code
   * @param {string} socketId
   * @returns {{ ended?: boolean, reason?: string, session?: any }}
   */
  removePlayer(code, socketId) {
    const session = this.getSession(code);
    if (!session) return {};
    const isHostSocket = session.hostSocketId === socketId;

    if (isHostSocket && !session.players.some((p) => p.socketId === socketId)) {
      this.cleanupSession(code, 'The host left the session.');
      return { ended: true, reason: 'The host left the session.' };
    }

    const idx = session.players.findIndex((p) => p.socketId === socketId);
    if (idx === -1) return { session };

    const [removedPlayer] = session.players.splice(idx, 1);
    this.clearPlayerGraceTimer(session, removedPlayer.id);

    if (session.players.length === 0) {
      this.cleanupSession(code);
      return { ended: true, reason: 'Everyone left the session.' };
    }

    if (isHostSocket) {
      const next = session.players.find((p) => p.connected) ?? session.players[0];
      session.hostId = next.id;
      session.hostSocketId = next.socketId;
      session.hostReconnectToken = next.reconnectToken;
      session.hostName = next.name;
      session.hostParticipates = true;
      session.hostDisconnected = false;
      session.pausedRemainingMs = null;
      if (session.hostAbsentTimer) {
        clearTimeout(session.hostAbsentTimer);
        session.hostAbsentTimer = null;
      }
    }

    return { session };
  }

  /** @param {any} session @param {string} playerId */
  clearPlayerGraceTimer(session, playerId) {
    const t = session.playerGraceTimers.get(playerId);
    if (t) clearTimeout(t);
    session.playerGraceTimers.delete(playerId);
  }

  /**
   * @param {string} code
   * @param {string} reason
   */
  cleanupSession(code, reason = 'Session ended.') {
    const session = this.getSession(code);
    if (!session) return;
    if (session.roundTimer) clearTimeout(session.roundTimer);
    if (session.hostAbsentTimer) clearTimeout(session.hostAbsentTimer);
    for (const t of session.playerGraceTimers.values()) clearTimeout(t);
    session.playerGraceTimers.clear();
    this.sessions.delete(code);
    return { reason };
  }

  /** @param {string} code */
  getStandings(code) {
    const session = this.getSession(code);
    if (!session) return [];
    return [...session.players].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * @param {string} socketId
   * @param {(code: string, payload: { reason: string }) => void} onHostAbsentEnd
   */
  markDisconnected(socketId, onHostAbsentEnd) {
    for (const [code, session] of this.sessions) {
      const player = session.players.find((p) => p.socketId === socketId);
      const isHostSocket = session.hostSocketId === socketId;
      if (!player && !isHostSocket) continue;

      if (player) {
        player.connected = false;
        this.clearPlayerGraceTimer(session, player.id);

        const grace = setTimeout(() => {
          session.playerGraceTimers.delete(player.id);
          if (session.phase === 'lobby') {
            const out = this.removePlayer(code, socketId);
            if (this.onAfterPlayerChange) this.onAfterPlayerChange(code, out);
          }
        }, PLAYER_GRACE_MS);
        session.playerGraceTimers.set(player.id, grace);
      }

      if (isHostSocket) {
        session.hostDisconnected = true;
        if (session.phase === 'question' && session.roundStart != null) {
          const elapsed = Date.now() - session.roundStart;
          const total = session.roundDuration * 1000;
          session.pausedRemainingMs = Math.max(0, total - elapsed);
          if (session.roundTimer) {
            clearTimeout(session.roundTimer);
            session.roundTimer = null;
          }
        }
        if (session.hostAbsentTimer) clearTimeout(session.hostAbsentTimer);
        session.hostAbsentTimer = setTimeout(() => {
          session.hostAbsentTimer = null;
          if (session.hostDisconnected) {
            onHostAbsentEnd(code, { reason: 'Host did not reconnect. Session ended.' });
          }
        }, HOST_ABSENT_MS);
      }

      return { code, session };
    }
    return null;
  }

  /**
   * @param {string} code
   * @param {string} playerId
   * @param {string} reconnectToken
   * @param {string} newSocketId
   * @param {(session: any) => void} [onResumeRound]
   */
  markReconnected(code, playerId, reconnectToken, newSocketId, onResumeRound) {
    const session = this.getSession(code);
    if (!session) return { ok: false, error: 'Session not found.' };
    const player = session.players.find((p) => p.id === playerId);
    const isHost = session.hostId === playerId;
    if (!player && !isHost) return { ok: false, error: 'Player not found in session.' };

    const playerTokenOk = player?.reconnectToken === reconnectToken;
    const hostTokenOk = isHost && session.hostReconnectToken === reconnectToken;
    if (!playerTokenOk && !hostTokenOk) {
      return { ok: false, error: 'Invalid reconnect credentials.' };
    }

    if (player) this.clearPlayerGraceTimer(session, player.id);

    if (player) {
      player.socketId = newSocketId;
      player.connected = true;
    }

    if (isHost) {
      session.hostSocketId = newSocketId;
      session.hostDisconnected = false;
      if (session.hostAbsentTimer) {
        clearTimeout(session.hostAbsentTimer);
        session.hostAbsentTimer = null;
      }
      if (session.phase === 'question' && session.pausedRemainingMs != null) {
        const remaining = session.pausedRemainingMs;
        session.pausedRemainingMs = null;
        session.roundStart = Date.now() - (session.roundDuration * 1000 - remaining);
        if (onResumeRound) onResumeRound(session);
      }
    }

    return { ok: true, session };
  }

  /**
   * @param {any} session
   * @param {() => void} onTimeoutToResults
   */
  startRoundTimer(session, onTimeoutToResults) {
    if (session.roundTimer) clearTimeout(session.roundTimer);
    const ms = session.roundDuration * 1000;
    session.roundTimer = setTimeout(() => {
      session.roundTimer = null;
      if (session.phase === 'question') onTimeoutToResults();
    }, ms);
  }

  /**
   * Resume timer after host reconnect (remaining portion only).
   * @param {any} session
   * @param {() => void} onTimeoutToResults
   */
  resumeRoundTimer(session, onTimeoutToResults) {
    if (session.roundTimer) clearTimeout(session.roundTimer);
    const remaining = Math.max(
      0,
      session.roundDuration * 1000 - (Date.now() - (session.roundStart ?? Date.now())),
    );
    session.roundTimer = setTimeout(() => {
      session.roundTimer = null;
      if (session.phase === 'question') onTimeoutToResults();
    }, remaining);
  }

  clearRoundTimer(session) {
    if (session.roundTimer) {
      clearTimeout(session.roundTimer);
      session.roundTimer = null;
    }
  }

  /**
   * @param {any} session
   * @param {string} socketId
   * @param {number} roundIndex
   * @param {number} optionIndex
   */
  recordAnswer(session, socketId, roundIndex, optionIndex) {
    if (session.phase !== 'question') {
      return { ok: false, error: 'Not accepting answers right now.' };
    }
    if (roundIndex !== session.currentRound) {
      return { ok: false, error: 'Wrong round.' };
    }
    const player = session.players.find((p) => p.socketId === socketId);
    if (!player) return { ok: false, error: 'Player not in session.' };
    if (player.answers[roundIndex]) {
      return { ok: false, error: 'You already answered this round.' };
    }

    const q = session.questions[roundIndex];
    if (!q) return { ok: false, error: 'Invalid round.' };

    const now = Date.now();
    if (session.roundStart == null) {
      return { ok: false, error: 'Round not active.' };
    }

    const elapsedSec = (now - session.roundStart) / 1000;
    if (elapsedSec >= session.roundDuration) {
      return { ok: false, error: 'Time is up for this question.' };
    }

    const timeLeftSec = Math.max(0, session.roundDuration - elapsedSec);
    const correct = optionIndex === q.correct;
    const points = correct ? calculateScore(timeLeftSec, session.roundDuration) : 0;

    player.answers[roundIndex] = {
      idx: optionIndex,
      correct,
      points,
      time: elapsedSec,
    };
    if (correct) player.score += points;

    return { ok: true, correct, points, timeLeft: timeLeftSec };
  }

  transitionToResults(session) {
    this.clearRoundTimer(session);
    session.phase = 'results';
    session.roundStart = null;
    session.pausedRemainingMs = null;
  }

  /**
   * @param {any} session
   * @param {() => void} onTimeoutToResults
   */
  startGame(session, onTimeoutToResults) {
    const minPlayers = session.hostParticipates ? 2 : 1;
    if (session.players.length < minPlayers) {
      return {
        ok: false,
        error: session.hostParticipates
          ? 'Need at least two players to start.'
          : 'Need at least one player to start.',
      };
    }
    session.currentRound = 0;
    session.phase = 'question';
    session.roundStart = Date.now();
    this.startRoundTimer(session, onTimeoutToResults);
    return { ok: true };
  }

  /**
   * @param {any} session
   * @param {() => void} onTimeoutToResults
   */
  nextRound(session, onTimeoutToResults) {
    if (session.phase !== 'results') return { ok: false, error: 'Not in results phase.' };
    const next = session.currentRound + 1;
    if (next >= session.questions.length) {
      session.phase = 'final';
      session.currentRound = session.questions.length - 1;
      session.roundStart = null;
      this.clearRoundTimer(session);
      return { ok: true, final: true };
    }
    session.currentRound = next;
    session.phase = 'question';
    session.roundStart = Date.now();
    this.startRoundTimer(session, onTimeoutToResults);
    return { ok: true, final: false };
  }
}
