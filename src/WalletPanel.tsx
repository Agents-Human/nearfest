import {useEffect, useState} from 'react';
import {money, type User} from './api';
import useWalletFunding from './useWalletFunding';
import NearPending from './NearPending';
import type useWalletRecovery from './useWalletRecovery';
import './wallet-panel.css';

type Recovery = ReturnType<typeof useWalletRecovery>;
export default function WalletPanel({user, refresh, collect, switchAccount, recovery}: {
  user: User; refresh: () => Promise<unknown>; collect: () => Promise<void>; switchAccount: () => Promise<void>; recovery: Recovery;
}) {
  const funding = useWalletFunding(user, refresh);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [copied, setCopied] = useState(false);
  const credit = BigInt(user.credit), collecting = BigInt(user.pending || '0') > 0n;
  useEffect(() => {if (!collecting) return; const timer = setInterval(() => void funding.check(), 10000); return () => clearInterval(timer);}, [collecting]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); try {await action();} catch (e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  const disabled = busy || funding.funding || funding.checking;
  return <div className="wallet-panel">
    <div className="wallet-person"><div><b>{user.name}</b><span title={user.id}>{user.id}</span></div><span className="wallet-network">Testnet</span></div>
    <div className="wallet-balance-line"><span>Available balance</span><strong>{user.chain_error ? '—' : money(user.balance, 4)} <small>NEAR</small></strong></div>
    {user.chain_error && <button className="text-button" disabled={funding.checking} onClick={() => void funding.check()}>{funding.checking ? 'Checking…' : 'Retry balance check'}</button>}
    {(credit > 0n || collecting) && <div className="wallet-collect-row"><div><b>{money(collecting ? user.pending : user.credit)} NEAR</b><span>{collecting ? 'Arriving in your wallet…' : 'Ready to collect'}</span></div>{!collecting && <button className="primary" disabled={disabled} onClick={() => void run(collect)}>{busy ? 'Collecting…' : 'Collect'}</button>}</div>}
    <details className="wallet-top-up" open={!user.chain_error && BigInt(user.balance) === 0n ? true : undefined}>
      <summary>Add test NEAR <span aria-hidden="true">+</span></summary>
      <div>{funding.pending || funding.funding ? <p role="status">Adding test NEAR…</p>
        : funding.faucet?.available ? <button className={credit > 0n ? 'secondary full' : 'primary full'} disabled={disabled} onClick={() => void funding.topUp()}>Add {money(funding.faucet.amount)} free test NEAR</button>
        : <p>{!funding.faucet ? 'Checking availability…' : funding.faucet.reason === 'cooldown' ? `Free top-up available ${new Date(funding.faucet.claim!.next_claim_at).toLocaleDateString(undefined, {day:'numeric', month:'short'})}.` : funding.faucet.reason === 'funded' ? 'Your wallet is already funded.' : 'Free top-ups are temporarily unavailable.'}</p>}
        {funding.faucet && !funding.faucet.available && !funding.pending && funding.faucet.reason !== 'funded' && <a href="https://near-faucet.io/" target="_blank" rel="noreferrer">Use the public faucet ↗</a>}
      </div>
    </details>
    {funding.message && !funding.pending && <p className="wallet-quiet-status" role="status">{funding.message}</p>}
    {(error || funding.error) && <p className="inline-error" role="alert">{error || funding.error}</p>}
    <details className="wallet-activity"><summary>Activity{recovery.pending.length > 0 && <span>{recovery.pending.length}</span>}<span className="wallet-disclosure" aria-hidden="true">⌄</span></summary>
      <NearPending {...recovery}/>
      <a className="wallet-history-link" href={`https://testnet.nearblocks.io/address/${encodeURIComponent(user.id)}`} target="_blank" rel="noreferrer">View all wallet transactions ↗</a>
    </details>
    <div className="wallet-panel-footer"><button className="text-button" onClick={() => void navigator.clipboard.writeText(user.id).then(() => setCopied(true)).catch(() => setError('Select the wallet address above to copy it.'))}>{copied ? 'Copied' : 'Copy address'}</button><button className="text-button" disabled={disabled} onClick={() => void run(switchAccount)}>Switch wallet</button></div>
  </div>;
}
