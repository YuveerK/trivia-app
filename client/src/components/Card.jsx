import { cn } from '../lib/utils.js';

export function Card({ children, className = '', elevated = false, glass = false }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card text-card-foreground transition-shadow duration-300',
        elevated && 'shadow-stage hover:shadow-stage-lg',
        glass && [
          'border-white/10 bg-white/[0.06] backdrop-blur-xl dark:bg-white/[0.04]',
          'shadow-glass',
        ],
        className,
      )}
    >
      {children}
    </div>
  );
}
