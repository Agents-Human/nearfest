import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {newWorld,advanceWorld,worldAction,worldBot} from '../server/arcade/world.mjs';
import {createArcadeRooms} from '../server/arcade/rooms.mjs';
import {openStore} from './helpers/store.mjs';
import {discoveryGames} from '../server/game-catalog.mjs';
const step=(state,n,input=[])=>{for(let i=0;i<n&&!state.finished;i++)state=advanceWorld(state,input);return state;};

test('Tappy Plane is published for solo and optional-stake 2–4-player rooms with licensed, unchanged artwork',()=>{
 const game=discoveryGames.find(g=>g.id==='tappy-plane');assert(game.solo&&game.multiplayer);assert.equal(game.bettable,true);assert.equal(game.min_players,2);assert.equal(game.max_players,4);
 const root=new URL('../public/games/tappy-plane/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('provenance.json',root)));
 assert.equal(manifest.license,'CC0-1.0');assert.match(readFileSync(new URL('License.txt',root),'utf8'),/Creative Commons Zero/);
 for(const file of manifest.files)assert.equal(createHash('sha256').update(readFileSync(new URL(file.file,root))).digest('hex'),file.sha256,file.file);
 assert.equal(createHash('sha256').update(readFileSync(new URL('../public'+manifest.cover.file,import.meta.url))).digest('hex'),manifest.cover.sha256);
});
test('a flap lifts once, holding does not auto-flap, and a released press lifts again',()=>{
 const initial=newWorld('tappy-plane',1),lifted=advanceWorld(initial,[{attack:true}]);assert.equal(initial.players[0].vy,0);assert(lifted.players[0].vy<0);assert.equal(lifted.players[0].flaps,1);
 let held=step(lifted,8,[{attack:true}]);assert(held.players[0].vy>0);assert.equal(held.players[0].flaps,1);
 held=advanceWorld(held,[{}]);held=advanceWorld(held,[{up:true}]);assert.equal(held.players[0].flaps,2);assert(held.players[0].vy<0);
});
test('receipt-based taps survive a short click, respect cooldowns, and reject client-owned scores',()=>{
 let s=newWorld('tappy-plane',1);worldAction(s,0,{type:'flap'});s=advanceWorld(s,[]);assert(s.players[0].vy<0);assert.equal(s.players[0].flaps,1);
 worldAction(s,0,{type:'flap'});s=advanceWorld(s,[]);assert.equal(s.players[0].flaps,1);
 s=step(s,3);worldAction(s,0,{type:'flap'});s=advanceWorld(s,[]);assert.equal(s.players[0].flaps,2);
 assert.throws(()=>worldAction(s,0,{type:'flap',score:1000}),/Scores and positions/);assert.throws(()=>worldAction(s,0,{type:'score'}),/Tap to flap/);
});
test('ground, sky and tapered rocks collide, while the open gap is safe',()=>{
 for(const [y,vy,reason] of [[416,80,'ground'],[14,-80,'sky boundary']]){const s=newWorld('tappy-plane',1);s.waiting=false;Object.assign(s.players[0],{y,vy});const result=advanceWorld(s,[]);assert(result.finished);assert.match(result.players[0].deathReason,new RegExp(reason));}
 const s=newWorld('tappy-plane',1);s.waiting=false;s.gates=[{id:0,x:170,width:96,center:220,gap:180}];s.nextGate=1;
 assert(advanceWorld(s,[]).players[0].alive);
 s.players[0].y=30;const hit=advanceWorld(s,[]);assert.equal(hit.players[0].deathReason,'a rock');assert(hit.finished);
});
test('each star and gate scores once for each pilot; eliminated pilots cannot keep scoring',()=>{
 let s=newWorld('tappy-plane',2);s.gates=[{id:0,x:170,width:96,center:220,gap:194}];s.nextGate=1;
 s=advanceWorld(s,[]);assert.deepEqual(s.players.map(p=>p.score),[3,3]);s=advanceWorld(s,[]);assert.deepEqual(s.players.map(p=>p.stars),[1,1]);
 s.scroll=90;s=advanceWorld(s,[]);assert.deepEqual(s.players.map(p=>p.score),[4,4]);assert.deepEqual(s.players.map(p=>p.gates),[1,1]);s=advanceWorld(s,[]);assert.deepEqual(s.players.map(p=>p.score),[4,4]);
 s.players[0].alive=false;const oldScore=s.players[0].score;s=advanceWorld(s,[]);assert.equal(s.players[0].score,oldScore);assert.deepEqual(s.winners,[1]);assert.equal(advanceWorld(s,[]),s);
});
test('multiplayer finishes on the last survivor; equal final crashes draw; solo ends on its own crash',()=>{
 let s=newWorld('tappy-plane',4);s.players[0].y=416;s=advanceWorld(s,[]);assert(!s.finished);assert.equal(s.players.filter(p=>p.alive).length,3);
 s.players[1].y=416;s.players[2].y=416;s=advanceWorld(s,[]);assert(s.finished);assert.deepEqual(s.winners,[3]);
 const tie=step(newWorld('tappy-plane',4),60);assert(tie.finished);assert.deepEqual(tie.winners,[]);assert(tie.players.every(p=>!p.alive));assert.match(tie.reason,/draw/);
 let solo=step(newWorld('tappy-plane',1),60);assert(solo.waiting);assert.equal(solo.elapsed,0);assert.equal(solo.scroll,0);
 worldAction(solo,0,{type:'flap'});solo=step(solo,60);assert(solo.finished);assert.equal(solo.players.length,1);assert.match(solo.reason,/Flight complete/);
});
test('shared course and identical controls stay deterministic; long flights keep bounded terrain',()=>{
 let a=newWorld('tappy-plane',2),b=structuredClone(a);
 for(let i=0;i<1000&&!a.finished;i++){const controls=a.players.map((_,seat)=>worldBot(a,seat));a=advanceWorld(a,controls);b=advanceWorld(b,controls);}
 assert.deepEqual(a,b);assert.equal(a.players[0].score,a.players[1].score);assert(a.players[0].gates>10);assert(a.gates.length<9);assert(a.gates[0].id>5);
 for(const g of a.gates){assert(g.gap>=148);assert(g.center-g.gap/2>=45);assert(g.center+g.gap/2<=385);}
});
test('rooms enforce readiness, countdown, invitations, replay protection and free solo without bots',async ()=>{
 const store=(await openStore(':memory:'));try{
  const rooms=(await createArcadeRooms(store)),a=(await store.ensureUser('tappy-a','Pilot A','practice')),b=(await store.ensureUser('tappy-b','Pilot B','practice')),outsider=(await store.ensureUser('tappy-c','Spectator','practice'));
  (await assert.rejects(async ()=>(await rooms.create({game_id:'tappy-plane',entry:'0.1'},a)),/deposit/));
  let r=(await rooms.create({game_id:'tappy-plane',entry:'0',visibility:'invite'},a,1000));
  (await assert.rejects(async ()=>(await rooms.get(r.id,b)),/invitation/));(await rooms.action(r.id,b,{type:'join'},r.invite_key,1001));(await assert.rejects(async ()=>(await rooms.start(r.id,a,null,1002)),/ready/));
  for(const user of [a,b])(await rooms.action(r.id,user,{type:'ready',ready:true},null,1003));r=(await rooms.start(r.id,a,null,1004));assert.equal(r.ends_at,null);
  const flap={type:'play',input_id:'tappy-flap-receipt',action:{type:'flap'}};
  (await assert.rejects(async ()=>(await rooms.action(r.id,a,flap,null,1005)),/Wait for the game/));(await assert.rejects(async ()=>(await rooms.action(r.id,outsider,flap,r.invite_key,4010)),/Join/));
  (await rooms.action(r.id,a,flap,null,4010));(await rooms.tick(4054));assert.equal((await rooms.get(r.id,a)).state.players[0].flaps,1);
  (await rooms.action(r.id,a,flap,null,4060));(await rooms.tick(4104));assert.equal((await rooms.get(r.id,a)).state.players[0].flaps,1);
  (await assert.rejects(async ()=>(await rooms.action(r.id,a,{...flap,action:{score:100}},null,4110)),/reused/));
  (await rooms.action(r.id,a,{type:'resign'},null,4120));
  r=(await rooms.create({game_id:'tappy-plane',solo:true,entry:'0'},a,5000));assert.equal(r.players.length,1);assert(!r.players[0].bot);assert.equal(r.ends_at,null);
  (await rooms.action(r.id,a,{...flap,input_id:'solo-flight-start'},null,8010));
  for(let time=8050;time<10500;time+=50)(await rooms.tick(time));assert.equal((await rooms.get(r.id,a)).status,'finished');
 }finally{(await store.db.close());}
});
