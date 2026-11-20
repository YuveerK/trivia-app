import { useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { CAUGHT_GRACE_MS } from './caught.js';
import { emitWithAck } from './socket.js';
import { useGameStore } from './store.js';

const SELF_MESSAGE = 'We saw that 👀 Your name is on the big screen.';
// Sits below the floating logo and away from the answer buttons.
const SELF_TOAST = { icon: '🕵️', duration: 4_000, style: { marginTop: 56 } };

/**
 * While `active` (a player who has not yet answered the current question),
 * reports leaving the game for longer than the grace period (tab switch, app
 * switch, window blur) or copying page text. Reported at most once per round.
 */
export function useCaughtDetector({ code, round, active }) {
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const activeRef = useRef(active);
  const roundRef = useRef(round);
  const reportedRounds = useRef(new Set());
  const pendingReport = useRef(null);
  const away = useRef(null);
  const toastOnReturn = useRef(false);
  activeRef.current = active;
  roundRef.current = round;

  const send = useCallback(async (roundIndex, reason) => {
    try {
      await emitWithAck('player:caught', { code, roundIndex, reason }, { attempts: 1 });
      pendingReport.current = null;
    } catch (error) {
      // Phones often drop the socket while backgrounded: retry once reconnected.
      if (error?.code === 'OFFLINE' || error?.code === 'TIMEOUT') {
        pendingReport.current = { roundIndex, reason };
      }
    }
  }, [code]);

  const flag = useCallback((reason) => {
    const roundIndex = roundRef.current;
    if (!activeRef.current || reportedRounds.current.has(roundIndex)) return;
    reportedRounds.current.add(roundIndex);
    if (document.visibilityState === 'visible' && document.hasFocus()) toast(SELF_MESSAGE, SELF_TOAST);
    else toastOnReturn.current = true;
    send(roundIndex, reason);
  }, [send]);

  useEffect(() => {
    if (connectionStatus === 'connected' && pendingReport.current) {
      const { roundIndex, reason } = pendingReport.current;
      pendingReport.current = null;
      send(roundIndex, reason);
    }
  }, [connectionStatus, send]);

  useEffect(() => {
    if (!active) return undefined;

    const leave = () => {
      if (away.current) return;
      away.current = {
        since: Date.now(),
        timer: setTimeout(() => flag('tab'), CAUGHT_GRACE_MS),
      };
    };
    const comeBack = () => {
      const trip = away.current;
      if (trip) {
        clearTimeout(trip.timer);
        away.current = null;
        // Backgrounded phones may pause timers, so also judge on return.
        if (Date.now() - trip.since >= CAUGHT_GRACE_MS) flag('tab');
      }
      if (toastOnReturn.current) {
        toastOnReturn.current = false;
        toast(SELF_MESSAGE, SELF_TOAST);
      }
    };
    const onVisibility = () => (document.visibilityState === 'hidden' ? leave() : comeBack());
    const onCopy = () => flag('copy');

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', leave);
    window.addEventListener('focus', comeBack);
    document.addEventListener('copy', onCopy);
    if (document.visibilityState === 'hidden') leave();

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', leave);
      window.removeEventListener('focus', comeBack);
      document.removeEventListener('copy', onCopy);
      if (away.current) clearTimeout(away.current.timer);
      away.current = null;
    };
  }, [active, flag]);
}
