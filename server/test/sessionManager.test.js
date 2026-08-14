import test from 'node:test';
import assert from 'node:assert/strict';
import { allPlayersAnswered } from '../gameLogic.js';
import {
  MAX_PLAYERS,
  SessionManager,
  getRemainingMs,
  normalizeDisplayName,
  serializePlayer,
} from '../sessionManager.js';

function manager() {
  const instance = new SessionManager();
  test.after(() => instance.close());
  return instance;
}

test('normalizes safe names and rejects invisible or oversized names', () => {
  assert.deepEqual(normalizeDisplayName('  Alex\n Smith  '), { ok: true, name: 'Alex Smith' });
  assert.equal(normalizeDisplayName('\u200b').ok, false);
  assert.equal(normalizeDisplayName('\u0301').ok, false);
  assert.equal(normalizeDisplayName('🇿🇦').ok, true);
  assert.equal(normalizeDisplayName('x'.repeat(31)).ok, false);
  assert.equal(normalizeDisplayName({ name: 'Alex' }).ok, false);
});

test('allows duplicate names with stable display suffixes', () => {
  const sessions = manager();
  const session = sessions.createSession('Host', 'host', null, false).session;
  const first = sessions.addPlayer(session.code, 'one', 'José');
  const second = sessions.addPlayer(session.code, 'two', 'Jose\u0301');
  assert.equal(first.player.name, 'José');
  assert.equal(second.player.name, 'José (2)');
  assert.notEqual(first.player.id, second.player.id);
  const long = sessions.addPlayer(session.code, 'three', 'x'.repeat(30));
  const longDuplicate = sessions.addPlayer(session.code, 'four', 'x'.repeat(30));
  assert.ok(Array.from(long.player.name).length <= 30);
  assert.ok(Array.from(longDuplicate.player.name).length <= 30);
});

test('enforces the player capacity', () => {
  const sessions = manager();
  const session = sessions.createSession('Host', 'host', null, false).session;
  for (let index = 0; index < MAX_PLAYERS; index++) {
    assert.equal(sessions.addPlayer(session.code, `s${index}`, `Player ${index}`).ok, true);
  }
  assert.equal(sessions.addPlayer(session.code, 'overflow', 'Overflow').ok, false);
});

test('does not allow an active game to be started again', () => {
  const sessions = manager();
  const session = sessions.createSession('Host', 'host', null, true).session;
  sessions.addPlayer(session.code, 'player', 'Player');
  assert.equal(sessions.startGame(session, () => {}).ok, true);
  assert.equal(sessions.startGame(session, () => {}).ok, false);
  assert.equal(session.currentRound, 0);
});

test('rejects malformed answer indexes', () => {
  const sessions = manager();
  const session = sessions.createSession('Host', 'host', null, true).session;
  sessions.addPlayer(session.code, 'player', 'Player');
  sessions.startGame(session, () => {});
  assert.equal(sessions.recordAnswer(session, 'player', 0, -1).ok, false);
  assert.equal(sessions.recordAnswer(session, 'player', 0, 0.5).ok, false);
  assert.equal(sessions.recordAnswer(session, 'player', 0, 999).ok, false);
});

test('keeps the authoritative clock running while the host is disconnected', () => {
  const sessions = manager();
  const session = sessions.createSession('Host', 'host', null, true).session;
  sessions.addPlayer(session.code, 'player', 'Player');
  sessions.startGame(session, () => {});
  session.roundStart = Date.now() - 5_000;
  const roundStart = session.roundStart;
  const beforeDisconnect = getRemainingMs(session);
  sessions.markDisconnected(session.code, session.hostId, 'host');
  assert.equal(session.roundStart, roundStart);
  assert.ok(getRemainingMs(session) <= beforeDisconnect);
  assert.equal(sessions.recordAnswer(session, 'player', 0, 0).ok, true);
  const reconnect = sessions.markReconnected(
    session.code,
    session.hostId,
    session.hostReconnectToken,
    'new-host',
  );
  assert.equal(reconnect.ok, true);
});

test('treats a same-socket spectator host reconnect as unchanged', () => {
  const sessions = manager();
  const session = sessions.createSession('Host', 'host', null, false).session;
  const initialVersion = session.version;

  const first = sessions.markReconnected(
    session.code,
    session.hostId,
    session.hostReconnectToken,
    'host',
  );
  const second = sessions.markReconnected(
    session.code,
    session.hostId,
    session.hostReconnectToken,
    'host',
  );

  assert.equal(first.unchanged, true);
  assert.equal(second.unchanged, true);
  assert.equal(session.version, initialVersion);
});

test('keeps an empty lobby alive while its spectator host is still connected', () => {
  const sessions = manager();
  const session = sessions.createSession('Host', 'host', null, false).session;
  const player = sessions.addPlayer(session.code, 'player', 'Player').player;

  const result = sessions.removeParticipant(session.code, player.id, 'player');

  assert.equal(result.ended, undefined);
  assert.equal(session.players.length, 0);
  assert.equal(sessions.getSession(session.code), session);
  assert.equal(sessions.addPlayer(session.code, 'replacement', 'Replacement').ok, true);
});

test('preserves scores and player identity when leaving after the lobby', () => {
  const sessions = manager();
  const session = sessions.createSession('Host', 'host', null, false).session;
  const player = sessions.addPlayer(session.code, 'player', 'Player').player;
  sessions.addPlayer(session.code, 'other', 'Other');
  player.score = 900;
  session.phase = 'final';
  const result = sessions.removeParticipant(session.code, player.id, 'player');
  assert.equal(result.ended, undefined);
  assert.equal(session.players.find((item) => item.id === player.id).score, 900);
  assert.equal(session.players.find((item) => item.id === player.id).departed, true);
});

test('keeps a disconnected player in the round until they leave or the round timer expires', () => {
  const sessions = manager();
  const session = sessions.createSession('Host', 'host', null, false).session;
  const one = sessions.addPlayer(session.code, 'one', 'One').player;
  const two = sessions.addPlayer(session.code, 'two', 'Two').player;
  sessions.startGame(session, () => {});
  sessions.recordAnswer(session, 'one', 0, 0);
  sessions.markDisconnected(session.code, two.id, 'two');
  assert.equal(allPlayersAnswered(session), false);
  sessions.removeParticipant(session.code, two.id, 'two');
  assert.equal(allPlayersAnswered(session), true);
  assert.equal(one.connected, true);
});

test('reaps a player who never returns so later rounds can still end early', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const sessions = manager();
  const session = sessions.createSession('Host', 'host', null, false).session;
  sessions.addPlayer(session.code, 'one', 'One');
  const ghost = sessions.addPlayer(session.code, 'ghost', 'Ghost').player;
  sessions.startGame(session, () => {});

  sessions.markDisconnected(session.code, ghost.id, 'ghost');
  sessions.recordAnswer(session, 'one', 0, 0);
  assert.equal(allPlayersAnswered(session), false);

  t.mock.timers.tick(60_000);
  assert.equal(ghost.departed, true);
  assert.equal(allPlayersAnswered(session), true);
});

test('hands the room to a connected player when the host never returns', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const sessions = manager();
  let endedReason = null;
  sessions.onAfterPlayerChange = (_code, output) => {
    if (output.ended) endedReason = output.reason;
  };
  const session = sessions.createSession('Host', 'host', null, true).session;
  const player = sessions.addPlayer(session.code, 'player', 'Player').player;
  sessions.startGame(session, () => {});

  sessions.markDisconnected(session.code, session.hostId, 'host');

  t.mock.timers.tick(60_000);
  assert.equal(endedReason, null);
  assert.equal(session.hostId, player.id);
  assert.equal(session.hostDisconnected, false);
});

test('an absent spectator host hands off rather than destroying the game', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const sessions = manager();
  const session = sessions.createSession('Host', 'host', null, false).session;
  const player = sessions.addPlayer(session.code, 'player', 'Player').player;
  sessions.startGame(session, () => {});

  sessions.markDisconnected(session.code, session.hostId, 'host');
  t.mock.timers.tick(60_000);

  assert.equal(sessions.getSession(session.code), session);
  assert.equal(session.hostId, player.id);
  assert.equal(session.hostParticipates, true);
});

test('still ends the session when nobody can take over as host', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const sessions = manager();
  let endedReason = null;
  sessions.onAfterPlayerChange = (_code, output) => {
    if (output.ended) endedReason = output.reason;
  };
  const session = sessions.createSession('Host', 'host', null, false).session;
  const player = sessions.addPlayer(session.code, 'player', 'Player').player;
  sessions.startGame(session, () => {});

  sessions.markDisconnected(session.code, player.id, 'player');
  sessions.markDisconnected(session.code, session.hostId, 'host');
  t.mock.timers.tick(60_000);

  assert.equal(endedReason, 'Everyone left the session.');
  assert.equal(sessions.getSession(session.code), null);
});

test('does not reveal current-round score changes before results', () => {
  const sessions = manager();
  const session = sessions.createSession('Host', 'host', null, false).session;
  const player = sessions.addPlayer(session.code, 'player', 'Player').player;
  sessions.startGame(session, () => {});
  sessions.recordAnswer(session, 'player', 0, session.questions[0].correct);
  assert.ok(player.score > 0);
  assert.equal(serializePlayer(session, player).score, 0);
  sessions.transitionToResults(session);
  assert.equal(serializePlayer(session, player).score, player.score);
});

test('expires sessions by inactivity and invokes the notification callback', () => {
  const sessions = manager();
  const session = sessions.createSession('Host', 'host', null, true).session;
  let expiredCode = null;
  sessions.onSessionExpired = (code) => {
    expiredCode = code;
    sessions.cleanupSession(code);
  };
  session.updatedAt = Date.now() - 5 * 60 * 60 * 1000;
  sessions.pruneOldSessions();
  assert.equal(expiredCode, session.code);
  assert.equal(sessions.getSession(session.code), null);
});
