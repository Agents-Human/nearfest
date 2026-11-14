/** A wallet callback is not proof of payment. Confirm finalized escrow, sending at most once. */
export async function confirmWalletAction({confirm,send,wait=()=>new Promise(resolve=>setTimeout(resolve,1500)),attempts=80,now=Date.now,timeoutMs=120000,onStatus=()=>{},signal}) {
  signal?.throwIfAborted();
  const deadline=now()+timeoutMs;
  let walletError=null, failedAt=null, lastError, finished=false;
  onStatus(send?'wallet':'confirming');
  // Some wallet popups never resolve this promise even though their transaction succeeds.
  if(send) Promise.resolve().then(send).then(()=>{if(!finished)onStatus('confirming');},error=>{
    walletError=error;failedAt=now();if(!finished)onStatus('confirming');
  });
  for(let attempt=0;attempt<attempts;attempt++){
    signal?.throwIfAborted();
    try{const result=await confirm();finished=true;onStatus('confirmed');return result;}catch(error){lastError=error;}
    // A wallet may report an error after broadcast. Allow finality to catch up before failing.
    if(failedAt!==null&&now()-failedAt>=10000)break;
    if(now()>=deadline||attempt===attempts-1)break;
    await wait();
  }
  finished=true;onStatus('pending');
  const detail=walletError instanceof Error?walletError.message:lastError instanceof Error?lastError.message:'';
  throw new Error('Payment is not confirmed yet. Check the pending payment before trying again; no second payment has been sent.'+(detail?' '+detail:''));
}
