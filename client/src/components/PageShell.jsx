import { cn } from '../lib/utils.js';

export function PageShell({ children, className = '', maxWidthClass = 'max-w-5xl' }) {
  return (
    <div className={cn('relative z-10 mx-auto w-full px-4 py-8 sm:px-6 lg:px-8', maxWidthClass, className)}>
      {children}
    </div>
  );
}
