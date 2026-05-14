import { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { ThemeToggle } from './components/ThemeToggle.jsx';
import Home from './pages/Home.jsx';
import Lobby from './pages/Lobby.jsx';
import Play from './pages/Play.jsx';
import Final from './pages/Final.jsx';
import { socket } from './lib/socket.js';
import { getPersistedSession, persistSession, useGameStore } from './lib/store.js';

const toastOptions = {
  duration: 4000,
  className: 'font-sans text-sm',
  style: {
    background: 'hsl(var(--popover))',
    color: 'hsl(var(--popover-foreground))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 'var(--radius)',
    boxShadow:
      '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.08)',
    maxWidth: '22rem',
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
    socket.connect();

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

    socket.on('session:update', onUpdate);
    socket.on('session:ended', onEnded);
    socket.on('error', onError);

    return () => {
      socket.off('session:update', onUpdate);
      socket.off('session:ended', onEnded);
      socket.off('error', onError);
    };
  }, [navigate, reset, setSession]);

  useEffect(() => {
    const raw = getPersistedSession();
    if (!raw?.code || !raw?.me?.id) return undefined;

    useGameStore.setState({ me: raw.me });

    const t = setTimeout(() => {
      socket.emit('player:reconnect', { code: raw.code, playerId: raw.me.id });
    }, 0);

    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative min-h-screen">
      <div
        className="pointer-events-none fixed inset-0 z-0 grain opacity-[0.65] dark:opacity-40"
        aria-hidden
      />
      <div className="relative z-10">
        <div className="pointer-events-none fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
          <div className="pointer-events-auto">
            <ThemeToggle />
          </div>
        </div>
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
