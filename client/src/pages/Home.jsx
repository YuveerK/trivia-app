import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Braces, Hash, Sparkles, User } from 'lucide-react';
import { Button } from '../components/Button.jsx';
import { Input } from '../components/Input.jsx';
import { PageShell } from '../components/PageShell.jsx';
import { cn } from '../lib/utils.js';
import { socket } from '../lib/socket.js';
import { persistSession, useGameStore } from '../lib/store.js';

export default function Home() {
  const navigate = useNavigate();
  const setSession = useGameStore((s) => s.setSession);
  const setMe = useGameStore((s) => s.setMe);

  const [hostName, setHostName] = useState('');
  const [hostParticipates, setHostParticipates] = useState(true);
  const [customize, setCustomize] = useState(false);
  const [questionsJson, setQuestionsJson] = useState('');

  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const handleCreate = (e) => {
    e.preventDefault();
    if (!hostName.trim()) {
      toast.error('Please enter your name.');
      return;
    }

    const onCreated = (payload) => {
      socket.off('session:created', onCreated);
      socket.off('error', onErr);
      const { session, you } = payload;
      setSession(session);
      setMe(you);
      persistSession(session.code, you);
      toast.success(`Session ${session.code} created`);
      navigate(`/lobby/${session.code}`);
    };

    const onErr = (payload) => {
      socket.off('session:created', onCreated);
      socket.off('error', onErr);
      toast.error(payload?.message ?? 'Could not create session');
    };

    socket.once('session:created', onCreated);
    socket.once('error', onErr);

    const payload = { name: hostName.trim(), hostParticipates };
    if (customize && questionsJson.trim()) {
      try {
        payload.questions = JSON.parse(questionsJson);
      } catch {
        toast.error('Custom questions must be valid JSON.');
        socket.off('session:created', onCreated);
        socket.off('error', onErr);
        return;
      }
    }

    socket.emit('host:create', payload);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!joinName.trim()) {
      toast.error('Please enter your name.');
      return;
    }
    const code = joinCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(code)) {
      toast.error('Join code must be 4 characters.');
      return;
    }

    const onJoined = (payload) => {
      socket.off('session:joined', onJoined);
      socket.off('error', onErr);
      const { session, you } = payload;
      setSession(session);
      setMe(you);
      persistSession(session.code, you);
      toast.success(`Joined session ${session.code}`);
      navigate(`/lobby/${session.code}`);
    };

    const onErr = (payload) => {
      socket.off('session:joined', onJoined);
      socket.off('error', onErr);
      toast.error(payload?.message ?? 'Could not join');
    };

    socket.once('session:joined', onJoined);
    socket.once('error', onErr);
    socket.emit('player:join', { code, name: joinName.trim() });
  };

  const formShell =
    'overflow-hidden rounded-3xl border border-border bg-card/95 shadow-stage-lg backdrop-blur-md ring-1 ring-black/[0.04] dark:ring-white/[0.06]';

  return (
    <PageShell className="space-y-10 pb-20 pt-10 sm:pt-14">
      <section
        className={cn(
          'animate-fadeIn relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#ff8a08] via-[#ff7a0a] to-[#ff6b08] p-8 text-white shadow-stage-lg sm:p-10',
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_30%_-20%,rgba(255,255,255,0.35),transparent_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.2)_0%,transparent_40%,rgba(0,0,0,0.12)_100%)]"
          aria-hidden
        />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-50 backdrop-blur-sm">
              <Sparkles className="size-3.5 opacity-90" aria-hidden />
              Live multiplayer
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl md:leading-tight">
              Trivia Tournament
            </h1>
            <p className="mt-4 max-w-xl text-balance text-base font-medium leading-relaxed text-orange-50 sm:text-lg">
              Host a live game or join with a code. Fast correct answers score higher — built for team
              ice-breakers that feel like a real broadcast.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <div className={cn('animate-slideUp', formShell)}>
          <div className="relative bg-primary py-5 text-center text-primary-foreground shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]">
            <div
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.2)_0%,transparent_50%)]"
              aria-hidden
            />
            <h2 className="relative text-2xl font-bold tracking-tight">Host a session</h2>
            <p className="relative mt-1 text-sm font-medium text-orange-50/95">Create the room & control the board</p>
          </div>
          <form
            className="space-y-5 border-t border-border bg-gradient-to-b from-card via-card to-muted/25 p-8 dark:via-card dark:to-muted/20"
            onSubmit={handleCreate}
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground" htmlFor="host-name">
                Your name
              </label>
              <div className="relative">
                <User
                  className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="host-name"
                  pill
                  className="pl-12"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="Alex Mercer"
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground transition hover:border-border hover:bg-muted/60">
              <input
                type="checkbox"
                checked={hostParticipates}
                onChange={(e) => setHostParticipates(e.target.checked)}
                className="size-4 rounded border-border text-primary focus:ring-ring"
              />
              Join the game as a player
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground transition hover:border-border hover:bg-muted/60">
              <input
                type="checkbox"
                checked={customize}
                onChange={(e) => setCustomize(e.target.checked)}
                className="size-4 rounded border-border text-primary focus:ring-ring"
              />
              Customize questions (JSON)
            </label>
            {customize && (
              <div className="relative">
                <Braces
                  className="pointer-events-none absolute left-4 top-4 size-5 text-muted-foreground"
                  aria-hidden
                />
                <textarea
                  className={cn(
                    'min-h-28 w-full resize-y rounded-2xl border-2 border-border bg-input py-3 pl-12 pr-4 font-mono text-sm text-foreground shadow-[inset_0_1px_2px_hsl(218_17%_17%/0.05)] outline-none transition-all placeholder:text-muted-foreground focus-visible:border-charleston focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.25)]',
                  )}
                  placeholder='[{"q":"...","options":["A","B"],"correct":0}]'
                  value={questionsJson}
                  onChange={(e) => setQuestionsJson(e.target.value)}
                />
              </div>
            )}
            <Button type="submit">CREATE SESSION</Button>
          </form>
        </div>

        <div className={cn('animate-slideUp delay-100', formShell)}>
          <div className="relative bg-primary py-5 text-center text-primary-foreground shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]">
            <div
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.2)_0%,transparent_50%)]"
              aria-hidden
            />
            <h2 className="relative text-2xl font-bold tracking-tight">Join a session</h2>
            <p className="relative mt-1 text-sm font-medium text-orange-50/95">Use the 4-character code from your host</p>
          </div>
          <form
            className="space-y-5 border-t border-border bg-gradient-to-b from-card via-card to-muted/25 p-8 dark:via-card dark:to-muted/20"
            onSubmit={handleJoin}
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground" htmlFor="join-name">
                Your name
              </label>
              <div className="relative">
                <User
                  className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="join-name"
                  pill
                  className="pl-12"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  placeholder="Jordan Lee"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground" htmlFor="join-code">
                4-character code
              </label>
              <div className="relative">
                <Hash
                  className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="join-code"
                  pill
                  className="pl-12 font-mono tracking-[0.35em]"
                  value={joinCode}
                  onChange={(e) =>
                    setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))
                  }
                  placeholder="K7XQ"
                  maxLength={4}
                />
              </div>
            </div>
            <Button type="submit">LET&apos;S GO</Button>
          </form>
        </div>
      </div>
    </PageShell>
  );
}
