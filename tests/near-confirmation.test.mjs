import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmWalletAction} from '../src/near-confirmation.mjs';

function clock(){let time=0;return {now:()=>time,wait:async()=>{time+=1500;}};}
test('a confirmed room opens even when the wallet popup never returns',async()=>{
  let sends=0,checks=0;const stages=[];
  const room=await confirmWalletAction({...clock(),attempts:8,onStatus:s=>stages.push(s),send:()=>{sends++;return new Promise(()=>{});},confirm:async()=>{if(++checks<3)throw Error('Not finalized');return {id:'arena-confirmed'};}});
  assert.equal(room.id,'arena-confirmed');assert.equal(sends,1);assert.equal(checks,3);assert.deepEqual(stages,['wallet','confirmed']);
});
test('a wallet error after broadcast cannot hide a subsequently confirmed deposit',async()=>{
  let sends=0,checks=0;
  const room=await confirmWalletAction({...clock(),attempts:12,send:async()=>{sends++;throw Error('Popup disconnected');},confirm:async()=>{if(++checks<5)throw Error('Waiting for finality');return {id:'room-paid'};}});
  assert.equal(room.id,'room-paid');assert.equal(sends,1);
});
test('a rejected wallet request stops without ever resubmitting payment',async()=>{
  let sends=0,checks=0;
  await assert.rejects(()=>confirmWalletAction({...clock(),send:async()=>{sends++;throw Error('User rejected');},confirm:async()=>{checks++;throw Error('Not found');}}),/no second payment.*User rejected/);
  assert.equal(sends,1);assert(checks>=2&&checks<20);
});
test('RPC failures leave a bounded pending action, not an endless opening spinner',async()=>{
  let sends=0,checks=0;const stages=[];
  await assert.rejects(()=>confirmWalletAction({...clock(),timeoutMs:3000,onStatus:s=>stages.push(s),send:()=>{sends++;return new Promise(()=>{});},confirm:async()=>{checks++;throw Error('RPC unavailable');}}),/not confirmed.*RPC unavailable/);
  assert.equal(sends,1);assert.equal(checks,3);assert.equal(stages.at(-1),'pending');
});
test('checking an existing intent sends no transaction',async()=>{
  const stages=[];const result=await confirmWalletAction({confirm:async()=>({id:'already-paid'}),onStatus:s=>stages.push(s)});
  assert.equal(result.id,'already-paid');assert.deepEqual(stages,['confirming','confirmed']);
});
test('a late wallet callback cannot revert a completed action to confirming',async()=>{
  let finishWallet;const stages=[];
  await confirmWalletAction({send:()=>new Promise(resolve=>{finishWallet=resolve;}),confirm:async()=>({id:'paid'}),onStatus:s=>stages.push(s)});
  finishWallet();await Promise.resolve();await Promise.resolve();assert.equal(stages.at(-1),'confirmed');
});

test('returning from a wallet redirect waits for finality without sending again',async()=>{
 let checks=0;const room=await confirmWalletAction({...clock(),confirm:async()=>{if(++checks<4)throw Error('Not final yet');return {id:'redirect-room'};}});assert.equal(room.id,'redirect-room');assert.equal(checks,4);
});
test('leaving a restored session stops polling without sending a payment',async()=>{
 const controller=new AbortController();let checks=0;
 await assert.rejects(()=>confirmWalletAction({signal:controller.signal,confirm:async()=>{checks++;throw Error('Not final');},wait:async()=>controller.abort()}),{name:'AbortError'});assert.equal(checks,1);
});
