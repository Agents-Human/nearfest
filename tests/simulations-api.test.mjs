import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('four HTTP sessions walk, vote, work and receive consistent simulation worlds with private NPC relationships',{timeout:70000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nearfest-sim-http-')),origin='http://127.0.0.1:5193';
 const child=spawn(process.execPath,['server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'5193',APP_ORIGIN:origin,DATABASE_PATH:join(dir,'qa.sqlite'),NEAR_CONTRACT_ID:'',NEAR_AI_API_KEY:'',SEED_PRACTICE:'false'},stdio:['ignore','pipe','pipe']});
 let log='';child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x);
 const readers=[],drains=[];
 function client(){let cookie='',sequence=0;const request=async(path,data,status=200)=>{
  const response=await fetch(origin+'/api'+path,{method:data===undefined?'GET':'POST',headers:{origin,cookie,'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
  if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;
 };return {request,input:(id,controls)=>request(`/arcade/${id}/input`,{seq:sequence++,controls,x:9999,energy:999}),stream:async id=>{
  const response=await fetch(`${origin}/api/arcade/${id}/events`,{headers:{cookie}});assert.equal(response.status,200);const reader=response.body.getReader(),snapshots=new Map();readers.push(reader);
  drains.push((async()=>{let buffer='';while(true){const next=await reader.read();if(next.done)break;buffer+=Buffer.from(next.value).toString();let end;while((end=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=/data: (.+)/.exec(event);if(data){const room=JSON.parse(data[1]);if(room.state)snapshots.set(room.state.tick,room.state);}}}})());return {reader,snapshots};
 }};}
 async function walk(c,id,point){
  for(let i=0;i<90;i++){
   const room=await c.request(`/arcade/${id}`),p=room.state.players[room.my_side],dx=point.x-p.x,dz=point.z-p.z;
   if(Math.hypot(dx,dz)<4.5){await c.input(id,{});return;}
   const h=dx-dz,v=-dx-dz,threshold=Math.max(Math.abs(h),Math.abs(v))*.4;
   await c.input(id,{right:h>threshold,left:h< -threshold,up:v>threshold,down:v< -threshold});await wait(80);
  }assert.fail('Could not reach interaction range using movement inputs.');
 }
 const play=(c,id,day,action,input_id=randomUUID(),status=200)=>c.request(`/arcade/${id}/action`,{type:'play',input_id,action:{day,...action}},status);
 try{
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch(origin+'/api/config')).ok){ready=true;break;}}catch{}await wait(50);}assert(ready,log);
  const clients=Array.from({length:5},client);for(const [i,c] of clients.entries())await c.request('/session/practice',{name:`Simulation tester ${i+1}`});
  for(const game of ['town-council','castaway-crew']){
   let room=await clients[0].request('/parties',{game_id:game,visibility:'invite',entry:'0',max_players:4},201);const id=room.id;
   await clients[4].request(`/arcade/${id}`,undefined,400);
   for(const c of clients.slice(1,4))await c.request(`/arcade/${id}/action?invite=${room.invite_key}`,{type:'join'});
   for(const c of clients.slice(0,4))await c.request(`/arcade/${id}/action`,{type:'ready',ready:true});
   room=await clients[0].request(`/arcade/${id}/start`,{});await wait(Math.max(0,room.starts_at-Date.now()+100));
   const streams=await Promise.all(clients.slice(0,4).map(c=>c.stream(id)));
   await play(clients[0],id,1,{type:'vote',option:2});
   let other=await clients[1].request(`/arcade/${id}`);assert.equal(other.state.event.votes[0],null);assert.equal(other.state.event.voted[0],true);
   for(const c of clients.slice(1,4))await play(c,id,1,{type:'vote',option:2});
   room=await clients[0].request(`/arcade/${id}`);assert(room.state.event.resolved);
   const npc=game==='town-council'?5:2,initialTrust=room.state.npcs[npc].trust;
   const otherNpc=(await clients[1].request(`/arcade/${id}`)).state.npcs[npc];
   await walk(clients[0],id,room.state.npcs[npc]);const receipt=randomUUID();
   await play(clients[0],id,1,{type:'talk',npc,choice:'listen'},receipt);
   room=await play(clients[0],id,1,{type:'talk',npc,choice:'listen'},receipt);
   other=await clients[1].request(`/arcade/${id}`);assert.equal(room.state.npcs[npc].trust,initialTrust+9);assert.equal(room.state.players[0].energy,3);assert.equal(other.state.npcs[npc].trust,initialTrust);assert.deepEqual(other.state.npcs[npc].memories,otherNpc.memories);assert.deepEqual(other.state.npcs[npc].reaction,otherNpc.reaction);
   const spectator=await clients[4].request(`/arcade/${id}?invite=${room.invite_key}`);assert.equal(spectator.state.npcs[npc].trust,null);
   await clients[4].request(`/arcade/${id}/input?invite=${room.invite_key}`,{seq:0,controls:{up:true}},400);
   const task=game==='town-council'?'trade':'radio',location=room.state.tasks.find(t=>t.id===task).location,point=room.state.locations.find(l=>l.id===location);
   await play(clients[1],id,1,{type:'task',task},randomUUID(),400);
   await Promise.all(clients.slice(0,2).map(c=>walk(c,id,point)));
   await Promise.all(clients.slice(0,2).map(c=>play(c,id,1,{type:'task',task})));
   await wait(game==='town-council'?5300:8300);
   room=await clients[0].request(`/arcade/${id}`);assert.equal(room.state.players[0].job,null);assert.equal(room.state.players[1].job,null);
   if(game==='town-council')assert.equal(room.state.resources.funds,26);else assert.equal(room.state.metrics.radio,32);
   const common=[...streams[0].snapshots.keys()].filter(t=>t>0&&streams.every(s=>s.snapshots.has(t)));assert(common.length>10);
   for(const tick of common.slice(-10))for(const stream of streams.slice(1)){
    const a=streams[0].snapshots.get(tick),b=stream.snapshots.get(tick);assert.deepEqual(a.players,b.players);assert.deepEqual(a.resources,b.resources);assert.deepEqual(a.metrics,b.metrics);
   }
   await streams[2].reader.cancel();await clients[2].input(id,{down:true});await wait(900);const stopped=(await clients[2].request(`/arcade/${id}`)).state.players[2];
   await wait(250);const later=await clients[2].request(`/arcade/${id}`);assert.equal(later.state.players[2].x,stopped.x);assert.equal(later.state.players[2].z,stopped.z);
   const reconnected=await clients[2].stream(id);await wait(200);assert(reconnected.snapshots.size>0);assert(later.input_seq>=0);
   await clients[0].request(`/arcade/${id}/action`,{type:'resign'});for(const c of clients.slice(1,4))assert.equal((await c.request(`/arcade/${id}`)).status,'cancelled');
   await Promise.all(readers.map(r=>r.cancel()));await Promise.all(drains);
  }
 }finally{
  await Promise.allSettled(readers.map(r=>r.cancel()));await Promise.allSettled(drains);
  if(child.exitCode===null){const exited=once(child,'exit');child.kill();await exited;}await rm(dir,{recursive:true,force:true});
 }
});
