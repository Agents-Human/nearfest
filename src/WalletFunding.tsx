import {useEffect, useRef} from 'react';
import {money, type User} from './api';
import useWalletFunding from './useWalletFunding';
import './wallet-panel.css';

/** Funding is a continuation of Join, never another confirmation screen. */
export default function WalletFunding({user, busy, refresh, minimum = '0'}: {
  user: User; busy: boolean; refresh: () => unknown | Promise<unknown>; minimum?: string;
}) {
  const {faucet, funding, checking, error, pending, check, topUp} = useWalletFunding(user, refresh);
  const enough = !user.chain_error && BigInt(user.balance) >= BigInt(minimum), requested = useRef(false);
  useEffect(() => {
    if (!enough && !busy && !user.chain_error && faucet?.available && !pending && !funding && !error && !requested.current) {
      requested.current = true; void topUp();
    }
  }, [enough, busy, user.chain_error, faucet?.available, pending, funding, error]);
  const unavailable = faucet && !faucet.available && !pending && !funding;
  return <section className="funding-step" aria-label="Preparing your wallet">
    <div className="join-progress" role="status">{!error && (!unavailable || enough) && <span className="join-spinner" aria-hidden="true"/>}<p>{enough ? 'Preparing your entry…' : user.chain_error ? 'Checking your balance…' : unavailable ? 'Your wallet needs play funds to join.' : 'Adding free play funds…'}</p></div>
    {!enough && <p className="funding-cost">{money(minimum)} NEAR needed · {money(user.balance,4)} NEAR available</p>}
    {unavailable && !enough && <p className="wallet-quiet-status">{faucet.reason === 'cooldown' ? `Your next free top-up is ${new Date(faucet.claim!.next_claim_at).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}.` : 'The free top-up service is unavailable. Add test NEAR to this wallet and we’ll continue automatically.'}</p>}
    {error && <div className="join-error"><p className="inline-error" role="alert">{error}</p><button className="secondary full" disabled={funding || checking} onClick={() => void (user.chain_error ? check() : topUp())}>Retry</button></div>}
    {user.chain_error && !error && <button className="secondary full" disabled={checking} onClick={() => void check()}>{checking ? 'Checking…' : 'Retry connection'}</button>}
    {unavailable && !enough && <a className="secondary full" href="https://near-faucet.io/" target="_blank" rel="noreferrer">Get test NEAR ↗</a>}
  </section>;
}
