import { cn } from '../lib/utils.js';

export function Input({ className = '', pill = false, ...rest }) {
  return (
    <input
      className={cn(
        'w-full border-2 border-border bg-input px-4 py-3 font-sans text-base text-foreground shadow-[inset_0_1px_2px_hsl(218_17%_17%/0.04)] transition-all placeholder:text-muted-foreground focus-visible:border-charleston focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.25)]',
        pill ? 'rounded-full' : 'rounded-md',
        className,
      )}
      {...rest}
    />
  );
}
