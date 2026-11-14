import test from 'node:test';
import assert from 'node:assert/strict';
import {startBackgroundJob} from '../server/background-job.mjs';

test('a slow background task has only one running copy and no queued ticks',async()=>{
 let trigger,release,runs=0,cancelled=false;
 const blocked=new Promise(resolve=>{release=resolve;});
 const job=startBackgroundJob('slow',1,async()=>{runs++;await blocked;},{schedule:fn=>{trigger=fn;return {unref(){}};},cancel:()=>{cancelled=true;}});
 try{
  trigger();await Promise.resolve();for(let i=0;i<100;i++)trigger();
  assert.equal(runs,1);release();await job.run();
  assert.equal(runs,1);await job.run();assert.equal(runs,2);
 }finally{release();await job.stop();assert(cancelled);}
});

test('a database timeout is caught and the next background run recovers',async()=>{
 let attempts=0;const errors=[];
 const job=startBackgroundJob('maintenance',60000,async()=>{if(++attempts===1)throw Error('timeout exceeded when trying to connect');},{onError:error=>errors.push(error.message)});
 try{
  await job.run();assert.deepEqual(errors,['timeout exceeded when trying to connect']);
  await job.run();assert.equal(attempts,2);
 }finally{await job.stop();}
});

test('stopping a job waits for active work and prevents another run',async()=>{
 let release,runs=0;
 const blocked=new Promise(resolve=>{release=resolve;});
 const job=startBackgroundJob('shutdown',60000,async()=>{runs++;await blocked;});
 const active=job.run();await Promise.resolve();let stopped=false;
 const stopping=job.stop().then(()=>{stopped=true;});await Promise.resolve();assert.equal(stopped,false);
 release();await active;await stopping;await job.run();assert.equal(runs,1);
});
