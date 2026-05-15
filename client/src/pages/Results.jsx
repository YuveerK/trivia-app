import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, ChevronRight, Flag } from 'lucide-react';
import { Button } from '../components/Button.jsx';
import { Leaderboard } from '../components/Leaderboard.jsx';
import { socket } from '../lib/socket.js';
import { useGameStore } from '../lib/store.js';
import { cn } from '../lib/utils.js';

const ANSWER_COLORS = [
  'border-violet-500/30 bg-gradient-to-br from-violet-600 to-purple-800',
  'border-blue-500/30 bg-gradient-to-br from-blue-600 to-indigo-800',
  'border-amber-500/30 bg-gradient-to-br from-amber-500 to-orange-700',
  'border-emerald-500/30 bg-gradient-to-br from-emerald-600 to-teal-800',
];

export default function Results({ code }) {
  const session = useGameStore((s) => s.session);
  const me = useGameStore((s) => s.me);

  const round = session?.currentRound ?? 0;
  const q = session?.questions?.[round];
  const total = session?.questions?.length ?? 0;
  const myPlayer = session?.players?.find((p) => p.id === me?.id);
  const ans = myPlayer?.answers?.[round];
  const isHost = me?.id === session.hostId;
  const isLast = round >= total - 1;

  const next = () => {
    const onErr = (payload) => { socket.off('error', onErr); toast.error(payload?.message ?? 'Could not advance'); };
    socket.once('error', onErr);
    socket.emit('host:nextRound', { code });
  };

  if (!q) return null;

  const correctIdx = q.correct;
  const myAnswerIdx = typeof ans?.idx === 'number' ? ans.idx : null;
  const didAnswer = myPlayer && ans;
  const wasCorrect = didAnswer && ans.correct;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Correct answer reveal */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-stage-lg">
        {/* Header */}
        <div className="border-b border-border bg-muted/40 px-5 py-3.5">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Question {round + 1} of {total} — Results
          </span>
          <h2 className="mt-1.5 text-lg font-bold leading-snug text-foreground sm:text-xl">{q.q}</h2>
        </div>

        {/* Answer options */}
        <div className="space-y-2.5 p-5">
          {q.options.map((opt, idx) => {
            const isCorrect = idx === correctIdx;
            const wasMyAnswer = idx === myAnswerIdx;
            const wrongAnswer = wasMyAnswer && !isCorrect;

            return (
              <div
                key={idx}
                className={cn(
                  'animate-slideUp relative flex items-center gap-3 overflow-hidden rounded-xl border px-4 py-3.5 transition-all',
                  isCorrect
                    ? 'border-emerald-400/50 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-answer-d'
                    : wrongAnswer
                      ? 'border-red-400/30 bg-gradient-to-r from-red-600/80 to-rose-800/80 text-white/80 opacity-80'
                      : 'border-border bg-muted/30 text-foreground/50',
                )}
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                {isCorrect && (
                  <span
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_20%_-10%,rgba(255,255,255,0.2),transparent_60%)]"
                    aria-hidden
                  />
                )}

                {/* Status icon or letter badge */}
                <span
                  className={cn(
                    'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
                    isCorrect
                      ? 'bg-white/20 text-white'
                      : wrongAnswer
                        ? 'bg-white/10 text-white/80'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {isCorrect ? (
                    <CheckCircle2 className="size-5" aria-hidden />
                  ) : wrongAnswer ? (
                    <XCircle className="size-5" aria-hidden />
                  ) : (
                    String.fromCharCode(65 + idx)
                  )}
                </span>

                <span className="relative z-10 flex-1 text-sm font-semibold leading-snug sm:text-base">
                  {opt}
                </span>

                {isCorrect && (
                  <span className="relative z-10 shrink-0 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide">
                    Correct!
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Personal result */}
        <div
          className={cn(
            'flex items-center gap-4 border-t px-5 py-4',
            wasCorrect
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30'
              : didAnswer
                ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30'
                : 'border-border bg-muted/30',
          )}
        >
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-full',
              wasCorrect
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                : didAnswer
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {wasCorrect ? (
              <CheckCircle2 className="size-5" aria-hidden />
            ) : didAnswer ? (
              <XCircle className="size-5" aria-hidden />
            ) : (
              <span className="text-sm font-bold">—</span>
            )}
          </div>
          <div className="flex-1">
            <p
              className={cn(
                'text-sm font-bold',
                wasCorrect
                  ? 'text-emerald-800 dark:text-emerald-200'
                  : didAnswer
                    ? 'text-red-800 dark:text-red-200'
                    : 'text-muted-foreground',
              )}
            >
              {myPlayer
                ? wasCorrect
                  ? `You got it! +${ans.points} pts`
                  : didAnswer
                    ? 'Incorrect — 0 pts this round'
                    : 'No answer recorded'
                : 'Host view'}
            </p>
            {wasCorrect && (
              <p className="mt-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Answered in {ans.time.toFixed(1)}s
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-stage">
        <div className="border-b border-border px-5 py-3.5">
          <h3 className="font-bold text-foreground">Standings after round {round + 1}</h3>
        </div>
        <div className="p-2">
          <Leaderboard players={session.players} currentPlayerId={me?.id} />
        </div>
      </div>

      {isHost && (
        <Button onClick={next} className="gap-2 text-base">
          {isLast ? (
            <>
              <Flag className="size-5" aria-hidden />
              Show final results
            </>
          ) : (
            <>
              Next question
              <ChevronRight className="size-5" aria-hidden />
            </>
          )}
        </Button>
      )}
    </div>
  );
}
