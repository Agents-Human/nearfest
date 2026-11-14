import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {newSimulation,simulationAction,simulationView,advanceSimulation,simulationIds} from '../server/arcade/simulations.mjs';
import {createArcadeRooms} from '../server/arcade/rooms.mjs';
import {openStore} from './helpers/store.mjs';
import {arcadeGame} from '../server/arcade/catalog.mjs';
const act=(s,seat,d)=>simulationAction(s,seat,{day:s.day,...d});
const step=(s,n=1)=>{for(let i=0;i<n&&!s.finished;i++)s=advanceSimulation(s);return s;};
const place=(s,seat,point)=>{s.players[seat].x=point.x;s.players[seat].z=point.z;return s;};
const meet=(s,seat,npc)=>place(s,seat,s.npcs[npc]);
const site=(s,seat,id)=>place(s,seat,s.locations.find(l=>l.id===id));
const dusk=s=>{const day=s.day;for(let i=0;i<s.players.length;i++)site(s,i,s.game==='town-council'?'council':'camp');for(let i=0;i<s.players.length&&s.day===day&&!s.finished;i++)act(s,i,{type:'ready',ready:true});return s;};

test('both simulations support stakes, are independently playable by 1–4 people and finish when idle',()=>{
 for(const game of simulationIds){assert.equal(arcadeGame(game).bettable,true);assert.throws(()=>newSimulation(game,5));for(const n of [1,2,4]){let s=newSimulation(game,n);s=step(s,19000);assert(s.finished);assert.deepEqual(s.winners,[]);assert.equal(s.day,s.totalDays);}}
});
test('travel takes server time, tasks reserve supplies and cannot be duplicated or awarded early',()=>{
 let s=newSimulation('castaway-crew',2);const original=structuredClone(s);assert.throws(()=>act(s,0,{type:'task',task:'radio'}),/Walk/);s=advanceSimulation(s,[{right:true}]);assert(s.players[0].x>original.players[0].x);site(s,0,'radio');act(s,0,{type:'task',task:'radio'});
 assert.equal(s.resources.parts,1);assert.equal(s.resources.wood,4);assert.equal(s.metrics.radio,0);assert.equal(s.players[0].energy,3);
 assert.throws(()=>act(s,0,{type:'task',task:'radio'}),/Finish/);s=step(s,10);assert.equal(s.metrics.radio,0);assert(s.players[0].z<original.players[0].z);
 s=step(s,220);assert.equal(s.metrics.radio,16);assert.equal(s.players[0].score,3);assert.equal(s.players[1].score,0);assert.equal(s.players[0].job,null);
 const funds=s.resources.parts;assert.throws(()=>act(s,1,{type:'task',task:'unknown'}));assert.equal(s.resources.parts,funds);
});
test('simultaneous players compete for the same finite supplies without overdrafts',()=>{
 const s=newSimulation('castaway-crew',4);s.resources.parts=1;s.resources.wood=2;site(s,0,'radio');site(s,1,'radio');act(s,0,{type:'task',task:'radio'});
 assert.throws(()=>act(s,1,{type:'task',task:'radio'}),/supplies/);assert.equal(s.resources.parts,0);assert.equal(s.resources.wood,0);assert.equal(s.players[1].energy,4);
});
test('direct movement is bounded, buildings block walking, and remote interaction is refused',()=>{
 let s=newSimulation('town-council',2);place(s,0,{x:49,z:20});
 for(let i=0;i<100;i++)s=advanceSimulation(s,[{up:true,right:true,block:true}]);
 assert(s.players[0].z>=13.1);assert.equal(s.players[0].x,49);
 site(s,0,'park');assert.throws(()=>act(s,0,{type:'vote',option:0}),/meeting/);assert.throws(()=>act(s,0,{type:'task',task:'trade'}),/Walk/);
 assert.throws(()=>act(s,0,{type:'travel',location:'council'}),/supported/);
 const before={...s.players[0]};s=advanceSimulation(s,[{right:true}]);assert(Math.hypot(s.players[0].x-before.x,s.players[0].z-before.z)<=.501);
 for(let i=0;i<500;i++)s=advanceSimulation(s,[{down:true,right:true,block:true}]);assert(s.players[0].x<=97);assert(s.players[0].z<=67);
});
test('NPC trust, memories, conversations and outstanding promises are private per player',()=>{
 let s=newSimulation('town-council',2);s=meet(s,0,0);act(s,0,{type:'talk',npc:0,choice:'listen'});
 assert.equal(s.npcs[0].trust[0],59);assert.equal(s.npcs[0].trust[1],50);
 const a=simulationView(s,0),b=simulationView(s,1),spectator=simulationView(s,-1);
 assert.equal(a.npcs[0].memories.length,1);assert.equal(b.npcs[0].memories.length,0);assert.equal(b.npcs[0].reaction,null);assert.equal(spectator.npcs[0].trust,null);assert.equal(spectator.npcs[0].memories.length,0);
 assert.throws(()=>act(s,0,{type:'talk',npc:0,choice:'listen'}),/space/);assert.throws(()=>act(s,1,{type:'talk',npc:0,choice:'listen'}),/Walk/);
 a.resources.funds=999;assert.notEqual(s.resources.funds,999);
});
test('NPCs help a trusted player once per day and refuse a stranger',()=>{
 let s=newSimulation('castaway-crew',2);s=meet(s,0,0);act(s,0,{type:'talk',npc:0,choice:'listen'});dusk(s);
 s=meet(s,0,0);const before=s.metrics.radio;act(s,0,{type:'talk',npc:0,choice:'ask'});assert.equal(s.metrics.radio,before+10);assert(s.npcs[0].worked);
 s=meet(s,1,0);act(s,1,{type:'talk',npc:0,choice:'ask'});assert.equal(s.metrics.radio,before+10);assert.equal(s.npcs[0].trust[1],47);
});
test('promises resolve on their due day and change trust only for their author',()=>{
 for(const kept of [true,false]){let s=newSimulation('town-council',2);s=meet(s,0,1);act(s,0,{type:'talk',npc:1,choice:'promise'});const promise=s.promises[0];assert.equal(simulationView(s,1).promises.length,0);dusk(s);assert(!promise.done);
  if(kept)s.metrics.festival=promise.target;else s.metrics.festival=0;
  s.event.resolved=true;const before=s.npcs[1].trust[0];dusk(s);assert(promise.done);assert.equal(s.npcs[1].trust[0],before+(kept?15:-18));assert.equal(s.npcs[1].trust[1],50);
 }
});
test('ballots stay private, ties choose the published fallback, and an unfunded proposal does not spend',()=>{
 const s=newSimulation('town-council',2),funds=s.resources.funds;act(s,0,{type:'vote',option:0});assert.deepEqual(simulationView(s,1).event.votes,[null,null]);assert.deepEqual(simulationView(s,1).event.voted,[true,false]);act(s,1,{type:'vote',option:1});assert(s.event.resolved);assert.equal(s.resources.funds,funds-2);assert.match(s.event.result,/Tie/);assert.throws(()=>act(s,0,{type:'vote',option:0}),/already/);
 const poor=newSimulation('town-council',2);poor.resources.funds=0;act(poor,0,{type:'vote',option:0});act(poor,1,{type:'vote',option:0});assert.equal(poor.resources.funds,0);assert.equal(poor.metrics.festival,10);assert.match(poor.event.result,/could not be funded/);
});
test('stale, malformed, out of seat, exhausted and impossible near-dusk commands are rejected',()=>{
 let s=newSimulation('castaway-crew',2);assert.throws(()=>simulationAction(s,0,{type:'task',task:'food',day:0}),/changed/);assert.throws(()=>act(s,-1,{type:'ready',ready:true}),/Join/);assert.throws(()=>act(s,0,{type:'ready',ready:'yes'}));assert.throws(()=>act(s,0,{type:'travel',x:1e20,z:Infinity}));assert.throws(()=>act(s,0,{type:'vote',option:NaN}));assert.throws(()=>act(s,0,{type:'score',score:999}));
 s.dayElapsed=149;site(s,0,'shore');assert.throws(()=>act(s,0,{type:'task',task:'food'}),/Dusk/);s.dayElapsed=0;s.players[0].energy=0;assert.throws(()=>act(s,0,{type:'task',task:'food'}),/actions/);site(s,0,'camp');act(s,0,{type:'vote',option:0});
});
test('all ready advances once, prevents work from being cut off, and new days refresh actions',()=>{
 let s=newSimulation('town-council',2);site(s,0,'market');act(s,0,{type:'task',task:'trade'});assert.throws(()=>act(s,0,{type:'ready',ready:true}),/Finish/);s=step(s,250);site(s,0,'council');act(s,0,{type:'ready',ready:true});assert.equal(s.day,1);act(s,1,{type:'ready',ready:true});assert.equal(s.day,2);assert.equal(s.players[0].energy,4);assert(s.players.every(p=>!p.ready));
});
test('solo, two and four players can complete both games through authored decisions and tasks',()=>{
 for(const game of simulationIds)for(const count of [1,2,4]){let s=newSimulation(game,count);for(let day=1;day<=s.totalDays;day++){
   for(let i=0;i<count;i++){site(s,i,game==='town-council'?'council':'camp');act(s,i,{type:'vote',option:2});}
   const tasks=game==='town-council'?['trade','festival','trade','repair']:['food','wood','radio','shelter'];
   for(let round=0;round<(count===1?6:3);round++){
    for(let seat=0;seat<count;seat++){
     let task=tasks[(round*count+seat)%tasks.length];
     if(game==='castaway-crew'&&task==='radio'&&s.resources.parts<1)task='salvage';
     if(game==='castaway-crew'&&['radio','shelter'].includes(task)&&s.resources.wood<3)task='wood';
     site(s,seat,simulationView(s,seat).tasks.find(t=>t.id===task).location);act(s,seat,{type:'task',task});
    }s=step(s,260);
   }
   dusk(s);
  }assert(s.finished,game);assert.deepEqual(s.winners,Array.from({length:count},(_,i)=>i),`${game} / ${count}: ${s.reason}`);
 }
});
test('room sessions preserve shared state, redact personal memories, deduplicate receipts and cancel on restart',async ()=>{
 const store=(await openStore(':memory:'));try{let rooms=(await createArcadeRooms(store));const a=(await store.ensureUser('sim-a','Ari','practice')),b=(await store.ensureUser('sim-b','Bea','practice')),c=(await store.ensureUser('sim-c','Cai','practice'));
  (await assert.rejects(async ()=>(await rooms.create({game_id:'town-council',entry:'0.1'},a,1000)),/deposit/));
  let r=(await rooms.create({game_id:'castaway-crew',visibility:'invite'},a,1000));(await assert.rejects(async ()=>(await rooms.get(r.id,c)),/invitation/));(await rooms.action(r.id,b,{type:'join'},r.invite_key,1001));
  for(const u of [a,b])(await rooms.action(r.id,u,{type:'ready',ready:true},null,1002));r=(await rooms.start(r.id,a,null,1003));
  let now=4003;for(let i=0;i<40;i++){now+=50;(await rooms.input(r.id,a,{seq:i,controls:i<20?{right:true}:{right:true,up:true}},null,now));(await rooms.tick(now));}
  const payload={type:'play',input_id:'sim-receipt-001',action:{type:'task',task:'radio',day:1}};
  r=(await rooms.action(r.id,a,payload,null,now+1));const before=r.state.resources.parts;(await rooms.action(r.id,a,payload,null,now+2));assert.equal((await rooms.get(r.id,b)).state.resources.parts,before);
  (await assert.rejects(async ()=>(await rooms.action(r.id,a,{...payload,action:{type:'task',task:'food',day:1}},null,now+3)),/receipt/));
  (await assert.rejects(async ()=>(await rooms.action(r.id,c,{...payload,input_id:'sim-spectator-1'},r.invite_key,now+3)),/Join/));
  (await rooms.input(r.id,a,{seq:41,controls:{}},null,now+4));
  const snapshots=[[],[]],unsub=[(await rooms.subscribe(r.id,a,null,v=>snapshots[0].push(v))),(await rooms.subscribe(r.id,b,null,v=>snapshots[1].push(v)))];
  for(let t=now+50;t<=now+12000;t+=50)(await rooms.tick(t));
  assert.equal((await rooms.get(r.id,b)).state.metrics.radio,16);const sa=snapshots[0].at(-1),sb=snapshots[1].at(-1);assert.deepEqual(sa.state.players,sb.state.players);assert.equal(sa.state.tick,sb.state.tick);assert(sa.state.npcs[0].trust>sb.state.npcs[0].trust);unsub.forEach(f=>f());
  rooms=(await createArcadeRooms(store));assert.equal((await rooms.get(r.id,a)).status,'cancelled');
  const solo=(await rooms.create({game_id:'town-council',solo:true},a,20000));assert.equal(solo.players.length,1);assert(!solo.players[0].bot);
 }finally{(await store.db.close());}
});
test('selected original asset bytes, textures and licences are present with recorded hashes',async()=>{
 const root=new URL('../public/models/simulation/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
 for(const f of manifest.files){const data=await readFile(new URL(f.url.slice('/models/simulation/'.length),root));assert.equal(createHash('sha256').update(data).digest('hex'),f.sha256,f.url);}
 const projectRoot=new URL('../',import.meta.url),published=new Set(manifest.files.map(f=>f.url));
 for(const asset of Object.values(manifest.assets)){
  const source=await readFile(new URL(asset.source,projectRoot));
  assert.equal(createHash('sha256').update(source).digest('hex'),asset.sha256,asset.source);
  for(const dependency of asset.dependencies)assert(published.has(dependency),`Unpublished dependency: ${dependency}`);
 }
 for(const n of ['player-0','player-3','npc-0','npc-5']){assert(manifest.assets[n].animations.includes('walk'));assert(manifest.assets[n].animations.includes('emote-no'));}
});
