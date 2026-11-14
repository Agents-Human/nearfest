import {useEffect,useRef,useState} from 'react';
import {api,type User} from './api';
import {signInAccount,connectWallet} from './wallet';
import WalletFunding from './WalletFunding';
import Modal from './Modal';
import UiIcon from './UiIcon';
import {hasAccess,type AccessRequest} from './account-access';
import './onboarding.css';

export default function Onboarding({user,request,updated,done,close}:{
 user:User|null;request:AccessRequest;updated:(user:User)=>void;done:()=>void;close:()=>void;
}){
 const [username,setUsername]=useState(''),[password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[joining,setJoining]=useState(false);
 const running=useRef(false),attempted=useRef(false);
 const needsFunds=Boolean(user?.kind==='wallet'&&!hasAccess(user,request)),minimum=request.minimum||'0';
 async function run(action:()=>Promise<void>){if(running.current)return;running.current=true;setBusy(true);setError('');try{await action();}catch(error){setError((error as Error).message);}finally{running.current=false;setBusy(false);}}
 async function refresh(){const next=await api<User|null>('/me');if(!next)throw Error('Sign in to your NearFest account again.');updated(next);return next;}
 async function finish(){attempted.current=true;setJoining(true);try{await request.next?.();done();}catch(error){setJoining(false);throw error;}}
 useEffect(()=>{if(hasAccess(user,request)&&!attempted.current&&!running.current)void run(finish);},[user?.id,user?.balance,user?.chain_error,user?.starter_funded]);
 async function signIn(){const next=await signInAccount(username.trim(),password);setPassword('');updated(next);if(hasAccess(next,request))await finish();}
 return <Modal className="onboarding-modal" dismissible={!busy} title={request.label||'Welcome to NearFest'} close={()=>{if(!busy)close();}}>
  <div className="onboarding">
   {!joining&&!needsFunds&&<>
    <p className="modal-intro">Enter a username and password to play. New accounts start with 10 free test NEAR; existing accounts sign straight in.</p>
    <form onSubmit={event=>{event.preventDefault();void run(signIn);}}>
     <label>Username<input value={username} onChange={event=>setUsername(event.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Choose or enter a player name" pattern="[a-zA-Z0-9][a-zA-Z0-9_.\-]{2,23}" title="3–24 characters: start with a letter or number, then letters, numbers, dots, hyphens, or underscores." minLength={3} maxLength={24} required disabled={busy}/></label>
     <label>Password<input type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete="current-password" minLength={10} maxLength={128} placeholder="At least 10 characters" required disabled={busy}/></label>
     <button className="primary full" disabled={busy}>{busy?'Continuing…':'Continue & play'}<UiIcon name="arrow" size={17}/></button>
    </form>
    <p className="fine-print">Test NEAR is for playing on testnet. Save your username and password to return on any device.</p>
    <details className="existing-wallet"><summary>Already played with a NEAR wallet?</summary><button className="text-button full" disabled={busy} onClick={()=>void run(async()=>{const next=await connectWallet();updated(next);if(hasAccess(next,request))await finish();})}>Use existing wallet</button></details>
   </>}
   {needsFunds&&!joining&&user&&<WalletFunding user={user} busy={busy} refresh={refresh} minimum={minimum}/>}
   {joining&&<div className="join-progress" role="status"><span className="join-spinner" aria-hidden="true"/><p>{request.next?'Opening your room…':'Getting ready…'}</p></div>}
   {error&&<div className="join-error"><p className="inline-error" role="alert">{error}</p>{attempted.current&&<button className="secondary full" disabled={busy} onClick={()=>void run(finish)}>Try again</button>}</div>}
  </div>
 </Modal>;
}
