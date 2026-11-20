import test from 'node:test';
import assert from 'node:assert/strict';
import { caughtInRound, caughtLine, caughtTotals } from './caught.js';

test('caught lines are stable per player and round and include the name', () => {
  const line = caughtLine('Alex', 3, 'tab');
  assert.equal(line, caughtLine('Alex', 3, 'tab'));
  assert.match(line, /^Alex /);
  assert.match(caughtLine('Sam', 0, 'copy'), /Sam/);
  assert.match(caughtLine('Sam', 0, 'unknown'), /Sam/);
});

test('lists players caught in a round and ranks total wanderers', () => {
  const players = [
    { id: 'a', name: 'Zed', caught: { 0: 'tab', 2: 'copy' } },
    { id: 'b', name: 'Amy', caught: { 0: 'copy' } },
    { id: 'c', name: 'Bob', caught: {} },
    { id: 'd', name: 'Old client' },
  ];
  assert.deepEqual(
    caughtInRound(players, 0).map(({ player, reason }) => [player.name, reason]),
    [['Amy', 'copy'], ['Zed', 'tab']],
  );
  assert.deepEqual(caughtInRound(players, 1), []);
  assert.deepEqual(
    caughtTotals(players).map(({ player, count }) => [player.name, count]),
    [['Zed', 2], ['Amy', 1]],
  );
});
