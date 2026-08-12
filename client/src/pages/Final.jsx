import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Loader2, RotateCcw, Star } from 'lucide-react';
import { Button } from '../components/Button.jsx';
import { PageShell } from '../components/PageShell.jsx';
import { avatarGradient } from '../components/PlayerBadge.jsx';
import {
  clearPendingLeave,
  getPersistedSession,
  queuePendingLeave,
  useGameStore,
} from '../lib/store.js';
import { cn } from '../lib/utils.js';
import { emitWithAck, socket } from '../lib/socket.js';

function canAccessFinal(code, me, session) {
  if (!code) return false;
  const persisted = getPersistedSession();
  if (persisted?.code === code && persisted?.me?.reconnectToken) return true;
  if (me && session?.code === code) return true;
  return false;
}

const MEDAL_CONFIG = [
  {
    emoji: '🥇',
    podiumH: 'h-24',
    ring: 'ring-2 ring-amber-400/70',
    bg: 'from-amber-400 to-yellow-500',
    label: 'bg-amber-400/20 text-amber-600 dark:text-amber-300',
    glow: 'shadow-gold',
    rankLabel: '1ST',
  },
  {
    emoji: '🥈',
    podiumH: 'h-16',
    ring: 'ring-2 ring-slate-400/60',
    bg: 'from-slate-400 to-slate-500',
    label: 'bg-slate-400/20 text-slate-600 dark:text-slate-300',
    glow: '',
    rankLabel: '2ND',
  },
  {
    emoji: '🥉',
    podiumH: 'h-12',
    ring: 'ring-2 ring-amber-700/50',
    bg: 'from-amber-600 to-orange-700',
    label: 'bg-amber-600/20 text-amber-700 dark:text-amber-400',
    glow: '',
    rankLabel: '3RD',
  },
];

export default function Final() {
  const { code } = useParams();
  const navigate = useNavigate();
  const session = useGameStore((s) => s.session);
  const me = useGameStore((s) => s.me);
  const reset = useGameStore((s) => s.reset);
  const [leaving, setLeaving] = useState(false);

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

  if (!canAccessFinal(code, me, session)) return <Navigate to="/" replace />;

  if (!session || session.code !== code) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-muted-foreground">
        <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
        <p className="text-sm font-semibold">Loading results…</p>
      </div>
    );
  }

  if (session.phase !== 'final') {
    if (session.phase === 'lobby') return <Navigate to={`/lobby/${code}`} replace />;
    return <Navigate to={`/play/${code}`} replace />;
  }

  const newGame = async () => {
    if (leaving) return;
    setLeaving(true);
    queuePendingLeave(code, me);
    try {
      if (socket.connected) {
        await emitWithAck('player:leave', { code }, { attempts: 1, timeout: 3_000 });
        clearPendingLeave();
      }
    } catch {
      // Disconnect cleanup is the fallback; local state must still be cleared.
    } finally {
      reset();
      navigate('/');
      setLeaving(false);
    }
  };
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  // Podium order: 2nd, 1st, 3rd
  const podiumOrder = [1, 0, 2].filter((i) => top3[i] !== undefined).map((i) => ({ ...top3[i], medalIdx: i }));

  return (
    <PageShell maxWidthClass="max-w-2xl" className="space-y-8 pb-24 py-6 sm:py-10">
      {/* Header */}
      <header className="animate-fadeIn text-center">
        <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-gold">
          <Star className="size-8 fill-white text-white" aria-hidden />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Tournament Complete!
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Here are the final standings for this session.
        </p>
      </header>

      {/* Podium (top 3) */}
      {top3.length > 0 && (
        <div className="animate-scaleIn rounded-2xl border border-border bg-card p-6 shadow-stage-lg">
          <div className="flex items-end justify-center gap-4">
            {podiumOrder.map(({ medalIdx, ...player }) => {
              const cfg = MEDAL_CONFIG[medalIdx];
              const isMe = player.id === me?.id;
              const gradient = avatarGradient(player.name);

              return (
                <div
                  key={player.id}
                  className={cn(
                    'animate-riseUp flex flex-col items-center gap-2',
                    medalIdx === 0 ? 'order-2 z-10' : medalIdx === 1 ? 'order-1' : 'order-3',
                  )}
                  style={{ animationDelay: `${[200, 0, 400][medalIdx]}ms` }}
                >
                  {/* Player info above podium */}
                  <div className="flex flex-col items-center gap-1.5 px-2">
                    <span className="text-2xl leading-none" aria-hidden>{cfg.emoji}</span>
                    <span
                      className={cn(
                        'inline-flex size-12 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white',
                        gradient,
                        cfg.ring,
                        cfg.glow,
                        medalIdx === 0 && 'size-14 text-base',
                      )}
                    >
                      {player.name.slice(0, 2).toUpperCase()}
                    </span>
                    <p className={cn('max-w-[80px] truncate text-center text-xs font-bold text-foreground', medalIdx === 0 && 'text-sm')}>
                      {player.name}
                      {isMe && <span className="ml-1 text-[10px] text-muted-foreground">(you)</span>}
                    </p>
                    <p className={cn('text-xs font-semibold tabular-nums', cfg.label)}>
                      {player.score.toLocaleString()} pts
                    </p>
                  </div>

                  {/* Podium block */}
                  <div
                    className={cn(
                      'w-20 rounded-t-xl bg-gradient-to-b from-muted to-muted/50 flex items-center justify-center',
                      cfg.podiumH,
                    )}
                  >
                    <span className={cn('text-xs font-black tracking-widest opacity-40', cfg.label)}>
                      {cfg.rankLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full rankings */}
      <div className="animate-slideUp delay-300 overflow-hidden rounded-2xl border border-border bg-card shadow-stage">
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="font-bold text-foreground">Full standings</h2>
        </div>
        <ul className="divide-y divide-border">
          {rows.map((p, index) => {
            const rank = index + 1;
            const medal = rank <= 3 ? MEDAL_CONFIG[rank - 1].emoji : null;
            const isMe = p.id === me?.id;
            const gradient = avatarGradient(p.name);

            return (
              <li
                key={p.id}
                className={cn(
                  'animate-slideInRight flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors',
                  rank === 1 && 'bg-gradient-to-r from-amber-50/80 to-transparent dark:from-amber-900/15',
                  isMe && 'bg-primary/8 dark:bg-primary/10',
                )}
                style={{ animationDelay: `${Math.min(index * 60, 400)}ms` }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-8 shrink-0 text-center text-sm font-extrabold tabular-nums text-muted-foreground">
                    {medal ?? rank}
                  </span>
                  <span
                    className={cn(
                      'inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white',
                      gradient,
                      rank === 1 && 'ring-2 ring-amber-400/60',
                    )}
                  >
                    {p.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className={cn('truncate font-semibold', isMe ? 'text-primary' : 'text-foreground')}>
                      {p.name}
                      {isMe && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.correct}/{p.totalQ} correct
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn('font-extrabold tabular-nums', rank === 1 ? 'text-lg text-amber-500' : 'text-foreground')}>
                    {p.score.toLocaleString()}
                    <span className="ml-1 text-xs font-semibold text-muted-foreground">pts</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <Button onClick={newGame} className="gap-2 text-base" disabled={leaving}>
        <RotateCcw className="size-5" aria-hidden />
        Play again
      </Button>
    </PageShell>
  );
}
