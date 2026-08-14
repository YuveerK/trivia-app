import test from 'node:test';
import assert from 'node:assert/strict';
import { io as createClient } from 'socket.io-client';
import { createTriviaServer } from '../index.js';

function request(socket, event, payload = {}, requestId = crypto.randomUUID()) {
  return new Promise((resolve) => {
    socket.timeout(3_000).emit(
      event,
      { ...payload, clientId: `test-${socket.id}`, requestId },
      (error, response) => resolve(error ? { ok: false, error: 'timeout' } : response),
    );
  });
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = createClient(url, { transports: ['websocket'], forceNew: true, reconnection: false });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function waitFor(socket, event, predicate = () => true, timeout = 3_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, listener);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeout);
    const listener = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, listener);
      resolve(payload);
    };
    socket.on(event, listener);
  });
}

test('acknowledged flow handles duplicate names, idempotency, explicit leave completion, and hidden live scores', async () => {
  const trivia = createTriviaServer();
  const address = await trivia.listen(0);
  const url = `http://127.0.0.1:${address.port}`;
  const sockets = [];
  test.after(async () => {
    for (const socket of sockets) socket.disconnect();
    await trivia.close();
  });

  const host = await connect(url); sockets.push(host);
  const created = await request(host, 'host:create', { name: 'Host', hostParticipates: false });
  assert.equal(created.ok, true);

  const one = await connect(url); sockets.push(one);
  const two = await connect(url); sockets.push(two);
  const joinedOne = await request(one, 'player:join', { code: created.session.code, name: 'Alex' });
  const joinedTwo = await request(two, 'player:join', { code: created.session.code, name: 'Ａlex' });
  assert.equal(joinedOne.you.name, 'Alex');
  assert.equal(joinedTwo.you.name, 'Alex (2)');

  const startRequestId = crypto.randomUUID();
  const started = await request(host, 'host:start', { code: created.session.code }, startRequestId);
  const repeated = await request(host, 'host:start', { code: created.session.code }, startRequestId);
  const invalidRepeat = await request(host, 'host:start', { code: created.session.code });
  assert.equal(started.ok, true);
  assert.equal(repeated.ok, true);
  assert.equal(invalidRepeat.ok, false);

  const correctOption = trivia.sessions.getSession(created.session.code).questions[0].correct;
  const hiddenScoreDelta = waitFor(host, 'session:delta', ({ type, payload }) =>
    type === 'player:upsert' && payload.player.id === joinedOne.you.id && payload.player.answers[0],
  );
  const recorded = await request(one, 'player:answer', {
    code: created.session.code,
    roundIndex: 0,
    optionIndex: correctOption,
  });
  assert.deepEqual(recorded, { ok: true, accepted: true });
  assert.equal('correct' in recorded, false);
  const livePlayer = (await hiddenScoreDelta).payload.player;
  assert.equal(livePlayer.score, 0);
  assert.deepEqual(livePlayer.answers[0], { submitted: true });

  const resultsSnapshot = waitFor(host, 'session:snapshot', ({ session }) => session.phase === 'results');
  await request(two, 'player:leave', { code: created.session.code });
  const results = await resultsSnapshot;
  assert.equal(results.session.phase, 'results');
  assert.ok(results.session.players.find((player) => player.id === joinedOne.you.id).score > 0);
});

test('accepts a burst of 50 simultaneous joins and rejects the 51st', async () => {
  const trivia = createTriviaServer();
  const address = await trivia.listen(0);
  const url = `http://127.0.0.1:${address.port}`;
  const sockets = [];
  test.after(async () => {
    for (const socket of sockets) socket.disconnect();
    await trivia.close();
  });

  const host = await connect(url); sockets.push(host);
  const created = await request(host, 'host:create', { name: 'Host', hostParticipates: false });
  const players = await Promise.all(Array.from({ length: 51 }, () => connect(url)));
  sockets.push(...players);
  const joins = await Promise.all(players.map((socket, index) => request(socket, 'player:join', {
    code: created.session.code,
    name: index < 10 ? 'Sam' : `Player ${index}`,
  })));

  assert.equal(joins.filter((result) => result.ok).length, 50);
  assert.equal(joins.filter((result) => !result.ok).length, 1);
  const duplicateLabels = joins.slice(0, 10).map((result) => result.you.name);
  assert.equal(new Set(duplicateLabels).size, 10);
  assert.equal(duplicateLabels.every((name) => name === 'Sam' || /^Sam \(\d+\)$/.test(name)), true);

  const started = await request(host, 'host:start', { code: created.session.code });
  assert.equal(started.ok, true);
  const resultsSnapshot = waitFor(host, 'session:snapshot', ({ session }) => session.phase === 'results', 5_000);
  const answers = await Promise.all(players.slice(0, 50).map((socket) => request(socket, 'player:answer', {
    code: created.session.code,
    roundIndex: 0,
    optionIndex: 0,
  })));
  assert.equal(answers.every((answer) => answer.ok && answer.accepted), true);
  const results = await resultsSnapshot;
  assert.equal(results.session.players.filter((player) => player.answers[0]).length, 50);
});

test('supersedes an older socket and restores a disconnected host session without pausing', async () => {
  const trivia = createTriviaServer();
  const address = await trivia.listen(0);
  const url = `http://127.0.0.1:${address.port}`;
  const sockets = [];
  test.after(async () => {
    for (const socket of sockets) socket.disconnect();
    await trivia.close();
  });

  const host = await connect(url); sockets.push(host);
  const created = await request(host, 'host:create', { name: 'Host', hostParticipates: true });
  const player = await connect(url); sockets.push(player);
  await request(player, 'player:join', { code: created.session.code, name: 'Player' });
  await request(host, 'host:start', { code: created.session.code });
  await request(player, 'player:answer', {
    code: created.session.code,
    roundIndex: 0,
    optionIndex: 0,
  });

  const disconnectedSnapshot = waitFor(
    player,
    'session:snapshot',
    ({ session }) => session.hostDisconnected,
  );
  host.disconnect();
  const disconnected = await disconnectedSnapshot;
  assert.equal(disconnected.session.hostDisconnected, true);
  assert.equal(disconnected.session.phase, 'question');

  const replacement = await connect(url); sockets.push(replacement);
  const reconnected = await request(replacement, 'player:reconnect', {
    code: created.session.code,
    playerId: created.you.id,
    reconnectToken: created.you.reconnectToken,
  });
  assert.equal(reconnected.ok, true);
  assert.equal(reconnected.session.hostDisconnected, false);
  assert.ok(reconnected.session.remainingMs <= disconnected.session.remainingMs);

  const newest = await connect(url); sockets.push(newest);
  const supersededNotice = waitFor(replacement, 'session:superseded');
  const newestReconnect = await request(newest, 'player:reconnect', {
    code: created.session.code,
    playerId: created.you.id,
    reconnectToken: created.you.reconnectToken,
  });
  assert.equal(newestReconnect.ok, true);
  await supersededNotice;
  assert.equal(replacement.connected, false);
});

test('accepts the largest valid custom question pack within the socket message limit', async () => {
  const trivia = createTriviaServer();
  const address = await trivia.listen(0);
  const url = `http://127.0.0.1:${address.port}`;
  const host = await connect(url);
  test.after(async () => {
    host.disconnect();
    await trivia.close();
  });

  const questions = Array.from({ length: 50 }, () => ({
    q: '😀'.repeat(150),
    options: Array.from({ length: 6 }, () => '😀'.repeat(100)),
    correct: 0,
  }));
  const created = await request(host, 'host:create', { name: 'Host', questions });
  assert.equal(created.ok, true);
  assert.equal(created.session.questions.length, 50);
});

test('ending a session clears socket memberships and removes the room', async () => {
  const trivia = createTriviaServer();
  const address = await trivia.listen(0);
  const url = `http://127.0.0.1:${address.port}`;
  const host = await connect(url);
  const player = await connect(url);
  test.after(async () => {
    host.disconnect();
    player.disconnect();
    await trivia.close();
  });

  const created = await request(host, 'host:create', { name: 'Host', hostParticipates: false });
  await request(player, 'player:join', { code: created.session.code, name: 'Player' });
  const ended = waitFor(player, 'session:ended');
  assert.equal((await request(host, 'host:end', { code: created.session.code })).ok, true);
  await ended;

  assert.equal(trivia.io.sockets.sockets.get(host.id).data.membership, null);
  assert.equal(trivia.io.sockets.sockets.get(player.id).data.membership, null);
  assert.equal(trivia.io.sockets.adapter.rooms.has(created.session.code), false);
});

test('an old cached join retry cannot detach a player from a newer session', async () => {
  const trivia = createTriviaServer();
  const address = await trivia.listen(0);
  const url = `http://127.0.0.1:${address.port}`;
  const firstHost = await connect(url);
  const secondHost = await connect(url);
  const player = await connect(url);
  test.after(async () => {
    firstHost.disconnect();
    secondHost.disconnect();
    player.disconnect();
    await trivia.close();
  });

  const first = await request(firstHost, 'host:create', { name: 'First host', hostParticipates: false });
  const second = await request(secondHost, 'host:create', { name: 'Second host', hostParticipates: false });
  const oldRequestId = crypto.randomUUID();
  assert.equal((await request(player, 'player:join', {
    code: first.session.code,
    name: 'Player',
  }, oldRequestId)).ok, true);
  await request(player, 'player:leave', { code: first.session.code });
  assert.equal((await request(player, 'player:join', {
    code: second.session.code,
    name: 'Player',
  })).ok, true);

  const staleRetry = await request(player, 'player:join', {
    code: first.session.code,
    name: 'Player',
  }, oldRequestId);
  assert.equal(staleRetry.ok, false);
  assert.equal((await request(player, 'session:sync', { code: second.session.code })).ok, true);
});

test('a rejected create or join does not detach the caller from their current session', async () => {
  const trivia = createTriviaServer();
  const address = await trivia.listen(0);
  const url = `http://127.0.0.1:${address.port}`;
  const host = await connect(url);
  const player = await connect(url);
  test.after(async () => {
    host.disconnect();
    player.disconnect();
    await trivia.close();
  });

  const created = await request(host, 'host:create', { name: 'Host', hostParticipates: false });
  const joined = await request(player, 'player:join', { code: created.session.code, name: 'Player' });
  assert.equal(joined.ok, true);

  const invalidJoin = await request(player, 'player:join', { code: 'ZZZZ', name: 'Player' });
  assert.equal(invalidJoin.ok, false);
  assert.equal((await request(player, 'session:sync', { code: created.session.code })).ok, true);

  const invalidCreate = await request(player, 'host:create', {
    name: 'Player',
    questions: [{ q: '', options: ['One', 'Two'], correct: 0 }],
  });
  assert.equal(invalidCreate.ok, false);
  assert.equal((await request(player, 'session:sync', { code: created.session.code })).ok, true);
});

test('a spectator host keeps an empty lobby open for replacement players', async () => {
  const trivia = createTriviaServer();
  const address = await trivia.listen(0);
  const url = `http://127.0.0.1:${address.port}`;
  const host = await connect(url);
  const first = await connect(url);
  const replacement = await connect(url);
  test.after(async () => {
    host.disconnect();
    first.disconnect();
    replacement.disconnect();
    await trivia.close();
  });

  const created = await request(host, 'host:create', { name: 'Host', hostParticipates: false });
  assert.equal((await request(first, 'player:join', {
    code: created.session.code,
    name: 'First',
  })).ok, true);
  assert.equal((await request(first, 'player:leave', { code: created.session.code })).ok, true);

  const joined = await request(replacement, 'player:join', {
    code: created.session.code,
    name: 'Replacement',
  });
  assert.equal(joined.ok, true);
  assert.equal(joined.session.players.length, 1);
});

test('host handoff immediately finishes a round when every remaining player answered', async () => {
  const trivia = createTriviaServer();
  const address = await trivia.listen(0);
  const url = `http://127.0.0.1:${address.port}`;
  const host = await connect(url);
  const player = await connect(url);
  test.after(async () => {
    host.disconnect();
    player.disconnect();
    await trivia.close();
  });

  const created = await request(host, 'host:create', { name: 'Host', hostParticipates: true });
  const joined = await request(player, 'player:join', { code: created.session.code, name: 'Player' });
  await request(host, 'host:start', { code: created.session.code });
  await request(player, 'player:answer', {
    code: created.session.code,
    roundIndex: 0,
    optionIndex: 0,
  });

  const oldHostSocketId = host.id;
  const disconnected = waitFor(player, 'session:snapshot', ({ session }) => session.hostDisconnected);
  host.disconnect();
  await disconnected;

  const results = waitFor(player, 'session:snapshot', ({ session }) => session.phase === 'results');
  const session = trivia.sessions.getSession(created.session.code);
  const output = trivia.sessions.removeParticipant(created.session.code, created.you.id, oldHostSocketId);
  trivia.sessions.onAfterPlayerChange(created.session.code, output);
  const snapshot = await results;

  assert.equal(snapshot.session.hostId, joined.you.id);
  assert.equal(snapshot.session.phase, 'results');
});
