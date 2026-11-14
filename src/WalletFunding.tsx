import {useEffect,useState} from 'react';
import {api,money,type User} from './api';
import UiIcon from './UiIcon';

type Claim={status:'pending'|'confirmed';amount:string;transaction_hash:string;explorer:string;next_claim_at:number};
type Faucet={enabled:boolean;amount:string;claim:Claim|null};
export default function WalletFunding({user,busy,refresh}:{user:User;busy:boolean;refresh:()=>void|Promise<void>}){
 const [copied,setCopied]=useState(false),[copyError,setCopyError]=useState(false),[faucet,setFaucet]=useState<Faucet|null>(null),[funding,setFunding]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{api<Faucet>('/near/faucet').then(setFaucet).catch(()=>setError('Couldn’t check the in-app faucet. Try refreshing this panel.'));},[user.id]);
 const empty=!user.chain_error&&BigInt(user.balance)===0n,pending=faucet?.claim?.status==='pending',cooldown=faucet?.claim?.status==='confirmed'&&faucet.claim.next_claim_at>Date.now();
 async function copy(){try{await navigator.clipboard.writeText(user.id);setCopied(true);setCopyError(false);}catch{setCopyError(true);}}
 async function topUp(){setFunding(true);setError('');setMessage('');try{const claim=await api<Claim>('/near/faucet',{});setFaucet(previous=>previous?{...previous,claim}:previous);setMessage(claim.status==='confirmed'?`${money(claim.amount)} test NEAR delivered to your wallet.`:'Your top-up is confirming. Check its status here in a moment.');await refresh();}catch(e){setError((e as Error).message);}finally{setFunding(false);}}
 return <section className="wallet-funding" aria-label="Wallet balance and funding">
  <span className="wallet-funding-label">Wallet balance · NEAR testnet</span>
  <strong className="wallet-amount" aria-live="polite">{user.chain_error?'Unavailable':<>{money(user.balance)} <small>NEAR</small></>}</strong>
  <p>{user.chain_error?'We couldn’t read your balance. Refresh to try again.':empty?'Add free test NEAR to play for stakes.':'Use this balance for game entries, storage and network fees.'}</p>
  <div className="wallet-address"><span>{user.id}</span><button className="text-button" aria-label="Copy wallet address" onClick={()=>void copy()}>{copied?'Copied ✓':'Copy'}</button></div>
  {copyError&&<small>Select and copy the address above.</small>}
  <div className="wallet-funding-actions"><button className="primary" disabled={busy||funding||!faucet?.enabled||Boolean(cooldown)} onClick={()=>void topUp()}>{funding?'Sending test NEAR…':pending?'Check top-up status':cooldown?'Test NEAR received':`Get ${faucet?money(faucet.amount):'10'} test NEAR`}<UiIcon name="arrow" size={18}/></button><button className="secondary" disabled={busy||funding} onClick={()=>void refresh()}>{busy?'Refreshing…':'Refresh balance'}</button></div>
  {message&&<p role="status">{message}</p>}{error&&<p role="alert" className="inline-error">{error}</p>}
  {faucet?.claim&&<a className="wallet-transfer-link" href={faucet.claim.explorer} target="_blank" rel="noreferrer">View top-up on NEAR ↗</a>}
  <small>{cooldown?`Next top-up: ${new Date(faucet!.claim!.next_claim_at).toLocaleString()}. `:'One top-up per wallet every 24 hours, when your balance is below 10 NEAR. '}Free testnet NEAR, delivered here. No wallet payment required.</small>
  {faucet&&!faucet.enabled&&<small>The in-app faucet is temporarily unavailable.</small>}
  <a className="wallet-backup-faucet" href="https://near-faucet.io/" target="_blank" rel="noreferrer">Use the backup faucet ↗</a>
 </section>;
}
