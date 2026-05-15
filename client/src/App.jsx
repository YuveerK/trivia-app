import { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { Zap } from 'lucide-react';
import { ThemeToggle } from './components/ThemeToggle.jsx';
import Home from './pages/Home.jsx';
import Lobby from './pages/Lobby.jsx';
import Play from './pages/Play.jsx';
import Final from './pages/Final.jsx';
import { socket } from './lib/socket.js';
import { getPersistedSession, persistSession, useGameStore } from './lib/store.js';

const toastOptions = {
  duration: 4000,
  className: 'font-sans text-sm font-medium',
  style: {
    background: 'hsl(var(--popover))',
    color: 'hsl(var(--popover-foreground))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '0.75rem',
    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.25), 0 0 0 1px hsl(var(--border))',
    maxWidth: '22rem',
    padding: '12px 16px',
  },
  success: {
    iconTheme: { primary: 'hsl(var(--primary))', secondary: 'hsl(var(--popover))' },
  },
  error: {
    iconTheme: { primary: 'hsl(var(--destructive))', secondary: 'hsl(var(--popover))' },
  },
};

function AppRoutes() {
  const navigate = useNavigate();
  const setSession = useGameStore((s) => s.setSession);
  const reset = useGameStore((s) => s.reset);

  useEffect(() => {
    const emitReconnect = () => {
      const raw = getPersistedSession();
      if (!raw?.code || !raw?.me?.id || !raw?.me?.reconnectToken) return;
      useGameStore.setState({ me: raw.me });
      socket.emit('player:reconnect', {
        code: raw.code,
        playerId: raw.me.id,
        reconnectToken: raw.me.reconnectToken,
      });
    };

    const onUpdate = ({ session }) => {
      setSession(session);
      const me = useGameStore.getState().me;
      if (me && session?.code) {
        persistSession(session.code, useGameStore.getState().me);
      }
    };

    const onEnded = ({ reason }) => {
      toast(reason ?? 'Session ended');
      reset();
      navigate('/', { replace: true });
    };

    const onError = ({ message }) => {
      toast.error(message ?? 'Something went wrong');
    };

    const onReconnectFailed = ({ message }) => {
      toast.error(message ?? 'Could not reconnect to the session');
      reset();
      navigate('/', { replace: true });
    };

    socket.on('connect', emitReconnect);
    socket.on('session:update', onUpdate);
    socket.on('session:ended', onEnded);
    socket.on('error', onError);
    socket.on('reconnect:failed', onReconnectFailed);

    socket.connect();
    if (socket.connected) emitReconnect();

    return () => {
      socket.off('connect', emitReconnect);
      socket.off('session:update', onUpdate);
      socket.off('session:ended', onEnded);
      socket.off('error', onError);
      socket.off('reconnect:failed', onReconnectFailed);
    };
  }, [navigate, reset, setSession]);

  return (
    <div className="relative min-h-screen">
      {/* Grain texture overlay */}
      <div className="pointer-events-none fixed inset-0 z-0 grain opacity-60 dark:opacity-40" aria-hidden />

      {/* Global header */}
      <header className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 py-3 sm:px-6">
        <a
          href="/"
          className="group inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 py-2 shadow-stage backdrop-blur-md transition-all hover:border-primary/40 hover:shadow-glow-sm"
          aria-label="Home"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-primary shadow-glow-sm">
            <Zap className="size-3.5 fill-white text-white" aria-hidden />
          </span>
          <span className="text-sm font-bold tracking-tight text-foreground">
            Trivia<span className="text-primary">Live</span>
          </span>
        </a>
        <ThemeToggle />
      </header>

      {/* Page content — padded for fixed header */}
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
