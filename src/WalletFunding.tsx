import {useEffect, useRef} from 'react';
import {money, type User} from './api';
import useWalletFunding from './useWalletFunding';
import './wallet-panel.css';

/** Funding is a continuation of Join, never another confirmation screen. */
export default function WalletFunding({user, busy, refresh, minimum = '0'}: {
  user: User; busy: boolean; refresh: () => unknown | Promise<unknown>; minimum?: string;
}) {
  const {faucet, funding, checking, error, pending, check, topUp} = useWalletFunding(user, refresh);
  const enough = (!user.managed || user.starter_funded) && !user.chain_error && BigInt(user.balance) >= BigInt(minimum), requested = useRef(false);
  const fundingError = error || (!user.starter_funded && user.account_funding_error ? user.account_funding_error : '');
  useEffect(() => {
    if (!enough && !busy && (!user.chain_error || user.managed) && faucet?.available && !pending && !funding && !fundingError && !requested.current) {
      requested.current = true; void topUp();
    }
  }, [enough, busy, user.chain_error, faucet?.available, pending, funding, fundingError]);
  const unavailable = faucet && !faucet.available && !pending && !funding;
  return <section className="funding-step" aria-label="Preparing your account">
    <div className="join-progress" role="status">{!fundingError && (!unavailable || enough) && <span className="join-spinner" aria-hidden="true"/>}<p>{enough ? 'Preparing your entry…' : fundingError ? 'Starting funds need a quick retry.' : user.chain_error ? 'Checking your balance…' : unavailable ? 'Your account needs play funds to join.' : 'Adding free play funds…'}</p></div>
    {!enough && <p className="funding-cost">{money(minimum)} NEAR needed · {money(user.balance,4)} NEAR available</p>}
    {unavailable && !enough && !fundingError && <p className="wallet-quiet-status">{faucet.reason === 'cooldown' ? `Your next free top-up is ${new Date(faucet.claim!.next_claim_at).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}.` : 'Free test NEAR is temporarily unavailable. Your account and room invitation are saved; retry when funding is ready.'}</p>}
    {fundingError && <div className="join-error"><p className="inline-error" role="alert">{fundingError}</p><button className="secondary full" disabled={funding || checking} onClick={() => void (user.chain_error && user.starter_funded ? check() : topUp())}>Retry</button></div>}
    {user.chain_error && user.starter_funded && !fundingError && <button className="secondary full" disabled={checking} onClick={() => void check()}>{checking ? 'Checking…' : 'Retry connection'}</button>}
  </section>;
}
