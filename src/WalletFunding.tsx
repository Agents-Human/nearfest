import {money, type User} from './api';
import useWalletFunding from './useWalletFunding';
import './wallet-panel.css';

export default function WalletFunding({user, busy, refresh, minimum = '0', ready}: {
  user: User; busy: boolean; refresh: () => unknown | Promise<unknown>; minimum?: string;
  ready: {label: string; onClick: () => void};
}) {
  const {faucet, funding, checking, error, message, pending, check, topUp} = useWalletFunding(user, refresh);
  const enough = !user.chain_error && BigInt(user.balance) >= BigInt(minimum);
  return <section className="funding-step" aria-label="Wallet funding">
    <div className="wallet-balance-line"><span>Available balance</span><strong>{user.chain_error ? '—' : money(user.balance, 4)} <small>NEAR</small></strong></div>
    {BigInt(minimum) > 0n && <p>{money(minimum)} NEAR needed, including fees.</p>}
    {enough ? <button className="primary full" disabled={busy || funding || pending} onClick={ready.onClick}>{busy ? 'Joining…' : ready.label}</button>
      : user.chain_error ? <button className="primary full" disabled={checking} onClick={() => void check()}>{checking ? 'Checking…' : 'Retry balance check'}</button>
      : faucet?.available && !pending ? <button className="primary full" disabled={busy || funding} onClick={() => void topUp()}>{funding ? 'Adding test NEAR…' : `Add ${money(faucet.amount)} free test NEAR`}</button>
      : pending || funding ? <p className="wallet-quiet-status" role="status">Adding test NEAR…</p>
      : <p className="wallet-quiet-status">{!faucet ? 'Checking top-ups…' : faucet.reason === 'cooldown' ? `Free top-up available ${new Date(faucet.claim!.next_claim_at).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}.` : 'Free top-ups are temporarily unavailable.'}</p>}
    {message && !pending && <p className="wallet-quiet-status" role="status">{message}</p>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    {!enough && faucet && !faucet.available && !pending && !funding && <div className="wallet-funding-help"><button className="text-button" disabled={checking} onClick={() => void check()}>{checking ? 'Checking…' : 'I’ve added funds'}</button><a href="https://near-faucet.io/" target="_blank" rel="noreferrer">Get test NEAR ↗</a></div>}
  </section>;
}
