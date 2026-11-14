import assert from 'node:assert/strict';
import {readFile,writeFile,chmod} from 'node:fs/promises';
import {Account,JsonRpcProvider,KeyPair} from 'near-api-js';
import {signMessage} from 'near-api-js/nep413';
const filename='.nearfest-faucet-keys.json',keys=JSON.parse(await readFile(filename,'utf8')),rpc=new JsonRpcProvider({url:'https://test.rpc.fastnear.com'}),base='http://127.0.0.1:5189/api',origin='http://127.0.0.1:5188',UNIT=10n**24n;
assert.equal((await rpc.viewNodeStatus()).chain_id,'testnet');
if(!keys.probe10){keys.probe10={id:`probe10.${keys.account_id}`,key:KeyPair.fromRandom('ed25519').toString()};await writeFile(filename,JSON.stringify(keys,null,2),{mode:0o600});await chmod(filename,0o600);}
try{await rpc.viewAccount({accountId:keys.probe10.id});}catch(e){if(!/does not exist|UNKNOWN_ACCOUNT|unknown account/i.test(e.message))throw e;const sponsor=new Account(keys.account_id,rpc,keys.private_key);await sponsor.createAccount({newAccountId:keys.probe10.id,publicKey:KeyPair.fromString(keys.probe10.key).getPublicKey(),nearToTransfer:UNIT/50n});}
for(let i=0;i<20;i++){try{await rpc.viewAccount({accountId:keys.probe10.id,blockQuery:{finality:'final'}});break;}catch(e){if(i===19)throw e;await new Promise(r=>setTimeout(r,500));}}
let cookie='';async function api(path,data){const res=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{origin,cookie,'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(60000)});if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];const result=await res.json();assert(res.ok,JSON.stringify(result));return result;}
const denied=await fetch(base+'/near/faucet',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'});assert.equal(denied.status,400);
const account=new Account(keys.probe10.id,rpc,keys.probe10.key),challenge=await api('/auth/challenge',{account_id:keys.probe10.id}),signed=await signMessage({signerAccount:account,payload:{message:challenge.message,recipient:challenge.recipient,nonce:new Uint8Array(Buffer.from(challenge.nonce,'base64'))}});
await api('/auth/verify',{id:challenge.id,accountId:signed.accountId,publicKey:signed.publicKey.toString(),signature:Buffer.from(signed.signature).toString('base64')});
const before=BigInt((await rpc.viewAccount({accountId:keys.probe10.id,blockQuery:{finality:'final'}})).amount),prior=await api('/near/faucet');
let funded=await api('/near/faucet',{amount:'100',recipient:'ignored.testnet'});for(let i=0;i<5&&funded.status==='pending';i++){await new Promise(r=>setTimeout(r,3000));funded=await api('/near/faucet',{});}assert.equal(funded.status,'confirmed');assert.equal(funded.amount,(10n*UNIT).toString());
const after=BigInt((await rpc.viewAccount({accountId:keys.probe10.id,blockQuery:{finality:'final'}})).amount);assert.equal(after-before,prior.claim?.status==='confirmed'?0n:10n*UNIT);
const repeat=await api('/near/faucet',{});assert.equal(repeat.transaction_hash,funded.transaction_hash);assert.equal(BigInt((await rpc.viewAccount({accountId:keys.probe10.id,blockQuery:{finality:'final'}})).amount),after);
const profile=await api('/me');assert.equal(profile.balance,after.toString());
await writeFile('evidence/nearfest-faucet.json',JSON.stringify({network:'testnet',sponsor:keys.account_id,recipient:keys.probe10.id,amount:funded.amount,transaction_hash:funded.transaction_hash,checks:['wallet session required','signed testnet login','fixed ten-NEAR transfer; client amount and recipient ignored','recipient receives full amount without paying gas','repeated request returns same transfer','refreshed app profile matches finalized chain balance'],completed_at:new Date().toISOString()},null,2));
console.log(JSON.stringify({passed:true,recipient:keys.probe10.id,transaction_hash:funded.transaction_hash,balance:after.toString()}));
