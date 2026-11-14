import test from 'node:test';
import assert from 'node:assert/strict';
import {Account,KeyPair} from 'near-api-js';
import {signMessage} from 'near-api-js/nep413';
import {createWalletAuth} from '../server/wallet-auth.mjs';
import {openDatabase} from '../server/database.mjs';
import {testSchema} from './helpers/store.mjs';
async function setup(t){
 const db=await openDatabase(process.env.TEST_DATABASE_URL,{schema:testSchema()});let closed=false;
 const close=async()=>{if(!closed){closed=true;await db.close();}};t.after(close);
 const key=KeyPair.fromRandom('ed25519'),other=KeyPair.fromRandom('ed25519');let now=1000,network=0;
 const provider={viewAccessKey:async({accountId,publicKey})=>{assert.equal(accountId,'friend.testnet');assert.equal(publicKey,key.getPublicKey().toString());return {permission:'FullAccess'};}};
 const createAuth=(database=db,origin='https://nearfest.example')=>createWalletAuth({origin,db:database,provider,network:async()=>{network++;},review:async()=>{},now:()=>now});
 const auth=createAuth();
 async function signed(c,wrongKey=false,payload={}){const account=new Account('friend.testnet',provider,(wrongKey?other:key).toString()),s=await signMessage({signerAccount:account,payload:{message:c.message,recipient:c.recipient,nonce:new Uint8Array(Buffer.from(c.nonce,'base64')),...payload}});return {id:c.id,accountId:s.accountId,publicKey:s.publicKey.toString(),signature:Buffer.from(s.signature).toString('base64')};}
 return {auth,db,close,createAuth,provider,signed,expire:()=>{now+=300001;},get network(){return network;}};
}
test('combined sign-in binds the selected account through a real signature and consumes its challenge once',async t=>{
 const x=await setup(t),c=await x.auth.challenge({name:'Friend'});assert.equal(c.account_id,null);const signed=await x.signed(c);
 assert.deepEqual(await x.auth.verify(signed),{accountId:'friend.testnet',name:'Friend'});assert.equal(x.network,1);await assert.rejects(()=>x.auth.verify(signed),/expired/);
});
test('combined sign-in rejects a changed origin, nonce, expired challenge and unrecognized key',async t=>{
 for(const scenario of ['origin','nonce','expired','key']){
  const x=await setup(t),c=await x.auth.challenge(),payload=scenario==='origin'?{recipient:'https://attacker.example'}:scenario==='nonce'?{nonce:new Uint8Array(32)}:{};
  const signed=await x.signed(c,scenario==='key',payload);if(scenario==='expired')x.expire();
  await assert.rejects(()=>x.auth.verify(signed));await assert.rejects(()=>x.auth.verify(signed),/expired/);
 }
});
test('older account-bound sign-ins still reject a signature claimed for a different account',async t=>{
 const x=await setup(t),c=await x.auth.challenge({account_id:'original.testnet'}),signed=await x.signed(c);await assert.rejects(()=>x.auth.verify(signed),/expired/);
 await assert.rejects(()=>x.auth.challenge({account_id:'invalid address'}),/Invalid/);
});

async function anotherDatabase(t,x){
 const db=await openDatabase(process.env.TEST_DATABASE_URL,{schema:x.db.namespace});t.after(()=>db.close());return db;
}
test('a wallet challenge created by one instance can be verified by another instance',async t=>{
 const x=await setup(t),challenge=await x.auth.challenge({name:'Friend'}),signed=await x.signed(challenge);
 const other=x.createAuth(await anotherDatabase(t,x));
 assert.deepEqual(await other.verify(signed),{accountId:'friend.testnet',name:'Friend'});
 await assert.rejects(()=>x.auth.verify(signed),/expired/);
});
test('a wallet challenge survives closing its issuer and reconnecting after a restart',async t=>{
 const x=await setup(t),challenge=await x.auth.challenge(),signed=await x.signed(challenge);
 await x.close();
 const restarted=x.createAuth(await anotherDatabase(t,x));
 assert.deepEqual(await restarted.verify(signed),{accountId:'friend.testnet',name:null});
});
test('concurrent verification across instances consumes the wallet challenge exactly once',async t=>{
 const x=await setup(t),challenge=await x.auth.challenge(),signed=await x.signed(challenge);
 const other=x.createAuth(await anotherDatabase(t,x)),sibling=x.createAuth();
 const results=await Promise.allSettled([sibling.verify(signed),other.verify(signed),sibling.verify(signed),other.verify(signed)]);
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
 for(const result of results.filter(result=>result.status==='rejected'))assert.match(result.reason.message,/expired/);
 assert.equal(x.network,1);
});
test('shared challenges still expire and are pruned when a new sign-in starts',async t=>{
 const x=await setup(t),challenge=await x.auth.challenge(),signed=await x.signed(challenge);
 x.expire();await x.auth.challenge();
 assert.equal((await x.db.query('SELECT id FROM wallet_auth_challenges WHERE id=$1',[challenge.id])).rowCount,0);
 await assert.rejects(()=>x.auth.verify(signed),/expired/);
});
test('shared wallet challenges remain bound to the configured application origin',async t=>{
 const x=await setup(t),challenge=await x.auth.challenge(),signed=await x.signed(challenge);
 const other=x.createAuth(await anotherDatabase(t,x),'https://other.example');
 await assert.rejects(()=>other.verify(signed),/expired/);
 await assert.rejects(()=>x.auth.verify(signed),/expired/);
});

test('shared auth migration upgrades an existing database without changing existing sessions',async t=>{
 const x=await setup(t);
 await x.db.query('INSERT INTO sessions(token,user_id,expires) VALUES($1,$2,$3)',['existing-session','friend.testnet',1900000000000]);
 await x.db.transaction(async()=>{
  await x.db.query('DROP TABLE wallet_auth_challenges');
  await x.db.query('DELETE FROM schema_migrations WHERE version=3');
 });
 const upgraded=await anotherDatabase(t,x),auth=x.createAuth(upgraded),challenge=await auth.challenge();
 assert.equal((await upgraded.query('SELECT user_id FROM sessions WHERE token=$1',['existing-session'])).rows[0].user_id,'friend.testnet');
 assert.equal((await upgraded.query('SELECT id FROM wallet_auth_challenges WHERE id=$1',[challenge.id])).rowCount,1);
 assert.equal((await upgraded.query('SELECT version FROM schema_migrations WHERE version=3')).rowCount,1);
});
