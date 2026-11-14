import {randomBytes,randomUUID} from 'node:crypto';
import {verifyMessage} from 'near-api-js/nep413';
import {shortText,validAccount} from './domain.mjs';

/** Challenge can precede account selection; a verified signature establishes the account. */
export function createWalletAuth({origin,provider,network,review,now=Date.now}){
 const challenges=new Map();
 function prune(){for(const [id,c]of challenges)if(c.expires<now())challenges.delete(id);}
 async function challenge({account_id,name:requestedName}={}){
  const name=requestedName===undefined?null:shortText(requestedName,2,24,'Display name');
  if(name)await review(name);
  if(account_id!==undefined&&!validAccount(account_id))throw Error('Invalid NEAR account.');
  prune();const id=randomUUID(),c={id,account_id:account_id||null,name,nonce:randomBytes(32).toString('base64'),message:`Sign in to NearFest. This is free and does not spend funds. Request: ${id}`,recipient:origin,expires:now()+300000};
  challenges.set(id,c);return c;
 }
 async function verify(d){
  const c=challenges.get(d.id);challenges.delete(d.id);
  if(!c||c.expires<now()||!validAccount(d.accountId)||(c.account_id&&c.account_id!==d.accountId))throw Error('Sign-in expired. Please reconnect.');
  await network();
  await verifyMessage({signerAccountId:d.accountId,signerPublicKey:d.publicKey,signature:new Uint8Array(Buffer.from(d.signature,'base64')),payload:{message:c.message,recipient:c.recipient,nonce:new Uint8Array(Buffer.from(c.nonce,'base64'))},provider});
  return {accountId:d.accountId,name:c.name};
 }
 return {challenge,verify,prune};
}
