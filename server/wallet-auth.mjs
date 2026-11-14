import {randomBytes,randomUUID} from 'node:crypto';
import {verifyMessage} from 'near-api-js/nep413';
import {shortText,validAccount} from './domain.mjs';

/** Challenge can precede account selection; a verified signature establishes the account. */
export function createWalletAuth({origin,db,provider,network,review,now=Date.now}){
 if(!db)throw Error('Wallet authentication requires shared PostgreSQL challenge storage.');
 const prune=()=>db.prepare('DELETE FROM wallet_auth_challenges WHERE expires<$1').run(now());
 async function challenge({account_id,name:requestedName}={}){
  const name=requestedName===undefined?null:shortText(requestedName,2,24,'Display name');
  if(name)await review(name);
  if(account_id!==undefined&&!validAccount(account_id))throw Error('Invalid NEAR account.');
  await prune();const id=randomUUID(),c={id,account_id:account_id||null,name,nonce:randomBytes(32).toString('base64'),message:`Sign in to NearFest. This is free and does not spend funds. Request: ${id}`,recipient:origin,expires:now()+300000};
  await db.prepare('INSERT INTO wallet_auth_challenges(id,json,expires) VALUES($1,$2,$3)').run(id,JSON.stringify(c),c.expires);return c;
 }
 async function verify(d){
  // DELETE ... RETURNING atomically consumes a shared challenge, even when callbacks reach different instances.
  const row=await db.prepare('DELETE FROM wallet_auth_challenges WHERE id=$1 RETURNING json').get(d.id);
  const c=row?JSON.parse(row.json):null;
  if(!c||c.expires<now()||c.recipient!==origin||!validAccount(d.accountId)||(c.account_id&&c.account_id!==d.accountId))throw Error('Sign-in expired. Please reconnect.');
  await network();
  await verifyMessage({signerAccountId:d.accountId,signerPublicKey:d.publicKey,signature:new Uint8Array(Buffer.from(d.signature,'base64')),payload:{message:c.message,recipient:c.recipient,nonce:new Uint8Array(Buffer.from(c.nonce,'base64'))},provider});
  return {accountId:d.accountId,name:c.name};
 }
 return {challenge,verify,prune};
}
