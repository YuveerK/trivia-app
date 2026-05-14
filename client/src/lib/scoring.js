const MIN_POINTS = 200;
const MAX_POINTS = 1000;

export function projectedPoints(timeLeftSec, roundDurationSec) {
  if (roundDurationSec <= 0) return MIN_POINTS;
  const t = Math.max(0, Math.min(timeLeftSec, roundDurationSec));
  const ratio = t / roundDurationSec;
  return Math.round(MIN_POINTS + (MAX_POINTS - MIN_POINTS) * ratio);
}
