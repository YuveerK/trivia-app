import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { Leaderboard } from '../components/Leaderboard.jsx';
import { TimerBar } from '../components/TimerBar.jsx';
import { projectedPoints } from '../lib/scoring.js';
import { socket } from '../lib/socket.js';
import { useGameStore } from '../lib/store.js';
import { cn } from '../lib/utils.js';

const letter = (i) => String.fromCharCode(65 + i);

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

  useEffect(() => {
    setLastFeedback(null);
  }, [round]);

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
    const onErr = (payload) => {
      socket.off('error', onErr);
      toast.error(payload?.message ?? 'Could not show results');
    };
    socket.once('error', onErr);
    socket.emit('host:showResults', { code });
  };

  if (!q) return null;

  const isHost = me?.id === session.hostId;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">
          Question {round + 1} of {total}
        </span>
        <span className="tabular-nums">
          {answeredCount}/{connectedCount} answered
        </span>
      </div>

      <Card elevated className="p-6">
        <div className="mb-6">
          <TimerBar roundStart={session.roundStart} durationSec={duration} />
        </div>
        <LivePoints roundStart={session.roundStart} durationSec={duration} />
        <h2 className="mb-6 text-2xl font-semibold leading-snug tracking-tight text-foreground">{q.q}</h2>
        <div className="grid gap-3">
          {q.options.map((opt, idx) => {
            const isSelected = lockedIdx === idx;
            const disabled = !canAnswer || lockedIdx != null;
            return (
              <button
                key={idx}
                type="button"
                disabled={disabled}
                onClick={() => handlePick(idx)}
                className={cn(
                  'flex w-full items-stretch gap-4 rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md',
                  isSelected && 'border-primary bg-accent ring-2 ring-ring/30',
                  disabled && !isSelected && 'opacity-50',
                )}
              >
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-md border text-sm font-semibold',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-muted text-muted-foreground',
                  )}
                >
                  {letter(idx)}
                </span>
                <span className="flex flex-1 items-center text-base font-medium text-foreground">{opt}</span>
              </button>
            );
          })}
        </div>
        {lastFeedback && (
          <p className="mt-4 text-sm text-muted-foreground">
            {lastFeedback.correct
              ? `Correct! +${lastFeedback.points} pts (${lastFeedback.timeLeft?.toFixed?.(1) ?? '?'}s left)`
              : 'Incorrect — 0 pts'}
          </p>
        )}
        {myAnswer?.submitted && !lastFeedback && (
          <p className="mt-4 text-sm text-muted-foreground">Answer submitted.</p>
        )}
        {!canAnswer && (
          <p className="mt-4 text-sm text-muted-foreground">
            Host view: participants answer from their own devices.
          </p>
        )}
      </Card>

      {isHost && (
        <Button variant="outline" onClick={showResults}>
          Show results
        </Button>
      )}

      <Card elevated className="p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-foreground">Live leaderboard</h3>
          <span className="text-sm font-medium tabular-nums text-muted-foreground">
            {answeredCount}/{connectedCount}
          </span>
        </div>
        <Leaderboard
          players={session.players}
          currentPlayerId={me?.id}
          currentRound={round}
          showAnswerStatus
        />
      </Card>
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
    <p className="mb-4 text-sm text-muted-foreground">
      Correct answer now:{' '}
      <span className="font-semibold tabular-nums text-primary">~{pts}</span> pts
    </p>
  );
}
