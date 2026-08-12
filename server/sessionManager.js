import { randomBytes, randomInt, randomUUID } from 'crypto';
import { calculateScore, validateQuestionPack } from './gameLogic.js';
import { defaultQuestions } from './defaultQuestions.js';
import { MemorySessionStore } from './sessionStore.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_PLAYERS = 50;
const MAX_NAME_LENGTH = 30;
const SESSION_IDLE_MS = 4 * 60 * 60 * 1000;
const PLAYER_GRACE_MS = 30_000;
const HOST_ABSENT_MS = 60_000;

function generateCode() {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_CHARS[randomInt(0, CODE_CHARS.length)];
  return code;
}

function generateReconnectToken() {
  return randomBytes(32).toString('base64url');
}

export function normalizeDisplayName(value) {
  if (typeof value !== 'string') {
    return { ok: false, error: 'Name must be text.' };
  }

  const name = value
    .normalize('NFKC')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();

  const length = Array.from(name).length;
  if (length === 0) return { ok: false, error: 'Name is required.' };
  if (!/[\p{L}\p{N}\p{S}]/u.test(name)) {
    return { ok: false, error: 'Name must contain a visible letter, number, or symbol.' };
  }
  if (length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` };
  }
  return { ok: true, name };
}

function canonicalName(name) {
  return name.normalize('NFKC').toLocaleLowerCase('en');
}

function allocateDisplayName(session, baseName) {
  const used = new Set(session.players.map((player) => canonicalName(player.name)));
  if (!session.hostParticipates) used.add(canonicalName(session.hostName));
  if (!used.has(canonicalName(baseName))) return baseName;

  for (let suffix = 2; suffix <= MAX_PLAYERS + 1; suffix++) {
    const ending = ` (${suffix})`;
    const trimmedBase = Array.from(baseName).slice(0, MAX_NAME_LENGTH - ending.length).join('').trimEnd();
    const candidate = `${trimmedBase}${ending}`;
    if (!used.has(canonicalName(candidate))) return candidate;
  }
  const ending = ` (${randomUUID().slice(0, 4)})`;
  return `${Array.from(baseName).slice(0, MAX_NAME_LENGTH - ending.length).join('').trimEnd()}${ending}`;
}

function createPlayer(baseName, name, socketId, id = randomUUID(), reconnectToken = generateReconnectToken()) {
  return {
    id,
    socketId,
    reconnectToken,
    baseName,
    name,
    score: 0,
    answers: {},
    connected: true,
    departed: false,
  };
}

function shuffleQuestionOptions(question) {
  const options = question.options.map((option, index) => ({ option, originalIndex: index }));
  for (let i = options.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }
  return {
    q: question.q.trim(),
    options: options.map((entry) => entry.option.trim()),
    correct: options.findIndex((entry) => entry.originalIndex === question.correct),
  };
}

function prepareQuestions(questions) {
  return questions.map(shuffleQuestionOptions);
}

function canRevealQuestion(session, index) {
  return (
    session.phase === 'final' ||
    index < session.currentRound ||
    (session.phase === 'results' && index === session.currentRound)
  );
}

function serializeQuestions(session) {
  return session.questions.map((question, index) => {
    const showBody = index <= session.currentRound || session.phase === 'final';
    const output = showBody ? { q: question.q, options: question.options } : { q: '', options: [] };
    if (canRevealQuestion(session, index)) output.correct = question.correct;
    return output;
  });
}

function serializeAnswers(session, answers) {
  return Object.fromEntries(
    Object.entries(answers).map(([round, answer]) =>
      canRevealQuestion(session, Number(round)) ? [round, answer] : [round, { submitted: true }],
    ),
  );
}

export function serializePlayer(session, player) {
  const currentAnswer = player.answers[session.currentRound];
  const hiddenCurrentPoints = session.phase === 'question' && currentAnswer?.correct
    ? currentAnswer.points
    : 0;
  return {
    id: player.id,
    name: player.name,
    score: Math.max(0, player.score - hiddenCurrentPoints),
    answers: serializeAnswers(session, player.answers),
    connected: player.connected,
    departed: player.departed,
  };
}

function elapsedMs(session, now = Date.now()) {
  if (session.phase !== 'question') return 0;
  const currentSegment = session.roundStart == null ? 0 : Math.max(0, now - session.roundStart);
  return Math.max(0, session.roundElapsedMs + currentSegment);
}

export function getRemainingMs(session, now = Date.now()) {
  if (session.phase !== 'question') return 0;
  return Math.max(0, session.roundDuration * 1000 - elapsedMs(session, now));
}

export function serializeSession(session) {
  const now = Date.now();
  return {
    code: session.code,
    hostId: session.hostId,
    hostName: session.hostName,
    hostParticipates: session.hostParticipates,
    players: session.players.map((player) => serializePlayer(session, player)),
    questions: serializeQuestions(session),
    currentRound: session.currentRound,
    phase: session.phase,
    roundDuration: session.roundDuration,
    paused: session.paused,
    hostDisconnected: session.hostDisconnected,
    remainingMs: getRemainingMs(session, now),
    serverNow: now,
    version: session.version,
  };
}

export class SessionManager {
  constructor(store = new MemorySessionStore()) {
    this.store = store;
    this.onAfterPlayerChange = null;
    this.onSessionExpired = null;
    this.requestCache = new Map();
    this.cleanupInterval = setInterval(() => this.pruneOldSessions(), 10 * 60 * 1000);
    this.cleanupInterval.unref?.();
  }

  close() {
    clearInterval(this.cleanupInterval);
    for (const [, session] of this.store.entries()) this.clearSessionTimers(session);
    this.requestCache.clear();
  }

  getActiveCount() {
    return this.store.size;
  }

  getSession(code) {
    if (!code) return null;
    return this.store.get(String(code).toUpperCase()) ?? null;
  }

  touch(session) {
    session.updatedAt = Date.now();
    session.version += 1;
  }

  getCachedRequest(key) {
    const item = key ? this.requestCache.get(key) : null;
    if (!item) return null;
    if (item.expiresAt <= Date.now()) {
      this.requestCache.delete(key);
      return null;
    }
    return item.value;
  }

  cacheRequest(key, value) {
    if (!key) return;
    this.requestCache.set(key, { value, expiresAt: Date.now() + 5 * 60 * 1000 });
    if (this.requestCache.size > 10_000) {
      const now = Date.now();
      for (const [cacheKey, item] of this.requestCache) {
        if (item.expiresAt <= now) this.requestCache.delete(cacheKey);
      }
      while (this.requestCache.size > 10_000) {
        this.requestCache.delete(this.requestCache.keys().next().value);
      }
    }
  }

  pruneOldSessions() {
    const now = Date.now();
    for (const [code, session] of this.store.entries()) {
      if (now - session.updatedAt <= SESSION_IDLE_MS) continue;
      if (this.onSessionExpired) this.onSessionExpired(code, 'Session expired after four hours of inactivity.');
      else this.cleanupSession(code);
    }
  }

  createSession(hostNameInput, hostSocketId, questionsInput, hostParticipates = true) {
    const normalized = normalizeDisplayName(hostNameInput);
    if (!normalized.ok) return normalized;

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
      const validation = validateQuestionPack(parsed);
      if (!validation.valid) return { ok: false, error: validation.error };
      questions = parsed;
    }

    const defaultValidation = validateQuestionPack(questions);
    if (!defaultValidation.valid) return { ok: false, error: defaultValidation.error };

    let code = '';
    for (let attempt = 0; attempt < 10; attempt++) {
      code = generateCode();
      if (!this.store.has(code)) break;
      if (attempt === 9) return { ok: false, error: 'Could not generate a unique session code.' };
    }

    const now = Date.now();
    const hostId = randomUUID();
    const hostReconnectToken = generateReconnectToken();
    const session = {
      code,
      hostId,
      hostSocketId,
      hostReconnectToken,
      hostName: normalized.name,
      hostParticipates,
      players: hostParticipates
        ? [createPlayer(normalized.name, normalized.name, hostSocketId, hostId, hostReconnectToken)]
        : [],
      questions: prepareQuestions(questions),
      currentRound: -1,
      phase: 'lobby',
      roundDuration: 20,
      roundStart: null,
      roundElapsedMs: 0,
      paused: false,
      roundTimer: null,
      hostDisconnected: false,
      hostAbsentTimer: null,
      playerGraceTimers: new Map(),
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    this.store.set(code, session);
    return { ok: true, session };
  }

  addPlayer(code, socketId, nameInput) {
    const session = this.getSession(code);
    if (!session) return { ok: false, error: 'Session not found.' };
    if (session.phase !== 'lobby') return { ok: false, error: 'This game has already started.' };
    if (session.players.length >= MAX_PLAYERS) {
      return { ok: false, error: `This session is full (${MAX_PLAYERS} players).` };
    }
    const normalized = normalizeDisplayName(nameInput);
    if (!normalized.ok) return normalized;
    const name = allocateDisplayName(session, normalized.name);
    const player = createPlayer(normalized.name, name, socketId);
    session.players.push(player);
    this.touch(session);
    return { ok: true, session, player };
  }

  clearPlayerGraceTimer(session, playerId) {
    const timer = session.playerGraceTimers.get(playerId);
    if (timer) clearTimeout(timer);
    session.playerGraceTimers.delete(playerId);
  }

  clearSessionTimers(session) {
    if (session.roundTimer) clearTimeout(session.roundTimer);
    if (session.hostAbsentTimer) clearTimeout(session.hostAbsentTimer);
    for (const timer of session.playerGraceTimers.values()) clearTimeout(timer);
    session.roundTimer = null;
    session.hostAbsentTimer = null;
    session.playerGraceTimers.clear();
  }

  cleanupSession(code) {
    const session = this.getSession(code);
    if (!session) return;
    this.clearSessionTimers(session);
    this.store.delete(session.code);
  }

  removeParticipant(code, playerId, socketId) {
    const session = this.getSession(code);
    if (!session) return {};
    const isHost = session.hostId === playerId && session.hostSocketId === socketId;
    const player = session.players.find((item) => item.id === playerId && item.socketId === socketId);

    if (!player && !isHost) return { session, ignored: true };
    if (isHost && !player) {
      this.cleanupSession(code);
      return { ended: true, reason: 'The host left the session.' };
    }

    if (player) this.clearPlayerGraceTimer(session, player.id);

    if (session.phase === 'lobby') {
      const index = session.players.findIndex((item) => item.id === playerId);
      if (index >= 0) session.players.splice(index, 1);
    } else if (player) {
      player.connected = false;
      player.departed = true;
      player.socketId = null;
    }

    const activePlayers = session.players.filter((item) => !item.departed);
    if (activePlayers.length === 0) {
      this.cleanupSession(code);
      return { ended: true, reason: 'Everyone left the session.' };
    }

    let hostChanged = false;
    if (isHost) {
      const next = activePlayers.find((item) => item.connected);
      if (!next) {
        this.cleanupSession(code);
        return { ended: true, reason: 'No connected player could take over as host.' };
      }
      session.hostId = next.id;
      session.hostSocketId = next.socketId;
      session.hostReconnectToken = next.reconnectToken;
      session.hostName = next.name;
      session.hostParticipates = true;
      session.hostDisconnected = false;
      if (session.hostAbsentTimer) clearTimeout(session.hostAbsentTimer);
      session.hostAbsentTimer = null;
      hostChanged = true;
    }

    this.touch(session);
    return {
      session,
      player,
      removed: session.phase === 'lobby',
      hostChanged,
    };
  }

  markDisconnected(code, playerId, socketId, onHostAbsentEnd) {
    const session = this.getSession(code);
    if (!session) return null;
    const player = session.players.find((item) => item.id === playerId);
    const isCurrentPlayerSocket = player?.socketId === socketId;
    const isCurrentHostSocket = session.hostId === playerId && session.hostSocketId === socketId;
    if (!isCurrentPlayerSocket && !isCurrentHostSocket) return null;

    if (player && isCurrentPlayerSocket) {
      player.connected = false;
      this.clearPlayerGraceTimer(session, player.id);
      if (session.phase === 'lobby' && !isCurrentHostSocket) {
        const grace = setTimeout(() => {
          session.playerGraceTimers.delete(player.id);
          const out = this.removeParticipant(code, player.id, socketId);
          this.onAfterPlayerChange?.(code, out);
        }, PLAYER_GRACE_MS);
        grace.unref?.();
        session.playerGraceTimers.set(player.id, grace);
      }
    }

    if (isCurrentHostSocket) {
      session.hostDisconnected = true;
      if (session.phase === 'question' && !session.paused) {
        session.roundElapsedMs = elapsedMs(session);
        session.roundStart = null;
        session.paused = true;
        this.clearRoundTimer(session);
      }
      if (session.hostAbsentTimer) clearTimeout(session.hostAbsentTimer);
      session.hostAbsentTimer = setTimeout(() => {
        session.hostAbsentTimer = null;
        if (session.hostDisconnected) {
          onHostAbsentEnd(code, { reason: 'Host did not reconnect. Session ended.' });
        }
      }, HOST_ABSENT_MS);
      session.hostAbsentTimer.unref?.();
    }

    this.touch(session);
    return { code, session, player, hostDisconnected: isCurrentHostSocket };
  }

  markReconnected(code, playerId, reconnectToken, newSocketId, onResumeRound) {
    const session = this.getSession(code);
    if (!session) return { ok: false, error: 'Session not found.' };
    const player = session.players.find((item) => item.id === playerId);
    const isHost = session.hostId === playerId;
    if (!player && !isHost) return { ok: false, error: 'Player not found in session.' };
    if (player?.departed) return { ok: false, error: 'This player has left the session.' };

    const playerTokenOk = player?.reconnectToken === reconnectToken;
    const hostTokenOk = isHost && session.hostReconnectToken === reconnectToken;
    if (!playerTokenOk && !hostTokenOk) return { ok: false, error: 'Invalid reconnect credentials.' };

    const previousSocketId = isHost ? session.hostSocketId : player?.socketId;
    if (previousSocketId === newSocketId && player?.connected && !session.hostDisconnected) {
      return { ok: true, session, player, isHost, previousSocketId: null, unchanged: true };
    }

    if (player) {
      this.clearPlayerGraceTimer(session, player.id);
      player.socketId = newSocketId;
      player.connected = true;
    }
    if (isHost) {
      session.hostSocketId = newSocketId;
      session.hostDisconnected = false;
      if (session.hostAbsentTimer) clearTimeout(session.hostAbsentTimer);
      session.hostAbsentTimer = null;
      if (session.phase === 'question' && session.paused) {
        session.paused = false;
        session.roundStart = Date.now();
        onResumeRound?.(session);
      }
    }
    this.touch(session);
    return { ok: true, session, player, isHost, previousSocketId };
  }

  startRoundTimer(session, onTimeoutToResults) {
    this.clearRoundTimer(session);
    const remaining = getRemainingMs(session);
    session.roundTimer = setTimeout(() => {
      session.roundTimer = null;
      if (session.phase === 'question' && !session.paused) onTimeoutToResults();
    }, remaining);
    session.roundTimer.unref?.();
  }

  resumeRoundTimer(session, onTimeoutToResults) {
    this.startRoundTimer(session, onTimeoutToResults);
  }

  clearRoundTimer(session) {
    if (session.roundTimer) clearTimeout(session.roundTimer);
    session.roundTimer = null;
  }

  startGame(session, onTimeoutToResults) {
    if (session.phase !== 'lobby') return { ok: false, error: 'The game has already started.' };
    const connectedPlayers = session.players.filter((player) => player.connected && !player.departed);
    const minimum = session.hostParticipates ? 2 : 1;
    if (connectedPlayers.length < minimum) {
      return {
        ok: false,
        error: session.hostParticipates
          ? 'Need at least two connected players to start.'
          : 'Need at least one connected player to start.',
      };
    }
    session.currentRound = 0;
    session.phase = 'question';
    session.roundElapsedMs = 0;
    session.roundStart = Date.now();
    session.paused = false;
    this.startRoundTimer(session, onTimeoutToResults);
    this.touch(session);
    return { ok: true };
  }

  recordAnswer(session, socketId, roundIndex, optionIndex) {
    if (session.phase !== 'question') return { ok: false, error: 'Not accepting answers right now.' };
    if (session.paused) return { ok: false, error: 'The game is paused while the host reconnects.' };
    if (!Number.isInteger(roundIndex) || roundIndex !== session.currentRound) {
      return { ok: false, error: 'Wrong round.' };
    }
    const question = session.questions[roundIndex];
    if (!question) return { ok: false, error: 'Invalid round.' };
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) {
      return { ok: false, error: 'Invalid answer option.' };
    }
    const player = session.players.find(
      (item) => item.socketId === socketId && item.connected && !item.departed,
    );
    if (!player) return { ok: false, error: 'Player not in session.' };
    if (player.answers[roundIndex]) return { ok: false, error: 'You already answered this round.' };

    const remaining = getRemainingMs(session);
    if (remaining <= 0) return { ok: false, error: 'Time is up for this question.' };
    const timeLeftSec = remaining / 1000;
    const correct = optionIndex === question.correct;
    const points = correct ? calculateScore(timeLeftSec, session.roundDuration) : 0;
    player.answers[roundIndex] = {
      idx: optionIndex,
      correct,
      points,
      time: session.roundDuration - timeLeftSec,
    };
    if (correct) player.score += points;
    this.touch(session);
    return { ok: true, player, correct, points };
  }

  transitionToResults(session) {
    if (session.phase !== 'question') return { ok: false };
    this.clearRoundTimer(session);
    session.phase = 'results';
    session.roundStart = null;
    session.roundElapsedMs = 0;
    session.paused = false;
    this.touch(session);
    return { ok: true };
  }

  nextRound(session, onTimeoutToResults) {
    if (session.phase !== 'results') return { ok: false, error: 'Not in results phase.' };
    const next = session.currentRound + 1;
    if (next >= session.questions.length) {
      session.phase = 'final';
      session.currentRound = session.questions.length - 1;
      session.roundStart = null;
      session.roundElapsedMs = 0;
      session.paused = false;
      this.clearRoundTimer(session);
      this.touch(session);
      return { ok: true, final: true };
    }
    session.currentRound = next;
    session.phase = 'question';
    session.roundElapsedMs = 0;
    session.roundStart = Date.now();
    session.paused = false;
    this.startRoundTimer(session, onTimeoutToResults);
    this.touch(session);
    return { ok: true, final: false };
  }
}
