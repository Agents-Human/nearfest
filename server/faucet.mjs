import {createHash,randomUUID} from 'node:crypto';
import {Account,actions,baseEncode,encodeTransaction,decodeSignedTransaction} from 'near-api-js';
import {provider,assertTestnet,contractId} from './near.mjs';

const UNIT=10n**24n,DAY=86400000;
export const FAUCET_AMOUNT=(10n*UNIT).toString();
export function liveFaucet(){
 const id=process.env.NEAR_FAUCET_ACCOUNT,key=process.env.NEAR_FAUCET_PRIVATE_KEY;
 const enabled=Boolean(id&&key);
 if(enabled&&(!id.endsWith('.testnet')||[contractId,process.env.NEAR_ORACLE_ACCOUNT].includes(id)))throw Error('Use a separate .testnet faucet account, never the escrow or oracle.');
 const signer=enabled?new Account(id,provider,key):null;
 return {enabled,id,
  network:assertTestnet,
  balance:async account=>BigInt((await provider.viewAccount({accountId:account,blockQuery:{finality:'final'}})).amount),
  async prepare(recipient,amount){const tx=await signer.createSignedTransaction({receiverId:recipient,actions:[actions.transfer(BigInt(amount))]});return {hash:baseEncode(createHash('sha256').update(encodeTransaction(tx.transaction)).digest()),signed:Buffer.from(encodeTransaction(tx)).toString('base64')};},
  send:signed=>provider.sendTransactionUntil(decodeSignedTransaction(Buffer.from(signed,'base64')),'FINAL'),
  status:hash=>provider.viewTransactionStatus({txHash:hash,accountId:id,waitUntil:'FINAL'})
 };
}
export function createFaucet(store,{chain=liveFaucet(),now=Date.now}={}){
 const db=store.db;let busy=false;
 db.exec(`CREATE TABLE IF NOT EXISTS faucet_claims(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,ip_hash TEXT NOT NULL,created INTEGER NOT NULL,status TEXT NOT NULL,tx_hash TEXT NOT NULL,signed_tx TEXT NOT NULL);CREATE INDEX IF NOT EXISTS faucet_user ON faucet_claims(user_id,created);`);
 if(!db.prepare('PRAGMA table_info(faucet_claims)').all().some(c=>c.name==='amount'))db.exec("ALTER TABLE faucet_claims ADD COLUMN amount TEXT NOT NULL DEFAULT '1000000000000000000000000'");
 const latest=id=>db.prepare("SELECT * FROM faucet_claims WHERE user_id=? AND status!='failed' ORDER BY created DESC LIMIT 1").get(id);
 const result=row=>({status:row.status,amount:row.amount,transaction_hash:row.tx_hash,explorer:`https://testnet.nearblocks.io/txns/${row.tx_hash}`,next_claim_at:row.created+DAY});
 const status=u=>{const last=u?latest(u.id):null;return {enabled:chain.enabled,amount:FAUCET_AMOUNT,claim:last?result(last):null};};
 function accept(row,tx){
  if(tx.transaction?.hash!==row.tx_hash)throw Error('Faucet confirmation did not match the prepared transaction.');
  if(tx.final_execution_status!=='FINAL')return result(row);
  const states=[tx.status,...(tx.receipts_outcome||[]).map(r=>r.outcome.status)];
  if(states.some(s=>s&&typeof s==='object'&&'Failure'in s)){db.prepare("UPDATE faucet_claims SET status='failed',signed_tx='' WHERE id=?").run(row.id);throw Error('The testnet transfer failed. You can request again.');}
  if(!tx.status||typeof tx.status!=='object'||!('SuccessValue'in tx.status))return result(row);
  db.prepare("UPDATE faucet_claims SET status='confirmed',signed_tx='' WHERE id=?").run(row.id);return result({...row,status:'confirmed'});
 }
 async function recover(row){
  try{return accept(row,await chain.status(row.tx_hash));}catch(e){if(db.prepare('SELECT status FROM faucet_claims WHERE id=?').get(row.id).status==='failed')throw e;}
  // Re-broadcast the same signed transaction, never mint a new transfer on retry.
  try{return accept(row,await chain.send(row.signed_tx));}catch(e){if(db.prepare('SELECT status FROM faucet_claims WHERE id=?').get(row.id).status==='failed')throw e;return result(row);}
 }
 async function claim(u,ip){
  if(u?.kind!=='wallet')throw Error('Connect your NEAR testnet wallet first.');
  if(!chain.enabled)throw Error('The in-app faucet is not connected. Use the backup faucet below.');
  if(!u.id.endsWith('.testnet')&&!/^[a-f0-9]{64}$/.test(u.id))throw Error('Use a NEAR testnet wallet.');
  if(u.id===chain.id)throw Error('The faucet cannot fund itself.');
  if(busy)throw Error('Another testnet top-up is confirming. Try again in a moment.');
  busy=true;
  try{
   await chain.network();
   const last=latest(u.id);
   if(last?.status==='pending')return await recover(last);
   if(last&&last.created+DAY>now())return result(last);
   const outstanding=db.prepare("SELECT * FROM faucet_claims WHERE status='pending' ORDER BY created LIMIT 1").get();
   if(outstanding){try{const recovered=await recover(outstanding);if(recovered.status==='pending')throw Error('Another testnet top-up is still confirming. Try again shortly.');}catch(e){if(db.prepare('SELECT status FROM faucet_claims WHERE id=?').get(outstanding.id).status!=='failed')throw e;}}
   const digest=createHash('sha256').update('nearfest-faucet:'+ip).digest('hex'),since=now()-3600000;
   const recent=db.prepare("SELECT count(*) AS count FROM faucet_claims WHERE created>? AND status!='failed'").get(since).count;
   const sameIp=db.prepare("SELECT count(*) AS count FROM faucet_claims WHERE ip_hash=? AND created>? AND status!='failed'").get(digest,since).count;
   const daily=db.prepare("SELECT count(*) AS count FROM faucet_claims WHERE created>? AND status!='failed'").get(now()-DAY).count;
   if(recent>=10||sameIp>=5||daily>=20)throw Error('The demo faucet has reached its top-up limit. Try later or use the backup faucet.');
   const [balance,reserve]=await Promise.all([chain.balance(u.id),chain.balance(chain.id)]);
   if(balance>=10n*UNIT)throw Error('Your wallet already has at least 10 test NEAR. Top up here when it falls below 10 NEAR.');
   if(reserve<BigInt(FAUCET_AMOUNT)+UNIT/10n)throw Error('The demo faucet needs refilling. Use the backup faucet for now.');
   const prepared=await chain.prepare(u.id,FAUCET_AMOUNT),row={id:randomUUID(),user_id:u.id,ip_hash:digest,created:now(),status:'pending',amount:FAUCET_AMOUNT,tx_hash:prepared.hash,signed_tx:prepared.signed};
   db.prepare('INSERT INTO faucet_claims(id,user_id,ip_hash,created,status,tx_hash,signed_tx,amount) VALUES(?,?,?,?,?,?,?,?)').run(row.id,row.user_id,row.ip_hash,row.created,row.status,row.tx_hash,row.signed_tx,row.amount);
   try{return accept(row,await chain.send(row.signed_tx));}catch(e){if(db.prepare('SELECT status FROM faucet_claims WHERE id=?').get(row.id).status==='failed')throw e;return result(row);}
  }finally{busy=false;}
 }
 return {claim,status};
}
