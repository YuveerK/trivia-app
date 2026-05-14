import { cn } from '../lib/utils.js';

export function Leaderboard({
  players,
  currentPlayerId,
  className = '',
  currentRound = null,
  showAnswerStatus = false,
}) {
  const sorted = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });

  return (
    <div
      className={cn(
        'max-h-[min(24rem,50vh)] overflow-y-auto rounded-lg border border-border bg-muted/30 shadow-inner',
        className,
      )}
    >
      <ol className="divide-y divide-border">
        {sorted.map((player, index) => {
          const isYou = player.id === currentPlayerId;
          return (
            <li
              key={player.id}
              className={cn(
                'flex items-center justify-between gap-3 px-4 py-3 transition-colors',
                isYou ? 'bg-accent/40 dark:bg-accent/20' : 'hover:bg-muted/50',
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-7 shrink-0 text-sm font-semibold text-muted-foreground">#{index + 1}</span>
                <span className={cn('truncate', isYou ? 'font-semibold text-foreground' : 'text-foreground/90')}>
                  {player.name}
                  {isYou && <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {showAnswerStatus && currentRound != null && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-1 text-xs font-semibold',
                      player.answers?.[currentRound]
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {player.answers?.[currentRound] ? 'Answered' : 'Waiting'}
                  </span>
                )}
                <span className="font-semibold tabular-nums text-foreground">{player.score}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
