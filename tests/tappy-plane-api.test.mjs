import {testSchema} from './helpers/store.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('independent Tappy Plane clients share a course, accept real taps and agree on the last survivor',{timeout:15000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nearfest-tappy-http-')),origin='http://127.0.0.1:5207';
 const child=spawn(process.execPath,['server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'5207',APP_ORIGIN:origin,DATABASE_URL:process.env.TEST_DATABASE_URL,DATABASE_SCHEMA:testSchema(dir),NEAR_CONTRACT_ID:'',NEAR_AI_API_KEY:'',SEED_PRACTICE:'false'},stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x);
 const client=()=>{let cookie='';return async(path,data,status=200)=>{const res=await fetch(origin+'/api'+path,{method:data===undefined?'GET':'POST',headers:{origin,cookie,'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});if(res.headers.has('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];const body=await res.json();assert.equal(res.status,status,JSON.stringify(body));return body;};};
 try{
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch(origin+'/api/config')).ok){ready=true;break;}}catch{}await delay(40);}assert(ready,log);
  const clients=Array.from({length:4},client),users=[];for(const [i,c] of clients.entries())users.push(await c('/session/practice',{name:`Flight tester ${i}`}));
  let room=await clients[0]('/parties',{game_id:'tappy-plane',entry:'0'},201);
  for(const c of clients.slice(1))await c(`/arcade/${room.id}/action`,{type:'join'});
  for(const c of clients)await c(`/arcade/${room.id}/action`,{type:'ready',ready:true});room=await clients[0](`/arcade/${room.id}/start`,{});assert.equal(room.ends_at,null);
  for(const c of clients){const other=await c(`/arcade/${room.id}`);assert.deepEqual(other.state,room.state);assert.equal(other.starts_at,room.starts_at);}
  await delay(Math.max(0,room.starts_at-Date.now()+20));
  const flap={type:'play',input_id:'http-flight-tap-01',action:{type:'flap'}};await clients[0](`/arcade/${room.id}/action`,flap);await clients[0](`/arcade/${room.id}/action`,flap);
  let result;for(let i=0;i<40;i++){result=await clients[0](`/arcade/${room.id}`);if(result.status==='finished')break;await delay(40);}
  assert.equal(result.status,'finished');assert.equal(result.state.players[0].flaps,1);assert.deepEqual(result.winners,[users[0].id]);assert.deepEqual(result.state.winners,[0]);
  for(const c of clients){const other=await c(`/arcade/${room.id}`);assert.deepEqual(other.state,result.state);assert.deepEqual(other.winners,result.winners);}
  const solo=await clients[0]('/parties',{game_id:'tappy-plane',solo:true,entry:'0'},201);assert.equal(solo.players.length,1);assert.equal(solo.state.game,'tappy-plane');await clients[0](`/arcade/${solo.id}/action`,{type:'resign'});
 }finally{if(child.exitCode===null){const stopped=once(child,'exit');child.kill();await stopped;}await rm(dir,{recursive:true,force:true});}
});
