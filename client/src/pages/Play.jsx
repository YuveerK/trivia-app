import { Navigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { PageShell } from '../components/PageShell.jsx';
import { socket } from '../lib/socket.js';
import { getPersistedSession, useGameStore } from '../lib/store.js';
import { cn } from '../lib/utils.js';
import Question from './Question.jsx';
import Results from './Results.jsx';

function canAccessPlay(code, me, session) {
  if (!code) return false;
  const persisted = getPersistedSession();
  if (persisted?.code === code && persisted?.me) return true;
  if (me && session?.code === code) return true;
  return false;
}

export default function Play() {
  const { code } = useParams();
  const session = useGameStore((s) => s.session);
  const me = useGameStore((s) => s.me);
  const setSelectedAnswer = useGameStore((s) => s.setSelectedAnswer);
  const isHost = me?.id === session?.hostId;

  useEffect(() => {
    setSelectedAnswer(null);
  }, [session?.phase, session?.currentRound, setSelectedAnswer]);

  if (!canAccessPlay(code, me, session)) {
    return <Navigate to="/" replace />;
  }

  if (!session || session.code !== code) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-9 animate-spin text-primary" aria-hidden />
        <p className="text-sm font-medium">Loading game…</p>
      </div>
    );
  }

  if (session.phase === 'lobby') {
    return <Navigate to={`/lobby/${code}`} replace />;
  }

  if (session.phase === 'final') {
    return <Navigate to={`/final/${code}`} replace />;
  }

  return (
    <PageShell maxWidthClass="max-w-2xl" className="space-y-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border border-border bg-card/95 px-4 py-4 shadow-stage backdrop-blur-sm sm:rounded-lg sm:px-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Live game</p>
          <p className="mt-1 text-sm text-foreground">
            Room <span className="font-mono font-semibold text-primary">{session.code}</span>
          </p>
        </div>
        {isHost && (
          <button
            type="button"
            className={cn(
              'text-sm font-medium text-primary underline-offset-4 transition-colors hover:text-[#e67a07] hover:underline',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            )}
            onClick={() => socket.emit('host:end', { code })}
          >
            End session
          </button>
        )}
      </header>

      {session.hostDisconnected && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
        >
          <p className="font-semibold">Host disconnected</p>
          <p className="mt-1 text-muted-foreground dark:text-amber-100/90">
            Waiting for them to return. The round timer is paused.
          </p>
        </div>
      )}

      {session.phase === 'question' && <Question code={code} />}
      {session.phase === 'results' && <Results code={code} />}
    </PageShell>
  );
}
