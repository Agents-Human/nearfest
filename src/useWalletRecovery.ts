import {useEffect, useRef, useState} from 'react';
import {api, type User} from './api';
import type {Party} from './Multiplayer';

export type PendingPayment = {intent_id: string; room_id: string; title: string; operation: string; amount: string; created_at: number; status: 'awaiting_wallet' | 'checking' | 'unavailable'};
export type WalletActivity = {id: string; room_id?: string; title: string; operation: string; amount: string; created_at: number; status: 'confirmed' | 'expired' | 'cancelled' | 'pending' | 'failed'; explorer?: string};
export type WalletRecovery = {pending: PendingPayment[]; history: WalletActivity[]; recovered: {intent_id: string; operation: string; room: Party & {cancelled?: boolean}}[]; expired: string[]; resumed_intent?: string};

export default function useWalletRecovery(user: User | null, recovered: (result: WalletRecovery) => void) {
  const [pending, setPending] = useState<PendingPayment[]>([]), [history, setHistory] = useState<WalletActivity[]>([]), [checking, setChecking] = useState(false), [error, setError] = useState('');
  const current = useRef({user, recovered, pending}); current.current = {user, recovered, pending};
  const active = useRef(false), inFlight = useRef(false), lastCheck = useRef(0);
  async function refresh() {
    const account = current.current.user;
    if (!active.current || account?.kind !== 'wallet' || inFlight.current) return;
    inFlight.current = true; lastCheck.current = Date.now(); setChecking(true);
    try {
      const result = await api<WalletRecovery>('/near/reconcile', {});
      if (!active.current || current.current.user?.id !== account.id) return;
      if (!active.current || current.current.user?.id !== account.id) return;
      setPending(result.pending); setHistory(result.history); setError('');
      current.current.recovered(result);
    } catch {if (active.current && current.current.user?.id === account.id) setError('Couldn’t update activity. We’ll retry automatically.');}
    finally {inFlight.current = false; if (active.current) {setChecking(false); if (current.current.user?.id !== account.id) queueMicrotask(() => void refresh());}}
  }
  async function resume(intent: string) {
    const account = current.current.user, item = current.current.pending.find(payment => payment.intent_id === intent);
    if (!item) return;
    const room = await api<Party>('/near/retry', {intent_id: intent});
    if (!active.current || current.current.user?.id !== account?.id) return;
    current.current.recovered({pending: [], history: [], expired: [], recovered: [{intent_id: intent, operation: item.operation, room}], resumed_intent: intent});
    await refresh();
  }
  useEffect(() => {
    active.current = true; setPending([]); setHistory([]); setError(''); lastCheck.current = 0;
    void refresh();
    const update = () => {void refresh();};
    const focus = () => {if (document.visibilityState === 'visible' && Date.now() - lastCheck.current > 15000) update();};
    const timer = setInterval(() => {if (document.visibilityState === 'visible') update();}, 30000);
    window.addEventListener('nearfest:pending-payment', update); window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus);
    return () => {active.current = false; clearInterval(timer); window.removeEventListener('nearfest:pending-payment', update); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus);};
  }, [user?.id]);
  return {pending, history, checking, error, refresh, resume};
}
