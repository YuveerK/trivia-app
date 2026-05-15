import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, Eye } from 'lucide-react';
import { Button } from '../components/Button.jsx';
import { Leaderboard } from '../components/Leaderboard.jsx';
import { TimerBar } from '../components/TimerBar.jsx';
import { projectedPoints } from '../lib/scoring.js';
import { socket } from '../lib/socket.js';
import { useGameStore } from '../lib/store.js';
import { cn } from '../lib/utils.js';

const LETTER = (i) => String.fromCharCode(65 + i);

const ANSWER_STYLES = [
  {
    base: 'from-violet-600 to-purple-800 border-violet-500/40',
    hover: 'hover:from-violet-500 hover:to-purple-700 hover:shadow-answer-a',
    selected: 'ring-2 ring-violet-400 shadow-answer-a from-violet-500 to-purple-700',
    badge: 'bg-white/20 text-white',
    label: 'bg-violet-900/30',
  },
  {
    base: 'from-blue-600 to-indigo-800 border-blue-500/40',
    hover: 'hover:from-blue-500 hover:to-indigo-700 hover:shadow-answer-b',
    selected: 'ring-2 ring-blue-400 shadow-answer-b from-blue-500 to-indigo-700',
    badge: 'bg-white/20 text-white',
    label: 'bg-blue-900/30',
  },
  {
    base: 'from-amber-500 to-orange-700 border-amber-400/40',
    hover: 'hover:from-amber-400 hover:to-orange-600 hover:shadow-answer-c',
    selected: 'ring-2 ring-amber-300 shadow-answer-c from-amber-400 to-orange-600',
    badge: 'bg-white/20 text-white',
    label: 'bg-amber-900/30',
  },
  {
    base: 'from-emerald-600 to-teal-800 border-emerald-500/40',
    hover: 'hover:from-emerald-500 hover:to-teal-700 hover:shadow-answer-d',
    selected: 'ring-2 ring-emerald-400 shadow-answer-d from-emerald-500 to-teal-700',
    badge: 'bg-white/20 text-white',
    label: 'bg-emerald-900/30',
  },
];

export default function Question({ code }) {
  const session = useGameStore((s) => s.session);
  const me = useGameStore((s) => s.me);
  const selectedAnswer = useGameStore((s) => s.selectedAnswer);
  const setSelectedAnswer = useGameStore((s) => s.setSelectedAnswer);
  const [lastFeedback, setLastFeedback] = useState(null);

  const round = session?.currentRound ?? 0;
  const q = session?.questions?.[round];
  const total = session?.questions?.length ?? 0;

  const answeredCount = useMemo(() => {
    if (!session?.players) return 0;
    return session.players.filter((p) => p.connected && p.answers?.[round]).length;
  }, [session?.players, round]);

  const connectedCount = useMemo(() => {
    if (!session?.players) return 0;
    return session.players.filter((p) => p.connected).length;
  }, [session?.players]);

  const myPlayer = session?.players?.find((p) => p.id === me?.id);
  const canAnswer = Boolean(myPlayer);
  const myAnswer = myPlayer?.answers?.[round];
  const lockedIdx = canAnswer
    ? typeof myAnswer?.idx === 'number'
      ? myAnswer.idx
      : myAnswer
        ? -1
        : selectedAnswer
    : null;

  useEffect(() => { setLastFeedback(null); }, [round]);

  const duration = session?.roundDuration ?? 20;

  const handlePick = (idx) => {
    if (lockedIdx != null) return;
    setSelectedAnswer(idx);
    const onRecorded = (payload) => {
      socket.off('answer:recorded', onRecorded);
      socket.off('error', onErr);
      setLastFeedback(payload);
    };
    const onErr = (payload) => {
      socket.off('answer:recorded', onRecorded);
      socket.off('error', onErr);
      setSelectedAnswer(null);
      toast.error(payload?.message ?? 'Could not submit answer');
    };
    socket.once('answer:recorded', onRecorded);
    socket.once('error', onErr);
    socket.emit('player:answer', { code, roundIndex: round, optionIndex: idx });
  };

  const showResults = () => {
    const onErr = (payload) => { socket.off('error', onErr); toast.error(payload?.message ?? 'Could not show results'); };
    socket.once('error', onErr);
    socket.emit('host:showResults', { code });
  };

  if (!q) return null;

  const isHost = me?.id === session.hostId;
  const isAnswered = lockedIdx != null;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header row: progress + answer count */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                i < round
                  ? 'w-5 bg-primary/50'
                  : i === round
                    ? 'w-8 bg-primary shadow-glow-sm'
                    : 'w-5 bg-muted',
              )}
            />
          ))}
        </div>
        <span className="rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-bold text-muted-foreground">
          {answeredCount}/{connectedCount} answered
        </span>
      </div>

      {/* Question card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-stage-lg">
        {/* Timer + question label */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Question {round + 1} of {total}
            </span>
          </div>
          <LivePoints roundStart={session.roundStart} durationSec={duration} />
        </div>

        {/* Question text + timer */}
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:gap-6">
          <div className="flex-1">
            <h2 className="text-xl font-bold leading-snug tracking-tight text-foreground sm:text-2xl">
              {q.q}
            </h2>
          </div>
          <div className="shrink-0 self-center sm:self-start">
            <TimerBar roundStart={session.roundStart} durationSec={duration} />
          </div>
        </div>

        {/* Answer buttons */}
        <div className="grid grid-cols-1 gap-3 p-5 pt-0 sm:grid-cols-2">
          {q.options.map((opt, idx) => {
            const style = ANSWER_STYLES[idx % ANSWER_STYLES.length];
            const isSelected = lockedIdx === idx;
            const isCorrect = isSelected && lastFeedback?.correct === true;
            const isWrong = isSelected && lastFeedback?.correct === false;
            const isLockedOut = isAnswered && !isSelected;
            const disabled = !canAnswer || isAnswered;

            return (
              <button
                key={idx}
                type="button"
                disabled={disabled}
                onClick={() => handlePick(idx)}
                className={cn(
                  'group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border bg-gradient-to-br p-4 text-left text-white transition-all duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  style.base,
                  !isAnswered && !disabled && [style.hover, 'hover:scale-[1.02] active:scale-[0.98]'],
                  isSelected && style.selected,
                  isCorrect && 'from-emerald-500 to-teal-600 ring-2 ring-emerald-400 shadow-answer-d',
                  isWrong && 'from-red-600 to-rose-800 ring-2 ring-red-400 opacity-90',
                  isLockedOut && 'opacity-40 saturate-50',
                  disabled && !isSelected && 'cursor-default',
                )}
              >
                {/* Shine overlay */}
                <span
                  className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/15 to-transparent"
                  aria-hidden
                />

                {/* Letter badge */}
                <span
                  className={cn(
                    'relative z-10 flex size-9 shrink-0 items-center justify-center rounded-lg font-bold text-sm',
                    style.badge,
                  )}
                >
                  {isCorrect ? (
                    <CheckCircle2 className="size-5" aria-hidden />
                  ) : isWrong ? (
                    <XCircle className="size-5" aria-hidden />
                  ) : (
                    LETTER(idx)
                  )}
                </span>

                {/* Option text */}
                <span className="relative z-10 flex-1 text-sm font-semibold leading-snug sm:text-base">
                  {opt}
                </span>
              </button>
            );
          })}
        </div>

        {/* Feedback banner */}
        {lastFeedback && (
          <div
            className={cn(
              'animate-slideDown flex items-center gap-3 border-t px-5 py-3 text-sm font-semibold',
              lastFeedback.correct
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200'
                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200',
            )}
          >
            {lastFeedback.correct ? (
              <>
                <CheckCircle2 className="size-5 shrink-0" aria-hidden />
                <span>
                  Correct! +<strong className="animate-scorePop inline-block">{lastFeedback.points}</strong> pts
                  <span className="ml-1 font-normal opacity-70">({lastFeedback.timeLeft?.toFixed?.(1) ?? '?'}s left)</span>
                </span>
              </>
            ) : (
              <>
                <XCircle className="size-5 shrink-0" aria-hidden />
                <span>Incorrect — better luck next round!</span>
              </>
            )}
          </div>
        )}

        {myAnswer?.submitted && !lastFeedback && (
          <div className="flex items-center gap-2 border-t border-border px-5 py-3 text-sm font-semibold text-muted-foreground">
            <span className="inline-block size-2 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
            <span className="inline-block size-2 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
            <span className="inline-block size-2 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
            <span className="ml-1">Answer locked in…</span>
          </div>
        )}

        {!canAnswer && (
          <div className="flex items-center gap-2 border-t border-border px-5 py-3 text-sm text-muted-foreground">
            <Eye className="size-4 shrink-0" aria-hidden />
            Host view — players answer from their own devices.
          </div>
        )}
      </div>

      {isHost && (
        <Button variant="outline" onClick={showResults} className="gap-2">
          <Eye className="size-4" aria-hidden />
          Reveal answers
        </Button>
      )}

      {/* Live leaderboard */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-stage">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h3 className="font-bold text-foreground">Live leaderboard</h3>
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            {answeredCount}/{connectedCount} answered
          </span>
        </div>
        <div className="p-2">
          <Leaderboard
            players={session.players}
            currentPlayerId={me?.id}
            currentRound={round}
            showAnswerStatus
          />
        </div>
      </div>
    </div>
  );
}

function LivePoints({ roundStart, durationSec }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (roundStart == null) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, [roundStart]);

  if (roundStart == null) return null;

  const elapsed = (Date.now() - roundStart) / 1000;
  const timeLeft = Math.max(0, durationSec - elapsed);
  const pts = projectedPoints(timeLeft, durationSec);

  void tick;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
      ~<span className="tabular-nums">{pts}</span> pts now
    </span>
  );
}
