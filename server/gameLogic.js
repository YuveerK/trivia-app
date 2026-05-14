export const MIN_POINTS = 200;
export const MAX_POINTS = 1000;

/**
 * @param {number} timeLeftSec - seconds remaining in round (>= 0)
 * @param {number} roundDurationSec - total round duration in seconds
 * @returns {number}
 */
export function calculateScore(timeLeftSec, roundDurationSec) {
  if (roundDurationSec <= 0) return MIN_POINTS;
  const t = Math.max(0, Math.min(timeLeftSec, roundDurationSec));
  const ratio = t / roundDurationSec;
  return Math.round(MIN_POINTS + (MAX_POINTS - MIN_POINTS) * ratio);
}

/**
 * @param {unknown} questions
 * @returns {{ valid: true } | { valid: false, error: string }}
 */
export function validateQuestionPack(questions) {
  if (!Array.isArray(questions)) {
    return { valid: false, error: 'Questions must be a JSON array.' };
  }
  if (questions.length === 0) {
    return { valid: false, error: 'Add at least one question.' };
  }
  if (questions.length > 50) {
    return { valid: false, error: 'Maximum 50 questions allowed.' };
  }
  for (let i = 0; i < questions.length; i++) {
    const item = questions[i];
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `Question ${i + 1} is invalid.` };
    }
    const q = item.q;
    if (typeof q !== 'string' || q.length < 1 || q.length > 300) {
      return {
        valid: false,
        error: `Question ${i + 1}: text must be a string between 1 and 300 characters.`,
      };
    }
    const options = item.options;
    if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
      return {
        valid: false,
        error: `Question ${i + 1}: options must be an array of 2 to 6 strings.`,
      };
    }
    for (let j = 0; j < options.length; j++) {
      if (typeof options[j] !== 'string' || options[j].trim() === '') {
        return {
          valid: false,
          error: `Question ${i + 1}: option ${j + 1} must be a non-empty string.`,
        };
      }
    }
    const correct = item.correct;
    if (
      typeof correct !== 'number' ||
      !Number.isInteger(correct) ||
      correct < 0 ||
      correct >= options.length
    ) {
      return {
        valid: false,
        error: `Question ${i + 1}: "correct" must be a valid index into options.`,
      };
    }
  }
  return { valid: true };
}

/**
 * All currently connected players must have submitted for the current round.
 * @param {{ phase: string, currentRound: number, players: Array<{ connected: boolean, answers: Record<number, unknown> }> }} session
 */
export function allPlayersAnswered(session) {
  if (session.phase !== 'question') return false;
  const r = session.currentRound;
  const active = session.players.filter((p) => p.connected);
  if (active.length === 0) return false;
  return active.every((p) => p.answers[r] != null);
}
