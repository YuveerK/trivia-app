import { cn } from '../lib/utils.js';

export function Card({ children, className = '', elevated = false }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-shadow duration-300',
        elevated && 'shadow-stage hover:shadow-stage-lg',
        className,
      )}
    >
      {children}
    </div>
  );
}
