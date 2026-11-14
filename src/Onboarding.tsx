import {useState} from 'react';
import {api, type User} from './api';
import {connectWallet} from './wallet';
import WalletFunding from './WalletFunding';
import Modal from './Modal';
import {hasAccess, type AccessRequest} from './account-access';
import './onboarding.css';

export default function Onboarding({user, request, updated, done, close}: {
  user: User | null; request: AccessRequest; updated: (user: User) => void;
  done: () => void; close: () => void;
}) {
  const [step, setStep] = useState(user?.kind === 'wallet' ? user.name===user.id?'profile':'fund' : user ? 'wallet' : 'profile');
  const [name, setName] = useState(user?.name || sessionStorage.getItem('nearfest-player-name') || '');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const minimum = request.minimum || '0';
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function refresh() {
    const next = await api<User | null>('/me');
    if (!next) throw Error('Your session expired. Connect your wallet again.');
    updated(next); return next;
  }
  async function connect() {
    const next = await connectWallet(name.trim() || undefined);
    updated(next); setName(next.name);
    if(next.name===next.id){setStep('profile');return;}
    if(hasAccess(next,request)){setStep('fund');await request.next?.();sessionStorage.removeItem('nearfest-player-name');done();}
    else setStep('fund');
  }
  async function finish() {
    const next = await refresh();
    if (!hasAccess(next, request)) throw Error('Add test NEAR to continue.');
    await request.next?.();
    sessionStorage.removeItem('nearfest-player-name'); done();
  }
  return <Modal dismissible={!busy} title={step === 'profile' ? 'Set up your account' : step === 'wallet' ? 'Connect your wallet' : hasAccess(user,request)?'Ready to join':'Add test NEAR'} close={() => {if (!busy) close();}}>
    <div className="onboarding">
      <ol className="onboarding-steps" aria-label="Account setup">
        {['Account', 'Wallet', 'Continue'].map((label, i) => <li key={label} aria-current={i === (step === 'profile' ? 0 : step === 'wallet' ? 1 : 2) ? 'step' : undefined}><span>{i + 1}</span>{label}</li>)}
      </ol>
      {request.label && <p className="onboarding-destination">{request.label}</p>}
      {step === 'profile' && <>
        <p className="modal-intro">Choose the name your friends will see.</p>
        <form onSubmit={e => {e.preventDefault(); void run(async () => {
          const displayName = name.trim();
          if (displayName.length < 2) throw Error('Choose a name with at least two characters.');
          sessionStorage.setItem('nearfest-player-name', displayName);
          if (user) updated(await api<User>('/profile', {name: displayName}));
          setStep(user?.kind === 'wallet' ? 'fund' : 'wallet');
        });}}>
          <label>Your player name<input value={name} onChange={e => setName(e.target.value)} autoComplete="nickname" placeholder="What should we call you?" minLength={2} maxLength={24} required/></label>
          <button className="primary full" disabled={busy}>{busy ? 'Saving…' : 'Continue →'}</button>
        </form>
        {!user && <button className="text-button full" disabled={busy} onClick={() => void run(connect)}>Already have an account? Connect your wallet</button>}
      </>}
      {step === 'wallet' && <>
        <p className="modal-intro">Connect a wallet to continue, {name || user?.name}.</p>
        <button className="primary full" disabled={busy} onClick={() => void run(connect)}>{busy ? 'Waiting for your wallet…' : 'Connect or create a wallet →'}</button>
        <p className="fine-print">Testnet only. Signing in is free.</p>
        {!request.wallet && <button className="secondary full" disabled={busy} onClick={() => void run(async () => {
          const next = user || await api<User>('/session/guest', {name: name.trim()});
          updated(next); await request.next?.(); done();
        })}>Continue with free play</button>}
        <button className="text-button full" disabled={busy} onClick={() => setStep('profile')}>Edit player name</button>
      </>}
      {step === 'fund' && user?.kind === 'wallet' && <>
        <WalletFunding user={user} busy={busy} refresh={refresh} minimum={minimum} ready={{label:request.label||'Continue',onClick:()=>void run(finish)}}/>
      </>}
      {error && <p className="inline-error" role="alert">{error}</p>}
    </div>
  </Modal>;
}
