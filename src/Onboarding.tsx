import {useEffect, useRef, useState} from 'react';
import {api, type User} from './api';
import {connectWallet} from './wallet';
import WalletFunding from './WalletFunding';
import Modal from './Modal';
import UiIcon from './UiIcon';
import {hasAccess, type AccessRequest} from './account-access';
import './onboarding.css';

type Step = 'profile' | 'wallet' | 'fund' | 'continue' | 'joining';
export default function Onboarding({user, request, updated, done, close}: {
  user: User | null; request: AccessRequest; updated: (user: User) => void;
  done: () => void; close: () => void;
}) {
  const [step, setStep] = useState<Step>(() => hasAccess(user, request) ? 'continue' : user?.kind === 'wallet' ? 'fund' : request.wallet || user ? 'wallet' : 'profile');
  const [name, setName] = useState(user?.name || sessionStorage.getItem('nearfest-player-name') || '');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const running = useRef(false), attempted = useRef(false), signedIn = useRef(false);
  const minimum = request.minimum || '0', paid = request.wallet === true;
  const title = request.label || 'Welcome to NearFest';
  async function run(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    try {await action();} catch (e) {setError((e as Error).message);}
    finally {running.current = false; setBusy(false);}
  }
  async function refresh() {
    const next = await api<User | null>('/me');
    if (!next) throw Error('Your session expired. Connect your wallet again.');
    updated(next); return next;
  }
  async function finish() {
    attempted.current = true; setStep('joining');
    await request.next?.();
    sessionStorage.removeItem('nearfest-player-name'); done();
  }
  async function connect(displayName?: string) {
    const next = await connectWallet(displayName);
    updated(next); setName(next.name);
    if (hasAccess(next, request)) await finish();
    else setStep('fund');
  }
  useEffect(() => {
    if(step === 'wallet' && request.autoConnect && !signedIn.current && !running.current){signedIn.current=true;void run(()=>connect(user?.kind==='practice'?user.name:undefined));}
    if ((step === 'fund' || step === 'continue') && hasAccess(user, request) && !attempted.current && !running.current) void run(finish);
  }, [step, user?.id, user?.balance, user?.chain_error]);
  const joining = step === 'joining' || step === 'continue';
  return <Modal className="onboarding-modal" dismissible={!busy} title={title} close={() => {if (!busy) close();}}>
    <div className="onboarding">
      {step === 'profile' && <>
        <p className="modal-intro">What should your friends call you?</p>
        <form onSubmit={e => {e.preventDefault(); void run(async () => {
          const displayName = name.trim();
          if (displayName.length < 2) throw Error('Choose a name with at least two characters.');
          sessionStorage.setItem('nearfest-player-name', displayName);
          if (paid) await connect(displayName);
          else {const next = await api<User>('/session/guest', {name: displayName}); updated(next); await finish();}
        });}}>
          <label>Player name<input value={name} onChange={e => setName(e.target.value)} autoComplete="nickname" placeholder="Your name" minLength={2} maxLength={24} required/></label>
          <button className="primary full" disabled={busy}>{busy ? 'Connecting…' : paid ? 'Connect wallet & continue' : request.label || 'Start playing'}<UiIcon name="arrow" size={17}/></button>
        </form>
        {paid && <p className="fine-print">Connect once. Test NEAR is added automatically when needed and available.</p>}
        <button className="text-button full" disabled={busy} onClick={() => void run(() => connect())}>{paid ? 'Already have an account? Connect wallet' : 'Use a wallet instead'}</button>
      </>}
      {step === 'wallet' && busy ? <div className="join-progress" role="status"><span className="join-spinner" aria-hidden="true"/><p>Signing you in…</p></div> : step === 'wallet' && <>
        <p className="modal-intro">Sign in once. We’ll handle the setup and open your room.</p>
        <form onSubmit={e=>{e.preventDefault();void run(()=>connect(name.trim()||undefined));}}>
          {!user && <label>Your name <small>Optional</small><input value={name} onChange={e=>setName(e.target.value)} autoComplete="nickname" placeholder="What should friends call you?" minLength={2} maxLength={24}/></label>}
          <button className="primary full" disabled={busy}>{busy ? 'Signing in…' : request.next ? 'Sign in & join' : 'Sign in'}<UiIcon name="arrow" size={17}/></button>
        </form>
        <p className="fine-print">Your wallet will confirm sign-in{request.next?' and the entry':''}.</p>
      </>}
      {step === 'fund' && user?.kind === 'wallet' && <WalletFunding user={user} busy={busy} refresh={refresh} minimum={minimum}/>}
      {joining && !error && <div className="join-progress" role="status"><span className="join-spinner" aria-hidden="true"/><p>{request.next ? paid ? 'Approve the entry in your wallet. We’ll open the room automatically.' : 'Opening your room…' : 'Connecting…'}</p></div>}
      {error && <div className="join-error"><p className="inline-error" role="alert">{error}</p>{joining && <button className="secondary full" disabled={busy} onClick={() => void run(finish)}>Try again</button>}</div>}
    </div>
  </Modal>;
}
