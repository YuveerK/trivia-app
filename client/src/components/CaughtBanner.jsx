import { caughtInRound, caughtLine } from '../lib/caught.js';
import { cn } from '../lib/utils.js';

/** Lists players caught wandering in a round. Renders nothing when nobody was. */
export function CaughtBanner({ players, round, title = 'Caught wandering', className = '' }) {
  const caught = caughtInRound(players, round);
  if (caught.length === 0) return null;

  return (
    <div
      className={cn(
        'animate-slideDown overflow-hidden rounded-2xl border border-amber-300/60 bg-amber-50 shadow-stage',
        'dark:border-amber-500/30 dark:bg-amber-950/30',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 border-b border-amber-300/50 px-5 py-3 dark:border-amber-500/20">
        <span className="text-lg leading-none" aria-hidden>👀</span>
        <h3 className="font-bold text-amber-900 dark:text-amber-200">{title}</h3>
        <span className="ml-auto rounded-full bg-amber-200/70 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
          {caught.length}
        </span>
      </div>
      <ul className="divide-y divide-amber-200/60 dark:divide-amber-500/10">
        {caught.map(({ player, reason }) => (
          <li
            key={player.id}
            className="animate-slideInRight px-5 py-2.5 text-sm font-semibold text-amber-950 dark:text-amber-100"
          >
            {caughtLine(player.name, round, reason)}
          </li>
        ))}
      </ul>
    </div>
  );
}
