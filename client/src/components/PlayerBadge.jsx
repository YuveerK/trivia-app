import { cn } from '../lib/utils.js';

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-amber-400 to-orange-500',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
];

export function avatarGradient(name) {
  return AVATAR_GRADIENTS[(name?.charCodeAt(0) ?? 0) % AVATAR_GRADIENTS.length];
}

export function PlayerBadge({ name, isHost, isYou }) {
  const gradient = avatarGradient(name);
  const initials = name
    ? name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <span className="inline-flex items-center gap-2.5 text-foreground">
      <span
        className={cn(
          'inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white shadow-sm',
          gradient,
        )}
        aria-hidden
      >
        {initials}
      </span>
      <span className="font-semibold">{name}</span>
      {isHost && (
        <span className="rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
          Host
        </span>
      )}
      {isYou && (
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          You
        </span>
      )}
    </span>
  );
}
