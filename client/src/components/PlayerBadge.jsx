import { cn } from '../lib/utils.js';

export function PlayerBadge({ name, isHost, isYou }) {
  return (
    <span className="inline-flex items-center gap-2 text-foreground">
      <span className="font-medium">{name}</span>
      {isHost && (
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          Host
        </span>
      )}
      {isYou && (
        <span
          className={cn(
            'rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground',
          )}
        >
          You
        </span>
      )}
    </span>
  );
}
