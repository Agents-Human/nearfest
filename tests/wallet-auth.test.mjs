import test from 'node:test';
import assert from 'node:assert/strict';
import {Account,KeyPair} from 'near-api-js';
import {signMessage} from 'near-api-js/nep413';
import {createWalletAuth} from '../server/wallet-auth.mjs';
function setup(){
 const key=KeyPair.fromRandom('ed25519'),other=KeyPair.fromRandom('ed25519');let now=1000,network=0;
 const provider={viewAccessKey:async({accountId,publicKey})=>{assert.equal(accountId,'friend.testnet');assert.equal(publicKey,key.getPublicKey().toString());return {permission:'FullAccess'};}};
 const auth=createWalletAuth({origin:'https://nearfest.example',provider,network:async()=>{network++;},review:async()=>{},now:()=>now});
 async function signed(c,wrongKey=false,payload={}){const account=new Account('friend.testnet',provider,(wrongKey?other:key).toString()),s=await signMessage({signerAccount:account,payload:{message:c.message,recipient:c.recipient,nonce:new Uint8Array(Buffer.from(c.nonce,'base64')),...payload}});return {id:c.id,accountId:s.accountId,publicKey:s.publicKey.toString(),signature:Buffer.from(s.signature).toString('base64')};}
 return {auth,provider,signed,expire:()=>{now+=300001;},get network(){return network;}};
}
test('combined sign-in binds the selected account through a real signature and consumes its challenge once',async()=>{
 const x=setup(),c=await x.auth.challenge({name:'Friend'});assert.equal(c.account_id,null);const signed=await x.signed(c);
 assert.deepEqual(await x.auth.verify(signed),{accountId:'friend.testnet',name:'Friend'});assert.equal(x.network,1);await assert.rejects(()=>x.auth.verify(signed),/expired/);
});
test('combined sign-in rejects a changed origin, nonce, expired challenge and unrecognized key',async()=>{
 for(const scenario of ['origin','nonce','expired','key']){
  const x=setup(),c=await x.auth.challenge(),payload=scenario==='origin'?{recipient:'https://attacker.example'}:scenario==='nonce'?{nonce:new Uint8Array(32)}:{};
  const signed=await x.signed(c,scenario==='key',payload);if(scenario==='expired')x.expire();
  await assert.rejects(()=>x.auth.verify(signed));await assert.rejects(()=>x.auth.verify(signed),/expired/);
 }
});
test('older account-bound sign-ins still reject a signature claimed for a different account',async()=>{
 const x=setup(),c=await x.auth.challenge({account_id:'original.testnet'}),signed=await x.signed(c);await assert.rejects(()=>x.auth.verify(signed),/expired/);
 await assert.rejects(()=>x.auth.challenge({account_id:'invalid address'}),/Invalid/);
});
