import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLockedAnswerIndex } from './answerState.js';

test('keeps the locally selected answer highlighted after the hidden server acknowledgement', () => {
  assert.equal(resolveLockedAnswerIndex(true, { submitted: true }, 2), 2);
});

test('locks a remotely submitted answer without inventing a selected option', () => {
  assert.equal(resolveLockedAnswerIndex(true, { submitted: true }, null), -1);
});

test('prefers a revealed server answer and handles unanswered or spectator states', () => {
  assert.equal(resolveLockedAnswerIndex(true, { idx: 1 }, 2), 1);
  assert.equal(resolveLockedAnswerIndex(true, undefined, 3), 3);
  assert.equal(resolveLockedAnswerIndex(true, undefined, null), null);
  assert.equal(resolveLockedAnswerIndex(false, { idx: 1 }, 1), null);
});
