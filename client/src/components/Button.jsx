import { cn } from '../lib/utils.js';

const variants = {
  default:
    'relative bg-gradient-to-b from-[#FF9B1A] to-[#e67a07] text-white shadow-glow hover:shadow-glow-lg hover:from-[#FFA020] hover:to-[#ea8010] focus-visible:ring-primary active:scale-[0.98] active:shadow-glow-sm overflow-hidden',
  destructive:
    'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 focus-visible:ring-destructive',
  outline:
    'border border-border bg-card/80 shadow-sm backdrop-blur-sm hover:bg-muted hover:text-foreground focus-visible:ring-ring',
  secondary:
    'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/90 focus-visible:ring-ring',
  ghost: 'hover:bg-muted hover:text-foreground focus-visible:ring-ring',
  link: 'text-primary underline-offset-4 hover:underline hover:text-[#e67a07] focus-visible:ring-ring',
};

export function Button({ children, variant = 'default', className = '', disabled, type = 'button', ...rest }) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-base font-bold tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40',
        variant !== 'link' && variant !== 'ghost' && 'shadow-lg',
        variant === 'default' && 'hover:scale-[1.02]',
        variants[variant] ?? variants.default,
        className,
      )}
      {...rest}
    >
      {variant === 'default' && (
        <span
          className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent"
          aria-hidden
        />
      )}
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
}
