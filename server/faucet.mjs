import {createHash,randomUUID} from 'node:crypto';
import {Account,actions,baseEncode,encodeTransaction,decodeSignedTransaction} from 'near-api-js';
import {provider,assertTestnet,contractId} from './near.mjs';

const UNIT=10n**24n,DAY=86400000;
export const FAUCET_AMOUNT=(10n*UNIT).toString();
const RESERVE=UNIT/10n, MINIMUM_GRANT=UNIT/4n, GRANT_STEP=UNIT/100n;
export function faucetGrant(reserve,balance=0n){const available=reserve>RESERVE?reserve-RESERVE:0n,needed=10n*UNIT-balance;const amount=(available<needed?available:needed)/GRANT_STEP*GRANT_STEP;return amount>=MINIMUM_GRANT?amount:0n;}
export function liveFaucet(){
 const id=process.env.NEAR_FAUCET_ACCOUNT,key=process.env.NEAR_FAUCET_PRIVATE_KEY;
 const enabled=Boolean(id&&key);
 if(enabled&&(!id.endsWith('.testnet')||[contractId,process.env.NEAR_ORACLE_ACCOUNT].includes(id)))throw Error('Use a separate .testnet faucet account, never the escrow or oracle.');
 const signer=enabled?new Account(id,provider,key):null;
 return {enabled,id,
  network:assertTestnet,
  balance:async account=>BigInt(await new Account(account,provider).getBalance()),
  async prepare(recipient,amount){const tx=await signer.createSignedTransaction({receiverId:recipient,actions:[actions.transfer(BigInt(amount))]});return {hash:baseEncode(createHash('sha256').update(encodeTransaction(tx.transaction)).digest()),signed:Buffer.from(encodeTransaction(tx)).toString('base64')};},
  send:signed=>provider.sendTransactionUntil(decodeSignedTransaction(Buffer.from(signed,'base64')),'FINAL'),
  status:hash=>provider.viewTransactionStatus({txHash:hash,accountId:id,waitUntil:'FINAL'})
 };
}
export function createFaucet(store,{chain=liveFaucet(),now=Date.now}={}){
 const db=store.db;let busy=false;
 const latest=async id=>(await db.prepare("SELECT * FROM faucet_claims WHERE user_id=$1 AND status!='failed' ORDER BY created DESC LIMIT 1").get(id));
 const result=row=>({status:row.status,amount:row.amount,transaction_hash:row.tx_hash,explorer:`https://testnet.nearblocks.io/txns/${row.tx_hash}`,next_claim_at:row.created+DAY});
 let reserveCache=null;
 async function reserveBalance(){if(!reserveCache||reserveCache.until<now()){const balance=await chain.balance(chain.id);reserveCache={balance,until:now()+10000};}return reserveCache.balance;}
 const status=async u=>{
  const last=u?(await latest(u.id)):null,base={enabled:chain.enabled,amount:FAUCET_AMOUNT,claim:last?result(last):null};
  if(!chain.enabled)return {...base,available:false,reason:'unavailable',message:'Test NEAR top-ups are temporarily unavailable. Your invitation is saved.'};
  if(last?.status==='pending')return {...base,available:true,reason:'pending',amount:last.amount};
  if(last&&last.created+DAY>now())return {...base,available:false,reason:'cooldown',amount:last.amount};
  try{
   await chain.network();
   const [reserve,balance]=await Promise.all([reserveBalance(),u?.kind==='wallet'?(await chain.balance(u.id)):0n]);
   if(balance>=10n*UNIT)return {...base,available:false,reason:'funded',message:'Your wallet already has enough test NEAR.'};
   const grant=faucetGrant(reserve,balance);
   return {...base,amount:grant.toString(),available:grant>0n,reason:grant>0n?'ready':'empty',message:grant>0n?'':'Test NEAR top-ups are temporarily out of funds. Your room invitation is saved.'};
  }catch{return {...base,available:false,reason:'offline',message:'We couldn’t reach NEAR testnet. Retry to check your balance and top-up availability.'};}
 };

 async function accept(row,tx){
  if(tx.transaction?.hash!==row.tx_hash)throw Error('Faucet confirmation did not match the prepared transaction.');
  if(tx.final_execution_status!=='FINAL')return result(row);
  const states=[tx.status,...(tx.receipts_outcome||[]).map(r=>r.outcome.status)];
  if(states.some(s=>s&&typeof s==='object'&&'Failure'in s)){(await db.prepare("UPDATE faucet_claims SET status='failed',signed_tx='' WHERE id=$1").run(row.id));throw Error('The testnet transfer failed. You can request again.');}
  if(!tx.status||typeof tx.status!=='object'||!('SuccessValue'in tx.status))return result(row);
  (await db.prepare("UPDATE faucet_claims SET status='confirmed',signed_tx='' WHERE id=$1").run(row.id));return result({...row,status:'confirmed'});
 }
 async function recover(row){
  try{return (await accept(row,await chain.status(row.tx_hash)));}catch(e){if((await db.prepare('SELECT status FROM faucet_claims WHERE id=$1').get(row.id)).status==='failed')throw e;}
  // Re-broadcast the same signed transaction, never mint a new transfer on retry.
  try{return (await accept(row,await chain.send(row.signed_tx)));}catch(e){if((await db.prepare('SELECT status FROM faucet_claims WHERE id=$1').get(row.id)).status==='failed')throw e;return result(row);}
 }
 async function claim(u,ip){
  if(u?.kind!=='wallet')throw Error('Connect your NEAR testnet wallet first.');
  if(!chain.enabled)throw Error('Test NEAR top-ups are temporarily unavailable. Your room invitation is saved.');
  if(!u.id.endsWith('.testnet')&&!/^[a-f0-9]{64}$/.test(u.id))throw Error('Use a NEAR testnet wallet.');
  if(u.id===chain.id)throw Error('The faucet cannot fund itself.');
  if(busy)throw Error('Another testnet top-up is confirming. Try again in a moment.');
  busy=true;
  try{return await db.withLock('faucet',async()=>{
   await chain.network();
   const last=(await latest(u.id));
   if(last?.status==='pending')return await recover(last);
   if(last&&last.created+DAY>now())return result(last);
   const outstanding=(await db.prepare("SELECT * FROM faucet_claims WHERE status='pending' ORDER BY created LIMIT 1").get());
   if(outstanding){try{const recovered=await recover(outstanding);if(recovered.status==='pending')throw Error('Another testnet top-up is still confirming. Try again shortly.');}catch(e){if((await db.prepare('SELECT status FROM faucet_claims WHERE id=$1').get(outstanding.id)).status!=='failed')throw e;}}
   const digest=createHash('sha256').update('nearfest-faucet:'+ip).digest('hex'),since=now()-3600000;
   const recent=(await db.prepare("SELECT count(*) AS count FROM faucet_claims WHERE created>$1 AND status!='failed'").get(since)).count;
   const sameIp=(await db.prepare("SELECT count(*) AS count FROM faucet_claims WHERE ip_hash=$1 AND created>$2 AND status!='failed'").get(digest,since)).count;
   const daily=(await db.prepare("SELECT count(*) AS count FROM faucet_claims WHERE created>$1 AND status!='failed'").get(now()-DAY)).count;
   if(recent>=10||sameIp>=5||daily>=20)throw Error('The demo faucet has reached its top-up limit. Try later or use the backup faucet.');
   const [balance,reserve]=await Promise.all([chain.balance(u.id),chain.balance(chain.id)]);
   if(balance>=10n*UNIT)throw Error('Your wallet already has at least 10 test NEAR. Top up here when it falls below 10 NEAR.');
   const grant=faucetGrant(reserve,balance);
   if(!grant)throw Error('Test NEAR top-ups are temporarily out of funds. Your room invitation is saved.');
   reserveCache=null;
   const prepared=await chain.prepare(u.id,grant.toString()),row={id:randomUUID(),user_id:u.id,ip_hash:digest,created:now(),status:'pending',amount:grant.toString(),tx_hash:prepared.hash,signed_tx:prepared.signed};
   await db.transaction(async()=>{await db.prepare('INSERT INTO faucet_claims(id,user_id,ip_hash,created,status,tx_hash,signed_tx,amount) VALUES($1,$2,$3,$4,$5,$6,$7,$8)').run(row.id,row.user_id,row.ip_hash,row.created,row.status,row.tx_hash,row.signed_tx,row.amount);await store.jobs?.schedule('faucet',row.id,Date.now()+20000);});
   try{return (await accept(row,await chain.send(row.signed_tx)));}catch(e){if((await db.prepare('SELECT status FROM faucet_claims WHERE id=$1').get(row.id)).status==='failed')throw e;return result(row);}
  });}finally{busy=false;}
 }
 async function recoverClaim(id){
  if(!chain.enabled)return false;
  return db.withLock('faucet',async()=>{
   const row=await db.prepare("SELECT * FROM faucet_claims WHERE id=$1 AND status='pending'").get(id);if(!row)return false;
   await chain.network();const claim=await recover(row);
   if(claim.status==='pending')throw Error('The prepared faucet transfer is still confirming.');
   return true;
  });
 }
 async function tick(){
  if(busy||!chain.enabled)return false;busy=true;
  try{return await db.withLock('faucet',async()=>{
   const row=await db.prepare("SELECT * FROM faucet_claims WHERE status='pending' ORDER BY created LIMIT 1").get();
   if(!row)return false;
   try{await chain.network();await recover(row);}catch{}
   return (await db.prepare('SELECT status FROM faucet_claims WHERE id=$1').get(row.id)).status!=='pending';
  });}finally{busy=false;}
 }

 async function history(u){return (await db.prepare('SELECT id,amount,created,status,tx_hash FROM faucet_claims WHERE user_id=$1 ORDER BY created DESC LIMIT 30').all(u.id)).map(row=>({id:row.id,title:'Test NEAR top-up',operation:'top_up',amount:row.amount,created_at:row.created,status:row.status,explorer:`https://testnet.nearblocks.io/txns/${row.tx_hash}`}));}
 return {claim,status,tick,history,recoverClaim,enabled:chain.enabled};
}
