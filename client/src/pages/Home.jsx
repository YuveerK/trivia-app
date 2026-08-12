import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Braces, Hash, Sparkles, Trophy, Users, User, ArrowRight } from 'lucide-react';
import { Button } from '../components/Button.jsx';
import { Input } from '../components/Input.jsx';
import { PageShell } from '../components/PageShell.jsx';
import { cn } from '../lib/utils.js';
import { emitWithAck } from '../lib/socket.js';
import { clearPendingLeave, persistSession, useGameStore } from '../lib/store.js';

export default function Home() {
  const navigate = useNavigate();
  const setSession = useGameStore((s) => s.setSession);
  const setMe = useGameStore((s) => s.setMe);
  const connectionStatus = useGameStore((s) => s.connectionStatus);

  const [hostName, setHostName] = useState('');
  const [hostParticipates, setHostParticipates] = useState(true);
  const [customize, setCustomize] = useState(false);
  const [questionsJson, setQuestionsJson] = useState('');

  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (pendingAction) return;
    if (!hostName.trim()) { toast.error('Please enter your name.'); return; }

    const payload = { name: hostName.trim(), hostParticipates };
    if (customize && questionsJson.trim()) {
      try {
        payload.questions = JSON.parse(questionsJson);
      } catch {
        toast.error('Custom questions must be valid JSON.');
        return;
      }
    }
    setPendingAction('create');
    try {
      const { session, you } = await emitWithAck('host:create', payload);
      setSession(session);
      setMe(you);
      clearPendingLeave();
      persistSession(session.code, you);
      toast.success(`Session ${session.code} created`);
      navigate(`/lobby/${session.code}`);
    } catch (error) {
      toast.error(error.message ?? 'Could not create session');
    } finally {
      setPendingAction(null);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (pendingAction) return;
    if (!joinName.trim()) { toast.error('Please enter your name.'); return; }
    const code = joinCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(code)) { toast.error('Join code must be 4 characters.'); return; }

    setPendingAction('join');
    try {
      const { session, you } = await emitWithAck('player:join', { code, name: joinName.trim() });
      setSession(session);
      setMe(you);
      clearPendingLeave();
      persistSession(session.code, you);
      toast.success(`Joined session ${session.code}`);
      navigate(`/lobby/${session.code}`);
    } catch (error) {
      toast.error(error.message ?? 'Could not join');
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <PageShell className="space-y-10 pb-24 pt-6 sm:pt-10">
      {/* Hero */}
      <section className="animate-fadeIn relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FF8A08] via-[#ff7700] to-[#e05500] px-8 py-12 text-white shadow-stage-lg sm:px-12 sm:py-16">
        {/* Background orbs */}
        <div
          className="animate-orb pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-white/10 blur-3xl"
          aria-hidden
        />
        <div
          className="animate-orb-delay pointer-events-none absolute -bottom-20 -left-12 size-56 rounded-full bg-black/10 blur-3xl"
          aria-hidden
        />
        {/* Shine overlay */}
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(ellipse_100%_80%_at_20%_-10%,rgba(255,255,255,0.3),transparent_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl bg-[linear-gradient(180deg,rgba(255,255,255,0.18)_0%,transparent_45%,rgba(0,0,0,0.15)_100%)]"
          aria-hidden
        />

        <div className="relative z-10">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-orange-50 backdrop-blur-sm">
            <Sparkles className="size-3.5" aria-hidden />
            Real-time multiplayer
          </span>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            Trivia Tournament
          </h1>
          <p className="mt-4 max-w-xl text-balance text-base font-medium leading-relaxed text-orange-50/90 sm:text-lg">
            Fast. Competitive. Live. Host a game or join with a code — faster answers score higher.
          </p>

          <div className="mt-8 flex flex-wrap gap-4 text-sm font-semibold text-white/80">
            <span className="flex items-center gap-1.5">
              <Trophy className="size-4 text-yellow-300" aria-hidden />
              Time-based scoring
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="size-4 text-blue-200" aria-hidden />
              Up to 50 players
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-4 text-pink-200" aria-hidden />
              Instant results
            </span>
          </div>
        </div>
      </section>

      {/* Forms */}
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        {/* Host */}
        <div className="animate-slideUp overflow-hidden rounded-2xl border border-border bg-card shadow-stage-lg">
          <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 to-purple-800 px-6 py-5 text-white">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_30%_-20%,rgba(255,255,255,0.25),transparent_60%)]"
              aria-hidden
            />
            <div className="relative flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <Trophy className="size-5 text-yellow-300" aria-hidden />
              </span>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Host a session</h2>
                <p className="mt-0.5 text-sm font-medium text-purple-100/90">Create the room & control the board</p>
              </div>
            </div>
          </div>

          <form className="space-y-4 p-6" onSubmit={handleCreate}>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground" htmlFor="host-name">
                Your name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="host-name"
                  pill
                  className="pl-11"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="Alex Mercer"
                  maxLength={30}
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-muted/50 px-3.5 py-3 text-sm font-medium text-foreground transition hover:border-border hover:bg-muted/70">
              <input
                type="checkbox"
                checked={hostParticipates}
                onChange={(e) => setHostParticipates(e.target.checked)}
                className="size-4 rounded border-border accent-primary"
              />
              Join the game as a player
            </label>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-muted/50 px-3.5 py-3 text-sm font-medium text-foreground transition hover:border-border hover:bg-muted/70">
              <input
                type="checkbox"
                checked={customize}
                onChange={(e) => setCustomize(e.target.checked)}
                className="size-4 rounded border-border accent-primary"
              />
              <Braces className="size-4 text-muted-foreground" aria-hidden />
              Use custom questions (JSON)
            </label>

            {customize && (
              <div className="relative animate-slideDown">
                <Braces className="pointer-events-none absolute left-4 top-4 size-4 text-muted-foreground" aria-hidden />
                <textarea
                  className={cn(
                    'min-h-28 w-full resize-y rounded-xl border-2 border-border bg-input py-3 pl-11 pr-4 font-mono text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  )}
                  placeholder='[{"q":"Capital of France?","options":["Paris","Rome","Berlin","Madrid"],"correct":0}]'
                  value={questionsJson}
                  onChange={(e) => setQuestionsJson(e.target.value)}
                />
              </div>
            )}

            <Button type="submit" className="gap-2" disabled={Boolean(pendingAction) || connectionStatus !== 'connected'}>
              {pendingAction === 'create' ? 'Creating…' : 'Create session'} <ArrowRight className="size-4" aria-hidden />
            </Button>
          </form>
        </div>

        {/* Join */}
        <div className="animate-slideUp delay-150 overflow-hidden rounded-2xl border border-border bg-card shadow-stage-lg">
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-800 px-6 py-5 text-white">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_30%_-20%,rgba(255,255,255,0.25),transparent_60%)]"
              aria-hidden
            />
            <div className="relative flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <Hash className="size-5 text-blue-200" aria-hidden />
              </span>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Join a session</h2>
                <p className="mt-0.5 text-sm font-medium text-blue-100/90">Enter the 4-character code from your host</p>
              </div>
            </div>
          </div>

          <form className="space-y-4 p-6" onSubmit={handleJoin}>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground" htmlFor="join-name">
                Your name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="join-name"
                  pill
                  className="pl-11"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  placeholder="Jordan Lee"
                  maxLength={30}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground" htmlFor="join-code">
                Room code
              </label>
              <div className="relative">
                <Hash className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="join-code"
                  pill
                  className="pl-11 font-mono text-xl tracking-[0.4em] font-bold"
                  value={joinCode}
                  onChange={(e) =>
                    setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))
                  }
                  placeholder="K7XQ"
                  maxLength={4}
                />
              </div>
            </div>

            {/* Code boxes preview */}
            {joinCode.length > 0 && (
              <div className="flex justify-center gap-2 py-1 animate-fadeIn">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex size-12 items-center justify-center rounded-xl border-2 font-mono text-xl font-extrabold tracking-wider transition-all',
                      joinCode[i]
                        ? 'border-primary bg-primary/10 text-primary shadow-glow-sm'
                        : 'border-border bg-muted/40 text-muted-foreground',
                    )}
                  >
                    {joinCode[i] ?? '·'}
                  </div>
                ))}
              </div>
            )}

            <Button type="submit" className="gap-2" disabled={Boolean(pendingAction) || connectionStatus !== 'connected'}>
              {pendingAction === 'join' ? 'Joining…' : 'Join game'} <ArrowRight className="size-4" aria-hidden />
            </Button>
          </form>
        </div>
      </div>
    </PageShell>
  );
}
