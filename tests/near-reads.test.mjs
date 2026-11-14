import test from 'node:test';import assert from 'node:assert/strict';import {createNearReader,availableBalance} from '../server/near-reads.mjs';
test('concurrent identical chain reads share one request but later confirmations stay fresh',async()=>{
 const read=createNearReader();let calls=0,finish;const operation=()=>{calls++;return new Promise(resolve=>{finish=resolve;});};const first=read('room',operation),second=read('room',operation);finish('final');assert.deepEqual(await Promise.all([first,second]),['final','final']);assert.equal(calls,1);assert.equal(await read('room',async()=>{calls++;return 'new final';}),'new final');assert.equal(calls,2);
});
test('RPC rate limiting backs off with a bound and other errors are not retried',async()=>{
 const delays=[],read=createNearReader({wait:async ms=>delays.push(ms)});let calls=0;
 assert.equal(await read('balance',async()=>{if(++calls<3)throw Object.assign(Error('rate limits exceeded'),{cause:429});return 1n;}),1n);assert.deepEqual(delays,[2000,4000]);
 let failures=0;await assert.rejects(()=>read('failure',async()=>{failures++;throw Error('Invalid account');}),/Invalid/);assert.equal(failures,1);
 let limited=0;await assert.rejects(()=>read('limited',async()=>{limited++;throw Error('rate limits exceeded');}),/rate limits/);assert.equal(limited,4);
});
test('available balance subtracts storage or locked balance without floating-point arithmetic',()=>{
 assert.equal(availableBalance({amount:'1000',locked:'0',storage_usage:10},'2'),980n);
 assert.equal(availableBalance({amount:'1000',locked:'100',storage_usage:10},'2'),1000n);
 assert.equal(availableBalance({amount:'1',locked:'0',storage_usage:10},'2'),0n);
});
