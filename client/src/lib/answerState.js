export function resolveLockedAnswerIndex(canAnswer, myAnswer, selectedAnswer) {
  if (!canAnswer) return null;
  if (typeof myAnswer?.idx === 'number') return myAnswer.idx;
  if (selectedAnswer != null) return selectedAnswer;
  return myAnswer ? -1 : null;
}
