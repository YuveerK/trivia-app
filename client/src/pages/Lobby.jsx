import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, Play, LogOut, Trash2, Wifi, WifiOff } from 'lucide-react';
import { Button } from '../components/Button.jsx';
import { PageShell } from '../components/PageShell.jsx';
import { PlayerBadge, avatarGradient } from '../components/PlayerBadge.jsx';
import { emitWithAck, socket } from '../lib/socket.js';
import {
  clearPendingLeave,
  getPersistedSession,
  queuePendingLeave,
  useGameStore,
} from '../lib/store.js';
import { cn } from '../lib/utils.js';

function canAccessLobby(code, me, session) {
  if (!code) return false;
  const persisted = getPersistedSession();
  if (persisted?.code === code && persisted?.me?.reconnectToken) return true;
  if (me && session?.code === code) return true;
  return false;
}

export default function Lobby() {
  const { code } = useParams();
  const navigate = useNavigate();
  const session = useGameStore((s) => s.session);
  const me = useGameStore((s) => s.me);
  const reset = useGameStore((s) => s.reset);
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    if (!canAccessLobby(code, me, session)) navigate('/', { replace: true });
  }, [code, me, session, navigate]);

  useEffect(() => {
    if (!session || session.code !== code) return;
    if (session.phase === 'final') { navigate(`/final/${code}`, { replace: true }); return; }
    if (session.phase !== 'lobby') navigate(`/play/${code}`, { replace: true });
  }, [session, code, navigate]);

  const leave = async () => {
    if (pendingAction) return;
    setPendingAction('leave');
    queuePendingLeave(code, me);
    try {
      if (connectionStatus === 'connected') {
        await emitWithAck('player:leave', { code }, { attempts: 1, timeout: 3_000 });
        clearPendingLeave();
      }
    } catch (error) {
      toast.error(error.message ?? 'The server could not confirm that you left.');
      if (socket.connected) {
        socket.disconnect();
        socket.connect();
      }
    } finally {
      reset();
      navigate('/');
      setPendingAction(null);
    }
  };

  const start = async () => {
    if (pendingAction) return;
    setPendingAction('start');
    try {
      await emitWithAck('host:start', { code });
    } catch (error) {
      toast.error(error.message ?? 'Could not start');
    } finally {
      setPendingAction(null);
    }
  };

  const endSession = async () => {
    if (pendingAction) return;
    setPendingAction('end');
    try { await emitWithAck('host:end', { code }); }
    catch (error) { toast.error(error.message ?? 'Could not end the session'); }
    finally { setPendingAction(null); }
  };

  if (!session || session.code !== code) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-muted-foreground">
        <div className="relative">
          <div className="absolute inset-0 animate-pulseRing rounded-full border-2 border-primary" />
          <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
        </div>
        <p className="text-sm font-semibold">Loading lobby…</p>
      </div>
    );
  }

  const isHost = me?.id === session.hostId;
  const minimumPlayers = session.hostParticipates ? 2 : 1;
  const playerCount = session.players.length;
  const connectedPlayerCount = session.players.filter((player) => player.connected && !player.departed).length;
  const canStart = connectedPlayerCount >= minimumPlayers;

  return (
    <PageShell maxWidthClass="max-w-md" className="space-y-8 py-6 sm:py-10">

      {/* Join code */}
      <div className="animate-fadeIn text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Room code</p>
        <div className="mt-4 flex items-center justify-center gap-2.5">
          {session.code.split('').map((char, i) => (
            <div
              key={i}
              className="animate-bounceIn flex size-16 items-center justify-center rounded-2xl border-2 border-primary/40 bg-card shadow-glow-sm sm:size-20"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="font-mono text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
                {char}
              </span>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-4 max-w-xs text-sm text-muted-foreground">
          Share this code with others — they can join from <span className="font-semibold text-foreground">any device</span>.
        </p>
      </div>

      {/* Host info (when not playing) */}
      {!session.hostParticipates && (
        <div className="animate-scaleIn rounded-2xl border border-border bg-card/80 p-4 shadow-stage backdrop-blur-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Host (spectator)</p>
          <p className="mt-1 text-lg font-bold text-foreground">
            {session.hostName}
            {isHost && <span className="ml-2 text-sm font-normal text-primary">(you)</span>}
          </p>
        </div>
      )}

      {/* Player list */}
      <div className="animate-scaleIn overflow-hidden rounded-2xl border border-border bg-card shadow-stage">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-bold text-foreground">Players</h2>
          <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">
            {playerCount} {playerCount === 1 ? 'player' : 'players'}
          </span>
        </div>
        <ul className="divide-y divide-border">
          {session.players.map((p, i) => (
            <li
              key={p.id}
              className={cn(
                'animate-slideInRight flex items-center justify-between gap-3 px-5 py-3.5',
                p.id === me?.id && 'bg-primary/5',
              )}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <PlayerBadge name={p.name} isHost={p.id === session.hostId} isYou={p.id === me?.id} />
              {p.connected ? (
                <Wifi className="size-4 shrink-0 text-emerald-500" aria-label="Connected" />
              ) : (
                <div className="flex items-center gap-1.5">
                  <WifiOff className="size-4 shrink-0 text-amber-500" aria-hidden />
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Reconnecting</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Waiting state (non-host) */}
      {!isHost && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-6 text-center">
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-2 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
            <span className="inline-block size-2 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
            <span className="inline-block size-2 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">Waiting for the host to start…</p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        {isHost && (
          <Button
            onClick={start}
            disabled={!canStart || Boolean(pendingAction) || connectionStatus !== 'connected'}
            className="gap-2 text-lg"
          >
            <Play className="size-5 fill-white" aria-hidden />
            {pendingAction === 'start' ? 'Starting…' : canStart ? 'Start game' : `Need ${minimumPlayers - connectedPlayerCount} more connected player${minimumPlayers - connectedPlayerCount !== 1 ? 's' : ''}`}
          </Button>
        )}
        {isHost && (
          <Button variant="destructive" onClick={endSession} className="gap-2" disabled={Boolean(pendingAction) || connectionStatus !== 'connected'}>
            <Trash2 className="size-4" aria-hidden />
            End session for everyone
          </Button>
        )}
        <Button variant="outline" onClick={leave} className="gap-2" disabled={Boolean(pendingAction)}>
          <LogOut className="size-4" aria-hidden />
          Leave session
        </Button>
      </div>
    </PageShell>
  );
}
