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

test('freezes the authoritative clock while the host is disconnected', () => {
  const sessions = manager();
  const session = sessions.createSession('Host', 'host', null, true).session;
  sessions.addPlayer(session.code, 'player', 'Player');
  sessions.startGame(session, () => {});
  session.roundStart = Date.now() - 5_000;
  sessions.markDisconnected(session.code, session.hostId, 'host', () => {});
  const frozen = getRemainingMs(session);
  assert.equal(session.paused, true);
  assert.equal(sessions.recordAnswer(session, 'player', 0, 0).ok, false);
  session.roundElapsedMs += 10_000;
  assert.equal(getRemainingMs(session), Math.max(0, frozen - 10_000));
  const reconnect = sessions.markReconnected(
    session.code,
    session.hostId,
    session.hostReconnectToken,
    'new-host',
    () => {},
  );
  assert.equal(reconnect.ok, true);
  assert.equal(session.paused, false);
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
  sessions.markDisconnected(session.code, two.id, 'two', () => {});
  assert.equal(allPlayersAnswered(session), false);
  sessions.removeParticipant(session.code, two.id, 'two');
  assert.equal(allPlayersAnswered(session), true);
  assert.equal(one.connected, true);
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
