import {publishedGame} from '../server/game-catalog.mjs';
import {testSchema} from './helpers/store.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {arcadeGames} from '../server/arcade/catalog.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('all published arcade games open across independent HTTP sessions; authoritative streams survive latency, reconnect and dropped controls',{timeout:45000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'slotvend-arcade-http-')),origin='http://127.0.0.1:5195',child=spawn(process.execPath,['server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'5195',APP_ORIGIN:origin,DATABASE_URL:process.env.TEST_DATABASE_URL,DATABASE_SCHEMA:testSchema(dir),NEAR_CONTRACT_ID:'',NEAR_AI_API_KEY:'',SEED_PRACTICE:'false'},stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x);
 function client(){let cookie='';const request=async(path,data,status=200)=>{const r=await fetch(origin+'/api'+path,{method:data===undefined?'GET':'POST',headers:{origin,cookie,'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const value=await r.json();assert.equal(r.status,status,JSON.stringify(value));return value;};return {request,stream:async(id,key='')=>fetch(`${origin}/api/arcade/${id}/events${key?'?invite='+key:''}`,{headers:{cookie}})};}
 try{
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch(origin+'/api/config')).ok){ready=true;break;}}catch{}await wait(50);}assert(ready,log);
  const clients=Array.from({length:5},client),users=[];for(const [i,c] of clients.entries())users.push(await c.request('/session/practice',{name:'Arcade tester '+i}));
  for(const [gameIndex,g] of arcadeGames.filter(g=>publishedGame(g.id)).entries()){const seats=clients.map((_,i)=>clients[(i+gameIndex)%clients.length]);let r=await seats[0].request('/parties',{game_id:g.id,entry:'0'},201);for(let i=1;i<g.min_players;i++)await seats[i].request(`/arcade/${r.id}/action`,{type:'join'});for(let i=0;i<g.min_players;i++)await seats[i].request(`/arcade/${r.id}/action`,{type:'ready',ready:true});r=await seats[0].request(`/arcade/${r.id}/start`,{});const other=await seats[1].request(`/arcade/${r.id}`);assert.equal(r.state.game,g.id);assert.equal(other.state.game,g.id);assert.equal(other.my_side,1);assert.equal(r.starts_at,other.starts_at);assert.equal(r.players.length,g.min_players);if(g.id==='draw-guess'){assert(r.state.word);assert.equal(other.state.word,null);}if(g.id==='deduction-club'){assert(!('nightActions' in other.state));assert(!('seed' in other.state));assert.equal(other.state.saboteur,null);}await seats[0].request(`/arcade/${r.id}/action`,{type:'resign'});}
  let r=await clients[0].request('/parties',{game_id:'pocket-racers',entry:'0',visibility:'invite',race_seconds:60},201),id=r.id;assert.equal(r.race_seconds,60);
  await clients[1].request(`/arcade/${id}`,undefined,400);await clients[1].request(`/arcade/${id}/messages`,undefined,400);await clients[1].request(`/arcade/${id}/action?invite=${r.invite_key}`,{type:'join'});await clients[1].request(`/arcade/${id}/messages`,{text:'Ready on my own session.'});assert.equal((await clients[0].request(`/arcade/${id}/messages`)).length,1);
  for(const c of clients.slice(0,2))await c.request(`/arcade/${id}/action`,{type:'ready',ready:true});r=await clients[0].request(`/arcade/${id}/start`,{});
  const streams=await Promise.all(clients.slice(0,2).map(c=>c.stream(id))),readers=streams.map(s=>s.body.getReader()),snapshots=[new Map(),new Map()];let stopped=false;
  const drains=readers.map(async(reader,i)=>{let buffer='';while(!stopped){const chunk=await reader.read();if(chunk.done)break;buffer+=Buffer.from(chunk.value).toString();let at;while((at=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,at);buffer=buffer.slice(at+2);const data=/data: (.+)/.exec(event);if(data){const state=JSON.parse(data[1]);if(state.state)snapshots[i].set(state.state.tick,state.state);}}}});
  await wait(Math.max(0,r.starts_at-Date.now()+100));
  // 150 ms round-trip profile with deterministic ±50 ms request jitter and 1%
  // dropped control packets, then a 300 ms profile. No browser clock is trusted.
  const send=async(c,seq,lag)=>{if(seq===37)return;await wait(lag/2+(seq%3-1)*25);await c.request(`/arcade/${id}/input`,{seq,controls:{up:true},x:999999,progress:1000});await wait(lag/2);};
  const start=Date.now();await Promise.all(Array.from({length:60},(_,seq)=>wait(seq*50).then(()=>send(clients[seq%2],seq,seq<40?150:300))));
  const latest=await clients[0].request(`/arcade/${id}`);assert(latest.state.tick>30);assert(latest.state.tick<(Date.now()-r.starts_at)/50+3);assert(latest.state.players.every(p=>p.x>=32&&p.x<=928&&Number.isFinite(p.y)&&p.speed<=800));assert(Date.now()-start<8000);
  const common=[...snapshots[0].keys()].filter(t=>t>0&&snapshots[1].has(t));assert(common.length>10);for(const t of common)assert.deepEqual(snapshots[0].get(t),snapshots[1].get(t));
  stopped=true;await Promise.all(readers.map(r=>r.cancel()));await Promise.allSettled(drains);await wait(800);const reconnected=await clients[0].request(`/arcade/${id}`);assert(reconnected.state.tick>=latest.state.tick);assert(reconnected.input_seq>=58);
  const stream=await clients[0].stream(id),reader=stream.body.getReader(),first=await reader.read();assert.match(Buffer.from(first.value).toString(),/snapshot/);await reader.cancel();
  await clients[0].request(`/arcade/${id}/action`,{type:'resign'});assert.equal((await clients[1].request('/me')).credit,'0');await clients[0].request(`/arcade/${id}/action`,{type:'resign'});assert.equal((await clients[1].request('/me')).credit,'0');
 }finally{if(child.exitCode===null){const exit=once(child,'exit');child.kill();await exit;}await rm(dir,{recursive:true,force:true});}
});
