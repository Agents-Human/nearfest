import test from 'node:test';
import assert from 'node:assert/strict';
import {createWalletSession} from '../src/wallet-session.ts';

const user={id:'friend.testnet',name:'friend.testnet',kind:'wallet',balance:'1000000000000000000000000',credit:'0'};
function setup(existing=null){
 const calls=[],listeners=new Set();let connects=0,fail=false;
 const connector={on:(_,fn)=>listeners.add(fn),off:(_,fn)=>listeners.delete(fn),connect:async options=>{
  connects++;assert.equal(options.signMessageParams.message,'Sign in');assert.equal(options.signMessageParams.nonce.length,32);
  if(fail)throw Error('User cancelled');
  for(const fn of listeners)fn({success:true,accounts:[{accountId:user.id,signedMessage:{accountId:user.id,publicKey:'public',signature:'signed'}}]});
 }};
 const api=async(path,data)=>{calls.push({path,data});if(path==='/me')return existing;if(path==='/auth/challenge')return {id:'challenge',nonce:Buffer.alloc(32,4).toString('base64'),message:'Sign in',recipient:'http://localhost'};if(path==='/auth/verify'){assert.equal(data.accountId,user.id);assert.equal(data.signature,'signed');return user;}if(path==='/profile')return {...user,name:data.name};throw Error(path);};
 return {login:createWalletSession(api,()=>connector),calls,listeners,get connects(){return connects;},fail:()=>{fail=true;},retry:()=>{fail=false;}};
}
test('new wallet signs in during connection without a separate signMessage request',async()=>{
 const x=setup();assert.equal((await x.login()).id,user.id);assert.equal(x.connects,1);assert.deepEqual(x.calls.map(c=>c.path),['/me','/auth/challenge','/auth/verify']);assert.equal(x.listeners.size,0);
});
test('existing authenticated wallets join without opening or signing in to the wallet again',async()=>{
 const x=setup(user);assert.deepEqual(await x.login(),user);assert.equal(x.connects,0);assert.deepEqual(x.calls.map(c=>c.path),['/me']);
 const renamed=await x.login('Friend');assert.equal(renamed.name,'Friend');assert.equal(x.connects,0);
});
test('concurrent sign-in requests share one wallet interaction; cancellation removes listeners and permits retry',async()=>{
 const x=setup();const [a,b]=await Promise.all([x.login(),x.login()]);assert.equal(a.id,b.id);assert.equal(x.connects,1);
 const cancelled=setup();cancelled.fail();await assert.rejects(()=>cancelled.login(),/cancelled/);assert.equal(cancelled.listeners.size,0);assert.equal(cancelled.calls.some(c=>c.path==='/auth/verify'),false);
 cancelled.retry();assert.equal((await cancelled.login()).id,user.id);assert.equal(cancelled.listeners.size,0);
});
