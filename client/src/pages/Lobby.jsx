import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { PageShell } from '../components/PageShell.jsx';
import { PlayerBadge } from '../components/PlayerBadge.jsx';
import { socket } from '../lib/socket.js';
import { getPersistedSession, useGameStore } from '../lib/store.js';

function canAccessLobby(code, me, session) {
  if (!code) return false;
  const persisted = getPersistedSession();
  if (persisted?.code === code && persisted?.me) return true;
  if (me && session?.code === code) return true;
  return false;
}

export default function Lobby() {
  const { code } = useParams();
  const navigate = useNavigate();
  const session = useGameStore((s) => s.session);
  const me = useGameStore((s) => s.me);
  const reset = useGameStore((s) => s.reset);

  useEffect(() => {
    if (!canAccessLobby(code, me, session)) {
      navigate('/', { replace: true });
    }
  }, [code, me, session, navigate]);

  useEffect(() => {
    if (!session || session.code !== code) return;
    if (session.phase === 'final') {
      navigate(`/final/${code}`, { replace: true });
      return;
    }
    if (session.phase !== 'lobby') {
      navigate(`/play/${code}`, { replace: true });
    }
  }, [session, code, navigate]);

  const leave = () => {
    socket.emit('player:leave', { code });
    reset();
    navigate('/');
  };

  const start = () => {
    const onErr = (payload) => {
      socket.off('error', onErr);
      toast.error(payload?.message ?? 'Could not start');
    };
    socket.once('error', onErr);
    socket.emit('host:start', { code });
  };

  const endSession = () => {
    socket.emit('host:end', { code });
  };

  if (!session || session.code !== code) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-9 animate-spin text-primary" aria-hidden />
        <p className="text-sm font-medium">Loading lobby…</p>
      </div>
    );
  }

  const isHost = me?.id === session.hostId;
  const minimumPlayers = session.hostParticipates ? 2 : 1;
  const playerCount = session.players.length;

  return (
    <PageShell maxWidthClass="max-w-lg" className="space-y-8 py-10">
      <div className="animate-fadeIn text-center">
        <p className="text-sm font-medium text-muted-foreground">Join code</p>
        <div className="mt-4 inline-flex rounded-xl border border-border bg-card/95 px-8 py-6 shadow-stage backdrop-blur-sm">
          <p className="font-mono text-4xl font-bold tracking-[0.35em] text-foreground sm:text-5xl sm:tracking-[0.32em]">
            {session.code}
          </p>
        </div>
        <p className="mx-auto mt-4 max-w-sm text-sm text-muted-foreground">
          Share this code so others can join from their devices.
        </p>
      </div>

      {!session.hostParticipates && (
        <Card elevated className="animate-scaleIn p-5">
          <p className="text-sm font-medium text-muted-foreground">Host</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {session.hostName}
            {isHost && <span className="ml-2 text-sm font-normal text-muted-foreground">(you)</span>}
          </p>
        </Card>
      )}

      <Card elevated className="animate-scaleIn p-6">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-lg font-semibold leading-none text-foreground">Players</h2>
          <span className="text-sm font-medium text-muted-foreground">{playerCount} in room</span>
        </div>
        <ul className="divide-y divide-border">
          {session.players.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-4 first:pt-0 last:pb-0">
              <PlayerBadge name={p.name} isHost={p.id === session.hostId} isYou={p.id === me?.id} />
              {!p.connected && (
                <span className="text-xs font-semibold text-muted-foreground">Reconnecting…</span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-3">
        {isHost ? (
          <Button onClick={start} disabled={playerCount < minimumPlayers}>
            Start game
          </Button>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-4 text-center text-sm text-muted-foreground">
            Waiting for the host to start…
          </div>
        )}
        {isHost && (
          <Button variant="destructive" onClick={endSession}>
            End session for everyone
          </Button>
        )}
        <Button variant="outline" onClick={leave}>
          Leave session
        </Button>
      </div>
    </PageShell>
  );
}
