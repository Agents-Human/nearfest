import {KeyPair,Account,actions,baseEncode,encodeTransaction,decodeSignedTransaction} from 'near-api-js';
import {createHash,randomBytes} from 'node:crypto';
import {accountKey,passwordHash,passwordMatches,encryptKey,decryptKey,verifyAuthorization} from './managed-crypto.mjs';
import {provider,assertTestnet,contractId,assertSuccess,invalidateNearAccount} from './near.mjs';
const GRANT=10n*10n**24n;
const missing=error=>/does not exist|UNKNOWN_ACCOUNT|unknown account/i.test(error.message);
const unconfirmedAccount=error=>/does not exist|UNKNOWN_ACCOUNT|unknown account|UNKNOWN_ACCESS_KEY|access key/i.test(error.message);
export function liveManagedChain(){return {
 contractId,network:assertTestnet,
 async create(id,publicKey){
  await assertTestnet();let account;
  try{account=await provider.viewAccount({accountId:id,blockQuery:{finality:'final'}});}catch(error){if(!missing(error))throw error;}
  let hash=null;
  if(!account){
   const response=await fetch('https://helper.nearprotocol.com/account',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({newAccountId:id,newAccountPublicKey:publicKey}),signal:AbortSignal.timeout(25000)});
   if(!response.ok)throw Error(response.status===429?'Testnet account creation is busy. Retry shortly.':'The testnet funding service is temporarily unavailable. Retry this same account shortly.');
   const receipt=await response.json().catch(()=>null);hash=receipt?.transaction?.hash||receipt?.transaction_hash||null;
  }
  // Poll key and balance together at final so helper visibility resolves in one roundtrip once finalized.
  let access;
  for(let attempt=0;;attempt++){
   try{
    [access,account]=await Promise.all([
     provider.viewAccessKey({accountId:id,publicKey,blockQuery:{finality:'final'}}),
     provider.viewAccount({accountId:id,blockQuery:{finality:'final'}}),
    ]);
    break;
   }catch(error){if(!unconfirmedAccount(error)||attempt>=20)throw error;await new Promise(resolve=>setTimeout(resolve,750));}
  }
  if(access.permission!=='FullAccess')throw Error('The new account key could not be verified.');
  if(BigInt(account.amount)<GRANT)throw Error('Your 10 test NEAR starting balance is still being prepared. Retry shortly.');
  return {status:'confirmed',amount:GRANT.toString(),transaction_hash:hash,explorer:'https://testnet.nearblocks.io/address/'+id};
 },
 async prepare(id,key,transaction){
  const account=new Account(id,provider,key),call=transaction.actions[0].params;
  const signed=await account.createSignedTransaction({receiverId:transaction.receiverId,actions:[actions.functionCall(call.methodName,call.args,BigInt(call.gas),BigInt(call.deposit))]});
  return {hash:baseEncode(createHash('sha256').update(encodeTransaction(signed.transaction)).digest()),signed:Buffer.from(encodeTransaction(signed)).toString('base64')};
 },
 send:signed=>provider.sendTransactionUntil(decodeSignedTransaction(Buffer.from(signed,'base64')),'FINAL'),
 status:(hash,id)=>provider.viewTransactionStatus({txHash:hash,accountId:id,waitUntil:'FINAL'})
};}
function username(value){
 if(typeof value!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,23}$/.test(value))throw Error('Use a username with 3–24 letters, numbers, dots, hyphens or underscores.');
 return value.toLowerCase();
}
export function createManagedAccounts(store,{faucet,key=accountKey(),chain=liveManagedChain(),review=async()=>{},now=Date.now}={}){
 const {db}=store;
 const enabled=Boolean(key);
 const lease=(lockKey,fn)=>db.withLease?db.withLease(lockKey,fn):db.withLock(lockKey,fn);
 const available=()=>{if(!enabled)throw Error('Account setup is temporarily unavailable. Please try again shortly.');};
 const record=id=>db.prepare('SELECT * FROM managed_accounts WHERE user_id=$1').get(id);
 async function info(user){if(!user)return null;const row=await db.prepare('SELECT username,funded_at FROM managed_accounts WHERE user_id=$1').get(user.id);return row?{managed:true,username:row.username,starter_funded:Boolean(row.funded_at)}:{managed:false};}
 async function authenticate(data){
  available();const name=username(data.username),row=await db.prepare('SELECT * FROM managed_accounts WHERE username=$1').get(name);
  // A missing username still performs scrypt, keeping the failure path comparable.
  const hash=row?.password_hash||'scrypt:AAAAAAAAAAAAAAAAAAAAAA==:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  if(!await passwordMatches(data.password,hash)||!row)throw Error('Username or password is incorrect.');
  return store.user(row.user_id);
 }
 async function register(data){
  available();const name=username(data.username);
  const existing=await db.prepare('SELECT * FROM managed_accounts WHERE username=$1').get(name);
  if(existing){
   if(!await passwordMatches(data.password,existing.password_hash))throw Error('That username is already taken, or the password is incorrect.');
   return store.user(existing.user_id);
  }
  await review(name);const hashed=await passwordHash(data.password);
  const pair=KeyPair.fromRandom('ed25519'),id='nf-'+randomBytes(12).toString('hex')+'.testnet',encrypted=encryptKey(pair.toString(),id,key);
  try{return await db.transaction(async()=>{
   const user=await store.ensureUser(id,name,'wallet');
   await db.prepare('INSERT INTO managed_accounts(user_id,username,password_hash,encrypted_key,created) VALUES($1,$2,$3,$4,$5)').run(id,name,hashed,encrypted,now());return user;
  });}catch(error){
   if(error.code!=='23505')throw error;
   // A concurrent registration with the same credentials resumes its original account.
   try{return await authenticate(data);}catch{throw Error('That username is already taken, or the password is incorrect.');}
  }
 }
 async function fund(user,ip,{starterOnly=false}={}){
  const row=await record(user.id);if(!row)throw Error('A NearFest account is required.');
  if(row.funded_at){
   if(starterOnly||(chain.create&&now()-Number(row.funded_at)<10000))return {status:'confirmed',amount:GRANT.toString(),explorer:'https://testnet.nearblocks.io/address/'+user.id};
   const claimed=await faucet.claim(user,ip);invalidateNearAccount(user.id);return claimed;
  }
  const claim=chain.create?await lease('managed-fund:'+user.id,async()=>{const current=await record(user.id);if(current.funded_at)return {status:'confirmed',amount:GRANT.toString(),explorer:'https://testnet.nearblocks.io/address/'+user.id};const result=await chain.create(user.id,KeyPair.fromString(decryptKey(current.encrypted_key,user.id,key)).getPublicKey().toString());if(result.status==='confirmed'&&BigInt(result.amount)===GRANT)await db.prepare('UPDATE managed_accounts SET funded_at=$1 WHERE user_id=$2 AND funded_at IS NULL').run(now(),user.id);return result;}):await faucet.claim(user,ip,{minimumGrant:GRANT});
  if(claim.status==='confirmed'){
   if(BigInt(claim.amount)!==GRANT)throw Error('Your starting balance is still being prepared. Retry shortly.');
   await db.prepare('UPDATE managed_accounts SET funded_at=$1 WHERE user_id=$2 AND funded_at IS NULL').run(now(),user.id);
   invalidateNearAccount(user.id);
  }
  return claim;
 }
 async function settle(saved){
  let result;try{result=await chain.status(saved.tx_hash,saved.user_id);}catch{}
  if(!result||result.final_execution_status!=='FINAL')result=await chain.send(saved.signed_tx);
  if(result.transaction?.hash!==saved.tx_hash)throw Error('The transaction confirmation did not match this action.');
  if(result.final_execution_status!=='FINAL')throw Error('Your action is confirming. Continue it from account activity.');
  try{assertSuccess(result);}catch(error){await db.prepare("UPDATE managed_transactions SET status='failed',signed_tx='' WHERE id=$1").run(saved.id);invalidateNearAccount(saved.user_id);throw error;}
  if(!result.status||typeof result.status!=='object'||!('SuccessValue'in result.status))throw Error('The testnet transaction has not confirmed success yet.');
  const confirmed={status:'confirmed',transaction_hash:saved.tx_hash,explorer:'https://testnet.nearblocks.io/txns/'+saved.tx_hash};
  await db.prepare("UPDATE managed_transactions SET status='confirmed',signed_tx='',result=$1 WHERE id=$2").run(JSON.stringify(confirmed),saved.id);
  invalidateNearAccount(saved.user_id);
  return confirmed;
 }
 async function submit(user,transaction){
  available();const row=await record(user.id);if(!row)throw Error('Sign in to your NearFest account first.');
  const id=verifyAuthorization(transaction,key,now());
  if(transaction.signerId!==user.id||transaction.receiverId!==chain.contractId||transaction.actions?.length!==1||transaction.actions[0].type!=='FunctionCall')throw Error('This action does not belong to your NearFest account.');
  await chain.network();
  return lease('managed-sign:'+user.id,async()=>{
   let saved=await db.prepare('SELECT * FROM managed_transactions WHERE id=$1').get(id);
   if(saved&&saved.user_id!==user.id)throw Error('This action belongs to another account.');
   if(saved?.status==='confirmed')return JSON.parse(saved.result);
   if(saved?.status==='failed')throw Error('The testnet transaction failed. Return to the action and retry.');
   if(!saved){
    for(const pending of await db.prepare("SELECT * FROM managed_transactions WHERE user_id=$1 AND status='pending' ORDER BY created").all(user.id)){
     try{await settle(pending);}catch(error){const refreshed=await db.prepare('SELECT status FROM managed_transactions WHERE id=$1').get(pending.id);if(refreshed?.status!=='failed')throw error;}
    }
    const prepared=await chain.prepare(user.id,decryptKey(row.encrypted_key,user.id,key),transaction);
    saved={id,user_id:user.id,tx_hash:prepared.hash,signed_tx:prepared.signed,status:'pending'};
    await db.transaction(async()=>{
     await db.prepare("INSERT INTO managed_transactions(id,user_id,tx_hash,signed_tx,status,created) VALUES($1,$2,$3,$4,'pending',$5)").run(id,user.id,prepared.hash,prepared.signed,now());
     await store.jobs?.schedule('managed-transaction',id,now()+20000);
    });
   }
   return settle(saved);
  });
 }
 async function fundingStatus(user){
  const details=await info(user);
  if(details?.managed&&!details.starter_funded&&chain.create)return {enabled,available:enabled,amount:GRANT.toString(),reason:enabled?'ready':'unavailable',claim:null};
  return faucet.status(user);
 }
 async function recoverTransaction(id){
  const pending=await db.prepare("SELECT user_id FROM managed_transactions WHERE id=$1 AND status='pending'").get(id);if(!pending)return false;
  await chain.network();
  return lease('managed-sign:'+pending.user_id,async()=>{
   const saved=await db.prepare("SELECT * FROM managed_transactions WHERE id=$1 AND status='pending'").get(id);if(!saved)return false;
   await settle(saved);return true;
  });
 }
 async function fundingHistory(user){const row=await record(user.id);return row?.funded_at?[{id:'starter-'+user.id,title:'Starting test NEAR',operation:'top_up',amount:GRANT.toString(),created_at:row.funded_at,status:'confirmed',explorer:'https://testnet.nearblocks.io/address/'+user.id}]:[];}
 return {enabled,register,authenticate,info,fund,submit,fundingStatus,fundingHistory,recoverTransaction};
}
