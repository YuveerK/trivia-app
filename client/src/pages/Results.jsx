import toast from 'react-hot-toast';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { Leaderboard } from '../components/Leaderboard.jsx';
import { socket } from '../lib/socket.js';
import { useGameStore } from '../lib/store.js';
import { cn } from '../lib/utils.js';

export default function Results({ code }) {
  const session = useGameStore((s) => s.session);
  const me = useGameStore((s) => s.me);

  const round = session?.currentRound ?? 0;
  const q = session?.questions?.[round];
  const total = session?.questions?.length ?? 0;
  const myPlayer = session?.players?.find((p) => p.id === me?.id);
  const ans = myPlayer?.answers?.[round];
  const isHost = me?.id === session.hostId;
  const isLast = round >= total - 1;

  const next = () => {
    const onErr = (payload) => {
      socket.off('error', onErr);
      toast.error(payload?.message ?? 'Could not advance');
    };
    socket.once('error', onErr);
    socket.emit('host:nextRound', { code });
  };

  if (!q) return null;

  let personal = 'No answer';
  if (ans) {
    personal = ans.correct
      ? `Correct! +${ans.points} pts (${ans.time.toFixed(1)}s)`
      : 'Incorrect — 0 pts';
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <Card elevated className="p-6">
        <p className="text-sm font-medium text-muted-foreground">Results</p>
        <h2 className="mt-2 text-2xl font-semibold leading-snug tracking-tight text-foreground">{q.q}</h2>
        <ul className="mt-6 space-y-2">
          {q.options.map((opt, idx) => {
            const isCorrect = idx === q.correct;
            return (
              <li
                key={idx}
                className={cn(
                  'rounded-lg border px-4 py-3 text-base',
                  isCorrect
                    ? 'border-emerald-200 bg-emerald-50 font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
                    : 'border-border bg-muted/40 text-foreground',
                )}
              >
                {opt}
              </li>
            );
          })}
        </ul>
        <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4">
          <p className="text-sm text-muted-foreground">{myPlayer ? 'Your result' : 'Host view'}</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {myPlayer ? personal : 'No answer recorded'}
          </p>
        </div>
      </Card>

      <Card elevated className="p-6">
        <h3 className="mb-3 text-lg font-semibold text-foreground">Leaderboard</h3>
        <Leaderboard players={session.players} currentPlayerId={me?.id} />
      </Card>

      {isHost && (
        <Button onClick={next}>{isLast ? 'Show final results' : 'Next question'}</Button>
      )}
    </div>
  );
}
