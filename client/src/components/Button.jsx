import { cn } from '../lib/utils.js';

const variants = {
  default:
    'bg-primary text-primary-foreground shadow-glow hover:bg-[#e67a07] focus-visible:ring-primary',
  destructive:
    'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 focus-visible:ring-destructive',
  outline:
    'border border-input bg-card/90 shadow-sm backdrop-blur-sm hover:bg-muted hover:text-foreground focus-visible:ring-ring',
  secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/90 focus-visible:ring-ring',
  ghost: 'hover:bg-muted hover:text-foreground focus-visible:ring-ring',
  link: 'text-primary underline-offset-4 hover:underline hover:text-[#e67a07] focus-visible:ring-ring',
};

export function Button({
  children,
  variant = 'default',
  className = '',
  disabled,
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-base font-semibold tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
        variant !== 'link' && 'shadow-lg',
        variant === 'default' && 'hover:scale-[1.02] active:scale-[0.99]',
        variants[variant] ?? variants.default,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
