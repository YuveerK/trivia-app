import { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { PageShell } from '../components/PageShell.jsx';
import { getPersistedSession, useGameStore } from '../lib/store.js';
import { cn } from '../lib/utils.js';

function canAccessFinal(code, me, session) {
  if (!code) return false;
  const persisted = getPersistedSession();
  if (persisted?.code === code && persisted?.me) return true;
  if (me && session?.code === code) return true;
  return false;
}

const medals = ['🥇', '🥈', '🥉'];

export default function Final() {
  const { code } = useParams();
  const navigate = useNavigate();
  const session = useGameStore((s) => s.session);
  const me = useGameStore((s) => s.me);
  const reset = useGameStore((s) => s.reset);

  const rows = useMemo(() => {
    if (!session?.players) return [];
    const totalQ = session.questions?.length ?? 0;
    return [...session.players]
      .map((p) => {
        let correct = 0;
        for (let i = 0; i < totalQ; i++) {
          if (p.answers?.[i]?.correct) correct += 1;
        }
        return { ...p, correct, totalQ };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.name.localeCompare(b.name);
      });
  }, [session?.players, session?.questions?.length]);

  if (!canAccessFinal(code, me, session)) {
    return <Navigate to="/" replace />;
  }

  if (!session || session.code !== code) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-9 animate-spin text-primary" aria-hidden />
        <p className="text-sm font-medium">Loading results…</p>
      </div>
    );
  }

  if (session.phase !== 'final') {
    if (session.phase === 'lobby') {
      return <Navigate to={`/lobby/${code}`} replace />;
    }
    return <Navigate to={`/play/${code}`} replace />;
  }

  const newGame = () => {
    reset();
    navigate('/');
  };

  return (
    <PageShell maxWidthClass="max-w-2xl" className="space-y-8 py-10">
      <header className="text-center animate-fadeIn">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Final ranking</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          Full standings for this tournament.
        </p>
      </header>

      <Card elevated className="overflow-hidden p-0 animate-scaleIn">
        <ul className="divide-y divide-border">
          {rows.map((p, index) => {
            const rank = index + 1;
            const medal = rank <= 3 ? medals[rank - 1] : '';
            const isTop = rank === 1;
            return (
              <li
                key={p.id}
                className={cn(
                  'flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/40',
                  isTop && 'bg-gradient-to-r from-primary/10 to-transparent',
                  p.id === me?.id && 'bg-accent/30',
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="w-8 shrink-0 text-center text-lg font-bold tabular-nums text-muted-foreground">
                    {rank}
                  </span>
                  <span className="text-xl leading-none" aria-hidden>
                    {medal}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold text-foreground">
                      {p.name}
                      {p.id === me?.id && (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">(you)</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {p.correct} / {p.totalQ} correct
                    </p>
                  </div>
                </div>
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {p.score}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">pts</span>
                </p>
              </li>
            );
          })}
        </ul>
      </Card>

      <Button onClick={newGame}>NEW GAME</Button>
    </PageShell>
  );
}
