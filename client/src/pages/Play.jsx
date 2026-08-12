import { Navigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, WifiOff } from 'lucide-react';
import { PageShell } from '../components/PageShell.jsx';
import { emitWithAck } from '../lib/socket.js';
import { getPersistedSession, useGameStore } from '../lib/store.js';
import { cn } from '../lib/utils.js';
import Question from './Question.jsx';
import Results from './Results.jsx';

function canAccessPlay(code, me, session) {
  if (!code) return false;
  const persisted = getPersistedSession();
  if (persisted?.code === code && persisted?.me?.reconnectToken) return true;
  if (me && session?.code === code) return true;
  return false;
}

export default function Play() {
  const { code } = useParams();
  const session = useGameStore((s) => s.session);
  const me = useGameStore((s) => s.me);
  const setSelectedAnswer = useGameStore((s) => s.setSelectedAnswer);
  const isHost = me?.id === session?.hostId;
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    setSelectedAnswer(null);
  }, [session?.phase, session?.currentRound, setSelectedAnswer]);

  if (!canAccessPlay(code, me, session)) return <Navigate to="/" replace />;

  if (!session || session.code !== code) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-muted-foreground">
        <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
        <p className="text-sm font-semibold">Loading game…</p>
      </div>
    );
  }

  if (session.phase === 'lobby') return <Navigate to={`/lobby/${code}`} replace />;
  if (session.phase === 'final') return <Navigate to={`/final/${code}`} replace />;

  const round = session.currentRound ?? 0;
  const total = session.questions?.length ?? 0;

  const endSession = async () => {
    if (ending) return;
    setEnding(true);
    try { await emitWithAck('host:end', { code }); }
    catch (error) { toast.error(error.message ?? 'Could not end the session'); }
    finally { setEnding(false); }
  };

  return (
    <PageShell maxWidthClass="max-w-2xl" className="space-y-5 py-4 sm:py-6">
      {/* Sticky game bar */}
      <div className="sticky top-16 z-40 -mx-4 max-w-none overflow-hidden rounded-none border-b border-border bg-card/95 px-4 py-3 shadow-stage backdrop-blur-md sm:-mx-6 sm:rounded-xl sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Live game
              </p>
              <p className="break-words text-sm font-bold text-foreground">
                Room{' '}
                <span className="font-mono text-primary">{session.code}</span>
                <span className="ml-2 text-muted-foreground font-normal">
                  · Round {round + 1}/{total}
                </span>
              </p>
            </div>
          </div>
          {isHost && (
            <button
              type="button"
              className={cn(
                'shrink-0 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive transition-all hover:bg-destructive/20',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2',
              )}
              onClick={endSession}
              disabled={ending || connectionStatus !== 'connected'}
            >
              End session
            </button>
          )}
        </div>
      </div>

      {/* Host disconnected banner */}
      {session.hostDisconnected && (
        <div
          role="status"
          className="animate-slideDown flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 dark:border-amber-900/40 dark:bg-amber-950/30"
        >
          <WifiOff className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <div>
            <p className="text-sm font-bold text-amber-900 dark:text-amber-100">Host disconnected</p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
              Waiting for them to return. The round timer is paused.
            </p>
          </div>
        </div>
      )}

      {session.phase === 'question' && <Question code={code} />}
      {session.phase === 'results' && <Results code={code} />}
    </PageShell>
  );
}
