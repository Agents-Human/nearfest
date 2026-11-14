import {testSchema} from './helpers/store.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('two independent survival clients share coins, course and the first-death result',{timeout:35000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nearfest-survival-')),origin='http://127.0.0.1:5194';
 const child=spawn(process.execPath,['server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'5194',APP_ORIGIN:origin,DATABASE_URL:process.env.TEST_DATABASE_URL,DATABASE_SCHEMA:testSchema(dir),NEAR_CONTRACT_ID:'',NEAR_AI_API_KEY:'',SEED_PRACTICE:'false'},stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
 const client=()=>{let cookie='';return async(path,data)=>{const res=await fetch(origin+'/api'+path,{method:data===undefined?'GET':'POST',headers:{origin,cookie,'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});if(res.headers.has('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];const body=await res.json();assert(res.ok,JSON.stringify(body));return body;};};
 try{
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch(origin+'/api/config')).ok){ready=true;break;}}catch{}await delay(50);}assert(ready,log);
  const a=client(),b=client();await a('/session/practice',{name:'Survival A'});const bob=await b('/session/practice',{name:'Survival B'});
  let room=await a('/parties',{game_id:'platform-relay',entry:'0',visibility:'public'});await b(`/arcade/${room.id}/action`,{type:'join'});await a(`/arcade/${room.id}/action`,{type:'ready',ready:true});await b(`/arcade/${room.id}/action`,{type:'ready',ready:true});room=await a(`/arcade/${room.id}/start`,{});assert.equal(room.ends_at,null);
  const first=await b(`/arcade/${room.id}`);assert.equal(first.state.seed,room.state.seed);assert.deepEqual(first.state.platforms,room.state.platforms);assert.equal(first.players.length,2);
  await delay(Math.max(0,room.starts_at-Date.now()+70));
  // B runs to the edge of the starting island, jumps across the gap to the second
  // island and stops safely. A stalls on the starting island. The server's advancing
  // storm must eliminate A and finish both views.
  let seq=0;const start=Date.now();while(Date.now()-start<2700){const elapsed=Date.now()-start;const jump=elapsed>1350&&elapsed<1950;await b(`/arcade/${room.id}/input`,{seq:seq++,controls:{right:true,up:jump}});await delay(80);}await b(`/arcade/${room.id}/input`,{seq:seq++,controls:{}});
  let result;for(let i=0;i<200;i++){result=await b(`/arcade/${room.id}`);if(result.status==='finished')break;await delay(100);}
  assert.equal(result.status,'finished');assert.equal(result.state.players[0].alive,false);assert.equal(result.state.players[1].alive,true);assert(result.state.players[1].coins>0);assert.match(result.reason,/storm/);assert.deepEqual(result.state.winners,[1]);
  const other=await a(`/arcade/${room.id}`);assert.deepEqual(other.state,result.state);assert.deepEqual(other.winners,result.winners);assert.equal(other.winners.length,1);
  const final=await b(`/arcade/${room.id}`);assert.deepEqual(final.state,result.state);
 }finally{if(child.exitCode===null){const stopped=once(child,'exit');child.kill();await stopped;}await rm(dir,{recursive:true,force:true});}
});
