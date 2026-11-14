import {useEffect, useRef, useState} from 'react';
import {api, money, type User} from './api';

type Claim = {status: 'pending' | 'confirmed'; amount: string; transaction_hash: string; explorer: string; next_claim_at: number};
type Faucet = {available: boolean; amount: string; reason: string; message?: string; claim: Claim | null};
export default function useWalletFunding(user: User, refresh: () => unknown | Promise<unknown>) {
  const [faucet, setFaucet] = useState<Faucet | null>(null), [funding, setFunding] = useState(false), [checking, setChecking] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const latest = useRef(refresh); latest.current = refresh;
  const inFlight = useRef(false), reading = useRef(false);
  async function check() {
    if (reading.current || inFlight.current) return;
    reading.current = true; setChecking(true);
    try {const [status] = await Promise.all([api<Faucet>('/near/faucet'), latest.current()]); setFaucet(status); setError('');}
    catch {setError('Couldn’t update your balance. Try again.');} finally {reading.current = false; setChecking(false);}
  }
  async function topUp() {
    if (inFlight.current) return;
    inFlight.current = true; setFunding(true); setError(''); setMessage('');
    try {
      const claim = await api<Claim>('/near/faucet', {});
      setFaucet(previous => previous ? {...previous, claim, available: false, reason: claim.status === 'pending' ? 'pending' : 'cooldown'} : previous);
      setMessage(claim.status === 'confirmed' ? `${money(claim.amount)} NEAR added.` : 'Adding test NEAR…');
      await latest.current();
      window.dispatchEvent(new Event('nearfest:pending-payment'));
    } catch (e) {setError((e as Error).message); const status = await api<Faucet>('/near/faucet').catch(() => null); if (status) setFaucet(status);}
    finally {inFlight.current = false; setFunding(false);}
  }
  useEffect(() => {
    let active = true;
    setFaucet(null); setMessage(''); setError('');
    void api<Faucet>('/near/faucet').then(status => {if (active) setFaucet(status);}).catch(() => {if (active) setError('Couldn’t check top-ups. Try again.');});
    const focus = () => {if (document.visibilityState === 'visible') void check();};
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus);
    return () => {active = false; window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus);};
  }, [user.id]);
  const pending = faucet?.claim?.status === 'pending';
  useEffect(() => {if (!pending) return; const timer = setInterval(() => void check(), 20000); return () => clearInterval(timer);}, [pending, user.id]);
  return {faucet, funding, checking, error, message, pending, check, topUp};
}
