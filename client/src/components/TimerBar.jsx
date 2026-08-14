import { useEffect, useState } from 'react';
import { cn } from '../lib/utils.js';

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function TimerBar({ remainingMs, durationSec }) {
  const [timeLeft, setTimeLeft] = useState(Math.max(0, remainingMs / 1000));

  useEffect(() => {
    const initial = Math.max(0, remainingMs / 1000);
    setTimeLeft(initial);
    const startedAt = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      setTimeLeft(Math.max(0, initial - elapsed));
    };
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [remainingMs]);

  const pct = durationSec > 0 ? Math.min(100, (timeLeft / durationSec) * 100) : 0;
  const strokeDashoffset = CIRCUMFERENCE * (1 - pct / 100);
  const urgent = timeLeft <= 5 && timeLeft > 0;
  const critical = timeLeft <= 3 && timeLeft > 0;

  const trackColor = 'hsl(var(--muted))';
  const progressColor = urgent
    ? critical ? '#ef4444' : '#f97316'
    : 'hsl(var(--primary))';

  return (
    <div className={cn('relative flex flex-col items-center', urgent && 'animate-timerUrgent')}>
      <div className="relative size-28">
        {urgent && (
          <span
            className="absolute inset-0 animate-pulseRing rounded-full"
            style={{ border: `3px solid ${progressColor}`, opacity: 0.6 }}
            aria-hidden
          />
        )}
        <svg
          viewBox="0 0 100 100"
          className="size-full -rotate-90"
          aria-hidden
        >
          <circle
            cx="50" cy="50" r={RADIUS}
            fill="none"
            stroke={trackColor}
            strokeWidth="8"
          />
          <circle
            cx="50" cy="50" r={RADIUS}
            fill="none"
            stroke={progressColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              'text-3xl font-extrabold tabular-nums leading-none',
              urgent ? 'text-destructive' : 'text-foreground',
            )}
          >
            {Math.ceil(timeLeft)}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            sec
          </span>
        </div>
      </div>
    </div>
  );
}
