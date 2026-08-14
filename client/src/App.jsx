import { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { WifiOff, Zap } from 'lucide-react';
import { ThemeToggle } from './components/ThemeToggle.jsx';
import Home from './pages/Home.jsx';
import Lobby from './pages/Lobby.jsx';
import Play from './pages/Play.jsx';
import Final from './pages/Final.jsx';
import { emitWithAck, socket } from './lib/socket.js';
import {
  applySessionDelta,
  clearPendingLeave,
  getPendingLeave,
  getPersistedSession,
  persistSession,
  queuePendingLeave,
  useGameStore,
} from './lib/store.js';

const toastOptions = {
  duration: 4000,
  className: 'font-sans text-sm font-medium',
  style: {
    background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))',
    border: '1px solid hsl(var(--border))', borderRadius: '0.75rem',
    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.25)', maxWidth: '22rem', padding: '12px 16px',
  },
};

function AppRoutes() {
  const navigate = useNavigate();
  const session = useGameStore((state) => state.session);
  const connectionStatus = useGameStore((state) => state.connectionStatus);
  const reset = useGameStore((state) => state.reset);

  useEffect(() => {
    let syncing = false;
    let reconnecting = false;
    let reconnectTimer = null;
    let disposed = false;

    const scheduleReconnect = (callback, delay = 2_000) => {
      if (disposed) return;
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(callback, delay);
    };

    const reconnect = async () => {
      if (reconnecting || disposed) return;
      reconnecting = true;
      useGameStore.getState().setConnectionStatus('reconnecting');
      const pendingLeave = getPendingLeave();
      const persisted = getPersistedSession();
      const leavingPersistedSession = Boolean(
        pendingLeave?.code === persisted?.code && pendingLeave?.me?.id === persisted?.me?.id,
      );

      // A different current saved game is newer than an old, unconfirmed leave.
      // Joining/creating it already detached the socket from its prior room.
      if (
        persisted?.code &&
        persisted?.me?.id &&
        persisted?.me?.reconnectToken &&
        !leavingPersistedSession
      ) {
        if (pendingLeave) clearPendingLeave();
        try {
          const result = await emitWithAck('player:reconnect', {
            code: persisted.code,
            playerId: persisted.me.id,
            reconnectToken: persisted.me.reconnectToken,
          }, { attempts: 1 });
          useGameStore.setState({
            me: persisted.me,
            session: result.session,
            connectionStatus: 'connected',
          });
        } catch (error) {
          if (error.code === 'OFFLINE' || error.code === 'TIMEOUT') {
            const connected = socket.connected;
            useGameStore.getState().setConnectionStatus(connected ? 'reconnecting' : 'offline');
            if (connected) scheduleReconnect(reconnect);
          } else {
            toast.error(error.message ?? 'Could not reconnect to the session.');
            reset();
            useGameStore.getState().setConnectionStatus('connected');
            navigate('/', { replace: true });
          }
        } finally {
          reconnecting = false;
        }
        return;
      }

      if (leavingPersistedSession) {
        reset();
        navigate('/', { replace: true });
      }

      if (pendingLeave?.code && pendingLeave?.me?.reconnectToken) {
        try {
          await emitWithAck('player:reconnect', {
            code: pendingLeave.code,
            playerId: pendingLeave.me.id,
            reconnectToken: pendingLeave.me.reconnectToken,
          }, { attempts: 1 });
          await emitWithAck('player:leave', { code: pendingLeave.code }, { attempts: 1 });
          clearPendingLeave();
        } catch (error) {
          if (error.code === 'OFFLINE' || error.code === 'TIMEOUT') {
            const connected = socket.connected;
            useGameStore.getState().setConnectionStatus(connected ? 'reconnecting' : 'offline');
            if (connected) scheduleReconnect(reconnect);
            reconnecting = false;
            return;
          }
          // Missing/ended sessions are terminal and no longer need a pending leave.
          clearPendingLeave();
        }
      }
      useGameStore.getState().setConnectionStatus(socket.connected ? 'connected' : 'offline');
      reconnecting = false;
    };

    const syncSession = async (code) => {
      if (syncing || !socket.connected) return;
      syncing = true;
      try {
        const result = await emitWithAck('session:sync', { code }, { attempts: 1 });
        useGameStore.getState().setSession(result.session);
      } catch {
        // The reconnect path will recover the snapshot if the connection is unstable.
      } finally {
        syncing = false;
      }
    };

    const onSnapshot = ({ session: nextSession }) => {
      const current = useGameStore.getState().session;
      if (current?.code === nextSession?.code && current.version > nextSession.version) return;
      const promoted =
        current?.code === nextSession?.code &&
        current.hostId !== nextSession.hostId &&
        nextSession.hostId === useGameStore.getState().me?.id;
      useGameStore.getState().setSession(nextSession);
      if (promoted) toast('You are the host now — the previous host did not come back.');
    };

    const onDelta = (delta) => {
      const current = useGameStore.getState().session;
      const result = applySessionDelta(current, delta);
      if (result.needsSync) syncSession(delta.code);
      else if (result.session !== current) useGameStore.getState().setSession(result.session);
    };

    const onEnded = ({ reason }) => {
      toast(reason ?? 'Session ended.');
      reset();
      navigate('/', { replace: true });
    };

    const onSuperseded = ({ message }) => {
      toast.error(message ?? 'This session was opened elsewhere.');
      reset();
      navigate('/', { replace: true });
    };

    const onDisconnect = (reason) => {
      useGameStore.getState().setConnectionStatus('offline');
      if (reason === 'io server disconnect') {
        // A superseded tab is sent home, where it should be able to start or
        // join a different game without requiring a page refresh.
        scheduleReconnect(() => socket.connect(), 0);
      }
    };

    socket.on('connect', reconnect);
    socket.on('disconnect', onDisconnect);
    socket.on('session:snapshot', onSnapshot);
    socket.on('session:delta', onDelta);
    socket.on('session:ended', onEnded);
    socket.on('session:superseded', onSuperseded);
    socket.connect();
    if (socket.connected) reconnect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      socket.off('connect', reconnect);
      socket.off('disconnect', onDisconnect);
      socket.off('session:snapshot', onSnapshot);
      socket.off('session:delta', onDelta);
      socket.off('session:ended', onEnded);
      socket.off('session:superseded', onSuperseded);
    };
  }, [navigate, reset]);

  useEffect(() => {
    const me = useGameStore.getState().me;
    if (session?.code && me) persistSession(session.code, me);
  }, [session]);

  const goHome = async () => {
    const current = useGameStore.getState().session;
    const me = useGameStore.getState().me;
    if (current?.code && me) queuePendingLeave(current.code, me);
    if (current?.code && socket.connected) {
      try {
        await emitWithAck('player:leave', { code: current.code }, { attempts: 1, timeout: 2_000 });
        clearPendingLeave();
      }
      catch {
        // If an acknowledgement fails while the transport still looks alive,
        // force a fresh connection so the persisted pending leave is processed
        // instead of leaving a permanently attached ghost on the server.
        if (socket.connected) {
          socket.disconnect();
          socket.connect();
        }
      }
    }
    reset();
    navigate('/');
  };

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 z-0 grain opacity-60 dark:opacity-40" aria-hidden />
      <header className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={goHome}
          className="group inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 py-2 shadow-stage backdrop-blur-md transition-all hover:border-primary/40"
          aria-label="Leave game and go home"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-primary">
            <Zap className="size-3.5 fill-white text-white" aria-hidden />
          </span>
          <span className="text-sm font-bold text-foreground">Trivia<span className="text-primary">Live</span></span>
        </button>
        <div className="flex items-center gap-2">
          {connectionStatus !== 'connected' && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
              <WifiOff className="size-3" /> {connectionStatus === 'offline' ? 'Offline' : 'Reconnecting'}
            </span>
          )}
          <ThemeToggle />
        </div>
      </header>
      <div className="relative z-10 pt-16">
        <Toaster position="top-center" toastOptions={toastOptions} />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lobby/:code" element={<Lobby />} />
          <Route path="/play/:code" element={<Play />} />
          <Route path="/final/:code" element={<Final />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return <AppRoutes />;
}
