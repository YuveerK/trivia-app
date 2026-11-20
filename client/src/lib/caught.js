// Playful "caught wandering" callouts. Purely for fun: they never affect scores.

export const CAUGHT_GRACE_MS = 2_000;

const LINES = {
  tab: [
    '{name} just went on a little Google adventure 🧭',
    '{name} left to "check something real quick" 👀',
    '{name} is consulting the ancient scrolls (a new tab) 📜',
    '{name} suddenly needed to check their email. Sure. 📧',
    '{name} phoned a friend. The friend is Google. ☎️',
    '{name} wandered off mid-question 🚶',
  ],
  copy: [
    '{name} copied the question… for safekeeping, surely 📋',
    '{name} hit Ctrl+C. We all know what comes next 👀',
    '{name} is collecting questions as souvenirs 🧳',
  ],
};

function hash(text) {
  let value = 0;
  for (let i = 0; i < text.length; i++) value = (value * 31 + text.charCodeAt(i)) >>> 0;
  return value;
}

/** A stable line for a player/round, so every screen shows the same joke. */
export function caughtLine(name, round, reason) {
  const lines = LINES[reason] ?? LINES.tab;
  return lines[hash(`${name}|${round}|${reason}`) % lines.length].replace('{name}', name);
}

/** Players flagged in a given round, in a stable order. */
export function caughtInRound(players = [], round) {
  return players
    .filter((player) => player.caught?.[round])
    .map((player) => ({ player, reason: player.caught[round] }))
    .sort((a, b) => a.player.name.localeCompare(b.player.name));
}

/** Everyone flagged at least once, most-wandering first. */
export function caughtTotals(players = []) {
  return players
    .map((player) => ({ player, count: Object.keys(player.caught ?? {}).length }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.player.name.localeCompare(b.player.name));
}
