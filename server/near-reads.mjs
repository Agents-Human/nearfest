/** Coalesce identical reads and back off on rate limits. Never retry a signed transaction here. */
export function createNearReader({wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),retries=3}={}){
 const pending=new Map();
 return function read(key,operation){
  if(pending.has(key))return pending.get(key);
  const task=(async()=>{for(let attempt=0;;attempt++){try{return await operation();}catch(error){if(attempt>=retries||!(error?.cause===429||/rate limit|"code"\s*:\s*-?429/i.test(error?.message||'')))throw error;await wait(2000*2**attempt);}}})().finally(()=>pending.delete(key));
  pending.set(key,task);return task;
 };
}
export function availableBalance(state,costPerByte){
 const locked=BigInt(state.locked),storage=BigInt(state.storage_usage)*BigInt(costPerByte),total=BigInt(state.amount)+locked;
 const available=total-(locked>storage?locked:storage);return available>0n?available:0n;
}
