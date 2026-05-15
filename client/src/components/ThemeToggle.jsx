import { Moon, Sun } from 'lucide-react';
import { cn } from '../lib/utils.js';

export function ThemeToggle({ className }) {
  const toggle = () => {
    const root = document.documentElement;
    root.classList.toggle('dark');
    try {
      localStorage.setItem('theme', root.classList.contains('dark') ? 'dark' : 'light');
    } catch (_) {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'inline-flex size-10 items-center justify-center rounded-full border border-border bg-card/90 text-muted-foreground shadow-stage backdrop-blur-md transition-all hover:bg-muted hover:text-foreground hover:shadow-stage-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
      aria-label="Toggle color theme"
    >
      <Sun className="size-4 dark:hidden" aria-hidden />
      <Moon className="hidden size-4 dark:inline" aria-hidden />
    </button>
  );
}
