import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {openStore} from './helpers/store.mjs';
import {createManagedAccounts} from '../server/managed-accounts.mjs';
import {createFaucet} from '../server/faucet.mjs';
import {authorizeTransaction,accountKey,decryptKey} from '../server/managed-crypto.mjs';
import {KeyPair} from 'near-api-js';
const UNIT=10n**24n,password='a private test password';
async function setup(t){
 const store=await openStore(':memory:');t.after(()=>store.db.close());
 const key=randomBytes(32),balances=new Map([['sponsor.testnet',1000n*UNIT]]),sent=new Map(),preparations=[],broadcasts=[];let offline=false;
 const final=hash=>({transaction:{hash},final_execution_status:'FINAL',status:{SuccessValue:''},receipts_outcome:[]});
 const faucetChain={enabled:true,id:'sponsor.testnet',network:async()=>{},balance:async id=>balances.get(id)||0n,prepare:async(to,amount)=>{const hash='grant-'+preparations.length;const signed=JSON.stringify({hash,to,amount});preparations.push(signed);return {hash,signed};},send:async signed=>{const tx=JSON.parse(signed);if(!sent.has(tx.hash)){balances.set(tx.to,(balances.get(tx.to)||0n)+BigInt(tx.amount));balances.set('sponsor.testnet',balances.get('sponsor.testnet')-BigInt(tx.amount));sent.set(tx.hash,final(tx.hash));}return sent.get(tx.hash);},status:async hash=>{if(!sent.has(hash))throw Error('Unknown');return sent.get(hash);}};
 const faucet=createFaucet(store,{chain:faucetChain});
 const chain={contractId:'escrow.testnet',network:async()=>{},prepare:async(id,secret,tx)=>{assert(KeyPair.fromString(secret).getPublicKey().toString().startsWith('ed25519:'));assert.match(id,/^nf-[a-f0-9]{24}\.testnet$/);const hash='action-'+preparations.length,signed=JSON.stringify({hash,tx});preparations.push(signed);return {hash,signed};},status:async hash=>{if(offline||!sent.has(hash))throw Error('RPC unavailable');return sent.get(hash);},send:async signed=>{broadcasts.push(signed);if(offline)throw Error('RPC unavailable');const {hash}=JSON.parse(signed);if(!sent.has(hash))sent.set(hash,final(hash));return sent.get(hash);}};
 const options={faucet,key,chain,review:async()=>{}},accounts=createManagedAccounts(store,options);
 const transaction=(u,id='intent-1')=>authorizeTransaction({signerId:u.id,receiverId:chain.contractId,actions:[{type:'FunctionCall',params:{methodName:'create_room',args:{id:'room-1'},gas:'150000000000000',deposit:UNIT.toString()}}]},key,{id});
 return {store,key,faucet,accounts,options,chain,balances,preparations,broadcasts,transaction,restart:()=>createManagedAccounts(store,options),offline:value=>{offline=value;}};
}
test('new app accounts receive exactly 10 native test NEAR once and retain their identity after restart',async t=>{
 const x=await setup(t),u=await x.accounts.register({username:'Alice',password});
 assert.match(u.id,/^nf-[a-f0-9]{24}\.testnet$/);assert.equal(u.kind,'wallet');
 assert.equal((await x.accounts.fund(u,'alice-ip')).amount,(10n*UNIT).toString());
 assert.equal(x.balances.get(u.id),10n*UNIT);
 const restarted=x.restart(),again=await restarted.authenticate({username:'ALICE',password});assert.equal(again.id,u.id);
 await restarted.fund(again,'alice-ip');assert.equal(x.balances.get(u.id),10n*UNIT);assert.equal(x.preparations.length,1);
 assert.deepEqual(await restarted.info(again),{managed:true,username:'alice',starter_funded:true});
 const saved=await x.store.db.prepare('SELECT * FROM managed_accounts WHERE user_id=$1').get(u.id);
 assert(!saved.password_hash.includes(password));assert(!saved.encrypted_key.includes('ed25519:'));
 assert.equal(KeyPair.fromString(decryptKey(saved.encrypted_key,u.id,x.key)).getPublicKey().data.length,32);
});
test('duplicate registration resumes the original account; wrong credentials cannot take it over',async t=>{
 const x=await setup(t),credentials={username:'player',password};
 const users=await Promise.all([x.accounts.register(credentials),x.restart().register(credentials)]);
 assert.equal(users[0].id,users[1].id);
 assert.equal((await x.store.db.query('SELECT * FROM users')).rowCount,1);
 await assert.rejects(()=>x.accounts.authenticate({...credentials,password:'incorrect password'}),/incorrect/);
 await assert.rejects(()=>x.accounts.authenticate({username:'missing',password}),/incorrect/);
 await assert.rejects(()=>x.accounts.register({...credentials,password:'other private password'}),/taken/);
 await assert.rejects(()=>x.accounts.register({...credentials,password:'short'}),/taken/);
 await assert.rejects(()=>x.accounts.register({username:'abc',password:'short'}),/10–128/);
});
test('starter funding waits for a full 10 NEAR grant instead of creating a partial starting balance',async t=>{
 const x=await setup(t),u=await x.accounts.register({username:'starter',password});x.balances.set('sponsor.testnet',5n*UNIT);
 await assert.rejects(()=>x.accounts.fund(u,'ip'),/out of funds/);assert.equal(x.balances.get(u.id),undefined);
 assert.equal((await x.accounts.info(u)).starter_funded,false);
 x.balances.set('sponsor.testnet',100n*UNIT);await x.accounts.fund(u,'ip');assert.equal(x.balances.get(u.id),10n*UNIT);
});
test('managed signing accepts only server-prepared actions for the authenticated account and contract',async t=>{
 const x=await setup(t),u=await x.accounts.register({username:'signer',password}),other=await x.accounts.register({username:'another',password}),tx=x.transaction(u);
 await assert.rejects(()=>x.accounts.submit(other,tx),/does not belong/);
 await assert.rejects(()=>x.accounts.submit(u,{...tx,actions:[{type:'Transfer',params:{deposit:'1'}}]}),/changed/);
 await assert.rejects(()=>x.accounts.submit(u,{...tx,receiverId:'attacker.testnet'}),/changed/);
 await assert.rejects(()=>x.accounts.submit(u,{...tx,authorization:undefined}),/expired/);
 const malicious=authorizeTransaction({...tx,receiverId:'attacker.testnet'},x.key);await assert.rejects(()=>x.accounts.submit(u,malicious),/does not belong/);
 assert.equal(x.broadcasts.length,0);
 assert.equal((await x.accounts.submit(u,tx)).status,'confirmed');
 assert.equal((await x.restart().submit(u,tx)).status,'confirmed');assert.equal(x.broadcasts.length,1);
});
test('ambiguous broadcasts persist the same signed transaction and prevent a second account nonce',async t=>{
 const x=await setup(t),u=await x.accounts.register({username:'recovery',password}),tx=x.transaction(u);
 x.offline(true);await assert.rejects(()=>x.accounts.submit(u,tx),/RPC unavailable/);
 const first=x.broadcasts[0];assert.equal(x.preparations.length,1);
 await assert.rejects(()=>x.restart().submit(u,x.transaction(u,'another-intent')),/RPC unavailable/);assert.equal(x.preparations.length,1);
 x.offline(false);await x.restart().submit(u,tx);assert(x.broadcasts.every(signed=>signed===first));assert.equal(x.preparations.length,1);
 await x.accounts.submit(u,x.transaction(u,'another-intent'));assert.equal(x.preparations.length,2);
});
test('parallel submissions across instances prepare and broadcast one transaction',async t=>{
 const x=await setup(t),u=await x.accounts.register({username:'parallel',password}),tx=x.transaction(u);
 const results=await Promise.all([x.accounts.submit(u,tx),x.restart().submit(u,tx),x.accounts.submit(u,tx)]);
 assert(results.every(result=>result.transaction_hash===results[0].transaction_hash));assert.equal(x.preparations.length,1);assert.equal(x.broadcasts.length,1);
});
test('missing master key disables new managed accounts and encryption binds keys to their owner',async t=>{
 const x=await setup(t),disabled=createManagedAccounts(x.store,{...x.options,key:null});assert.equal(disabled.enabled,false);
 await assert.rejects(()=>disabled.register({username:'disabled',password}),/unavailable/);
 assert.throws(()=>accountKey('not a key'),/32-byte/);
 const u=await x.accounts.register({username:'encrypted',password}),saved=await x.store.db.prepare('SELECT encrypted_key FROM managed_accounts WHERE user_id=$1').get(u.id);
 assert.throws(()=>decryptKey(saved.encrypted_key,'another-user',x.key));assert.throws(()=>decryptKey(saved.encrypted_key,u.id,randomBytes(32)));
});

test('testnet account creation supplies the starting grant without spending the depleted app sponsor',async t=>{
 const x=await setup(t);x.balances.set('sponsor.testnet',0n);let creates=0;
 x.chain.create=async(id,publicKey)=>{creates++;assert(publicKey.startsWith('ed25519:'));x.balances.set(id,10n*UNIT);return {status:'confirmed',amount:(10n*UNIT).toString()};};
 const user=await x.accounts.register({username:'faucetuser',password});
 await Promise.all([x.accounts.fund(user,'ip'),x.restart().fund(user,'ip')]);
 assert.equal(creates,1);assert.equal(x.balances.get(user.id),10n*UNIT);assert.equal(x.balances.get('sponsor.testnet'),0n);
 assert.equal((await x.accounts.fundingHistory(user)).length,1);
});

test('background recovery rebroadcasts the stored action without another signature',async t=>{
 const x=await setup(t),u=await x.accounts.register({username:'background',password}),tx=x.transaction(u);
 x.offline(true);await assert.rejects(()=>x.accounts.submit(u,tx),/RPC unavailable/);
 x.offline(false);assert.equal(await x.restart().recoverTransaction('intent-1'),true);
 assert.equal(await x.accounts.recoverTransaction('intent-1'),false);assert.equal(x.preparations.length,1);
 assert(x.broadcasts.every(signed=>signed===x.broadcasts[0]));
});
