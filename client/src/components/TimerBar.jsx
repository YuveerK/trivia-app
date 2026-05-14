import { useEffect, useState } from 'react';
import { cn } from '../lib/utils.js';

export function TimerBar({ roundStart, durationSec }) {
  const [timeLeft, setTimeLeft] = useState(durationSec);

  useEffect(() => {
    if (roundStart == null) return undefined;

    const tick = () => {
      const elapsed = (Date.now() - roundStart) / 1000;
      setTimeLeft(Math.max(0, durationSec - elapsed));
    };

    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [roundStart, durationSec]);

  const pct = durationSec > 0 ? Math.min(100, (timeLeft / durationSec) * 100) : 0;
  const urgent = timeLeft <= 5 && timeLeft > 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm font-medium text-muted-foreground">
        <span>Time left</span>
        <span className={cn('tabular-nums text-foreground', urgent && 'text-destructive')}>
          {timeLeft.toFixed(1)}s
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-100 ease-linear',
            urgent ? 'bg-destructive' : 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
