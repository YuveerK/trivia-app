import { cn } from '../lib/utils.js';
import { avatarGradient } from './PlayerBadge.jsx';

const MEDALS = ['🥇', '🥈', '🥉'];
const MEDAL_RINGS = [
  'ring-2 ring-amber-400/60 dark:ring-amber-400/50',
  'ring-2 ring-slate-400/60 dark:ring-slate-300/40',
  'ring-2 ring-amber-600/50 dark:ring-amber-700/50',
];

export function Leaderboard({ players, currentPlayerId, className = '', currentRound = null, showAnswerStatus = false }) {
  const sorted = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });

  const maxScore = sorted[0]?.score || 1;

  return (
    <div className={cn('overflow-hidden rounded-xl border border-border', className)}>
      <ol className="divide-y divide-border">
        {sorted.map((player, index) => {
          const isYou = player.id === currentPlayerId;
          const rank = index + 1;
          const medal = rank <= 3 ? MEDALS[rank - 1] : null;
          const medalRing = rank <= 3 ? MEDAL_RINGS[rank - 1] : null;
          const gradient = avatarGradient(player.name);
          const scorePct = maxScore > 0 ? Math.round((player.score / maxScore) * 100) : 0;
          const answered = showAnswerStatus && currentRound != null && player.answers?.[currentRound];

          return (
            <li
              key={player.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3 transition-colors',
                isYou
                  ? 'bg-primary/10 dark:bg-primary/10'
                  : index === 0
                    ? 'bg-amber-50/60 dark:bg-amber-900/10'
                    : 'hover:bg-muted/40',
              )}
            >
              {/* Rank */}
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  rank <= 3
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {medal ?? rank}
              </span>

              {/* Avatar */}
              <span
                className={cn(
                  'inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white',
                  gradient,
                  medalRing,
                )}
              >
                {player.name.slice(0, 2).toUpperCase()}
              </span>

              {/* Name + score bar */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('truncate text-sm font-semibold', isYou ? 'text-primary' : 'text-foreground')}>
                    {player.name}
                    {isYou && <span className="ml-1 text-xs font-normal text-muted-foreground">(you)</span>}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    {showAnswerStatus && currentRound != null && (
                      <span
                        className={cn(
                          'size-2 rounded-full',
                          answered ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                        )}
                        title={answered ? 'Answered' : 'Waiting'}
                      />
                    )}
                    <span className={cn('text-sm font-bold tabular-nums', isYou ? 'text-primary' : 'text-foreground')}>
                      {player.score.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      rank === 1
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                        : isYou
                          ? 'bg-primary'
                          : 'bg-muted-foreground/40',
                    )}
                    style={{ width: `${scorePct}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
