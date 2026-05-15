import { cn } from '../lib/utils.js';

export function Input({ className = '', pill = false, ...rest }) {
  return (
    <input
      className={cn(
        'w-full border-2 border-border bg-input px-4 py-3 font-sans text-base text-foreground shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        pill ? 'rounded-full' : 'rounded-xl',
        className,
      )}
      {...rest}
    />
  );
}
