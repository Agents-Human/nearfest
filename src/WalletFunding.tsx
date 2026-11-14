import {useEffect, useRef, useState} from 'react';
import {api, money, type User} from './api';
import UiIcon from './UiIcon';

type Claim = {status: 'pending' | 'confirmed'; amount: string; transaction_hash: string; explorer: string; next_claim_at: number};
type Faucet = {enabled: boolean; available: boolean; amount: string; reason: string; message?: string; claim: Claim | null};
export default function WalletFunding({user, busy, refresh, minimum = '0'}: {
  user: User; busy: boolean; refresh: () => unknown | Promise<unknown>; minimum?: string;
}) {
  const [copied, setCopied] = useState(false), [faucet, setFaucet] = useState<Faucet | null>(null);
  const [funding, setFunding] = useState(false), [checking, setChecking] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const latestRefresh = useRef(refresh); latestRefresh.current = refresh;
  const checkingRef = useRef(false), fundingRef = useRef(false);
  async function check() {
    if (checkingRef.current || fundingRef.current) return;
    checkingRef.current = true; setChecking(true); setError('');
    try {const [status] = await Promise.all([api<Faucet>('/near/faucet'), latestRefresh.current()]); setFaucet(status);}
    catch (e) {setError((e as Error).message);} finally {checkingRef.current = false; setChecking(false);}
  }
  useEffect(() => {
    let active = true;
    setFaucet(null);setMessage('');setError('');setCopied(false);
    void api<Faucet>('/near/faucet').then(value => {if (active) setFaucet(value);}).catch(() => {if (active) setError('Couldn’t check test NEAR availability. Try again.');});
    const focus = () => {if (document.visibilityState === 'visible') void check();};
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus);
    return () => {active = false; window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus);};
  }, [user.id]);
  const pending = faucet?.claim?.status === 'pending';
  const cooldown = faucet?.reason === 'cooldown';
  useEffect(() => {if (!pending) return; const timer = setInterval(() => void topUp(), 15000); return () => clearInterval(timer);}, [pending, user.id]);
  async function copy() {
    try {await navigator.clipboard.writeText(user.id); setCopied(true);} catch {setMessage('Select the wallet address above and copy it.');}
  }
  async function topUp() {
    if (fundingRef.current) return;
    fundingRef.current = true; setFunding(true); setError('');
    try {
      const claim = await api<Claim>('/near/faucet', {});
      setFaucet(previous => previous ? {...previous, claim, available: claim.status === 'pending', reason: claim.status === 'pending' ? 'pending' : 'cooldown'} : previous);
      setMessage(claim.status === 'confirmed' ? `${money(claim.amount)} test NEAR added. You can continue as soon as your balance is ready.` : 'Your test NEAR is on its way. We’ll check for confirmation automatically.');
      await latestRefresh.current();
    } catch (e) {setError((e as Error).message); const status = await api<Faucet>('/near/faucet').catch(() => null); if (status) setFaucet(status);}
    finally {fundingRef.current = false; setFunding(false);}
  }
  const enough = !user.chain_error && BigInt(user.balance) >= BigInt(minimum) && BigInt(user.balance) > 0n;
  const unavailable = faucet && !faucet.available && !cooldown && faucet.reason !== 'funded';
  return <section className="wallet-funding" aria-label="Wallet balance and funding">
    <span className="wallet-funding-label">{user.name} · NEAR testnet</span>
    <strong className="wallet-amount" aria-live="polite">{user.chain_error ? 'Unavailable' : <>{money(user.balance)} <small>NEAR</small></>}</strong>
    <p>{user.chain_error ? 'We couldn’t read your balance. Refresh to try again.' : enough ? 'Your wallet is ready. You can continue below.' : 'Add free test NEAR here, then continue to your room.'}</p>
    <div className="wallet-address"><span>{user.id}</span><button className="text-button" aria-label="Copy wallet address" onClick={() => void copy()}>{copied ? 'Copied ✓' : 'Copy'}</button></div>
    <div className="wallet-funding-actions">
      <button className="primary" disabled={busy || funding || !faucet?.available} onClick={() => void topUp()}>{funding ? 'Confirming test NEAR…' : pending ? 'Check top-up status' : cooldown ? 'Test NEAR received' : !faucet ? 'Checking top-ups…' : faucet.available ? `Add ${money(faucet.amount)} test NEAR` : 'Top-up unavailable'}<UiIcon name="arrow" size={18}/></button>
      <button className="secondary" disabled={busy || funding || checking} onClick={() => void check()}>{checking ? 'Checking…' : 'Refresh balance'}</button>
    </div>
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="inline-error">{error}</p>}
    {unavailable && <p className="wallet-availability" role="status">{faucet.message} {enough ? 'You can continue using your current balance.' : 'You can keep this page open while adding funds, or return later using the same invite.'}</p>}
    {faucet?.claim && <a className="wallet-transfer-link" href={faucet.claim.explorer} target="_blank" rel="noreferrer">View top-up on NEAR ↗</a>}
    <small>{cooldown ? `Next top-up: ${new Date(faucet!.claim!.next_claim_at).toLocaleString()}. ` : 'Up to 10 test NEAR per wallet every 24 hours, based on available funds. '}Test tokens have no monetary value.</small>
    {(unavailable || cooldown && !enough) && <a className="wallet-backup-faucet" href="https://near-faucet.io/" target="_blank" rel="noreferrer">Add test NEAR with the public faucet ↗</a>}
  </section>;
}
