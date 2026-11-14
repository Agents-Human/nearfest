import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorld,advanceWorld,worldBot,worldAction} from '../server/arcade/world.mjs';
import {createArcadeRooms} from '../server/arcade/rooms.mjs';
import {openStore} from './helpers/store.mjs';
const ticks=(s,n,inputs=()=>[])=>{for(let i=0;i<n&&!s.finished;i++)s=advanceWorld(s,inputs(s));return s;};
const crossing=(s,holds)=>ticks(s,120,state=>state.players.map((p,i)=>({attack:p.phase==='waiting'||p.phase==='stretching'&&p.length<holds[i]})));
test('bridge hold/release lands only on the next tower, awards perfect coins, and advances indefinitely',()=>{
 let s=newWorld('bridge-builders',1);
 for(let i=0;i<12;i++){
  const round=s.round,center=s.to.x+s.to.w/2-s.from.x-s.from.w;
  // A human holds, releases, then waits for the automatic walk and next gap.
  while(s.players[0].phase==='waiting'||s.players[0].phase==='stretching'&&s.players[0].length<center-4)s=advanceWorld(s,[{attack:true}]);
  for(let j=0;j<160&&s.round===round&&!s.finished;j++)s=advanceWorld(s,[]);
  assert.equal(s.round,round+1);assert(!s.finished);assert(s.players[0].coins>=i+1);assert.equal(s.players[0].crossings,i+1);assert(s.platforms.length<=6);
 }
 assert.equal(s.players[0].score,24);assert.equal(s.players[0].coins,36);
});
test('bridge too-short and too-long sticks fall; a safe rival wins and idle rivals cannot stall',()=>{
 for(const miss of [10,420]){let s=newWorld('bridge-builders',2),center=s.to.x+s.to.w/2-s.from.x-s.from.w;s=crossing(s,[miss,center]);assert(s.finished);assert.deepEqual(s.winners,[1]);assert.equal(s.players[0].alive,false);assert.equal(s.players[1].crossings,1);}
 let s=newWorld('bridge-builders',2),center=s.to.x+s.to.w/2-s.from.x-s.from.w;s=ticks(s,750,state=>[{attack:(state.players[0].phase==='waiting'||state.players[0].phase==='stretching'&&state.players[0].length<center)},{}]);assert(s.finished);assert.deepEqual(s.winners,[0]);
});
test('soccer requires a kick near the ball, clamps movement, scores at the goal mouth and resets fairly',()=>{
 let s=newWorld('pocket-soccer',2);s.reset=0;Object.assign(s.players[0],{x:150,y:100});s=advanceWorld(s,[{attack:true}]);assert.equal(s.players[0].kicks,0);assert.equal(s.ball.owner,null);
 Object.assign(s.players[0],{x:700,y:280,heading:0});Object.assign(s.ball,{x:722,y:280,owner:0,lock:0});s=ticks(s,35,()=>[{attack:true},{}]);assert.equal(s.players[0].score,1);assert.equal(s.players[1].score,0);assert.equal(s.ball.x,480);assert.equal(s.players[0].x,250);assert.equal(s.players[1].x,710);
 s.reset=0;Object.assign(s.ball,{x:915,y:100,vx:600,vy:0,owner:null,lock:1});s=advanceWorld(s,[]);assert(s.ball.vx<0);assert.equal(s.players[0].score,1);
 s=ticks(s,100,()=>[{up:true,left:true},{}]);assert(s.players[0].x>=55&&s.players[0].y>=68);
});
test('soccer has a five-goal finish, a golden-goal tiebreak and an active, beatable practice bot',()=>{
 let s=newWorld('pocket-soccer',2);s.reset=0;s.players[0].score=4;Object.assign(s.ball,{x:915,y:280,vx:600,vy:0,owner:null,lock:1});s=advanceWorld(s,[]);assert(s.finished);assert.deepEqual(s.winners,[0]);
 s=newWorld('pocket-soccer',2);s.reset=0;s.matchTime=150;s=advanceWorld(s,[]);assert(s.overtime);assert(!s.finished);Object.assign(s.ball,{x:45,y:280,vx:-600,vy:0,owner:null,lock:1});s=advanceWorld(s,[]);assert(s.finished);assert.deepEqual(s.winners,[1]);
 s=ticks(newWorld('pocket-soccer',2),1800,state=>[{right:true,attack:true},worldBot(state,1)]);assert(s.finished);assert(s.players[0].score>s.players[1].score,'basic movement + kick is a viable beginner strategy');s=ticks(newWorld('pocket-soccer',2),1600,state=>[{},worldBot(state,1)]);assert(s.players[1].kicks>0&&s.players[1].score>0,'bot must participate against a waiting player');
});
test('cats shoot manually without auto-fire, move across the barrier-free street, and clear five mouse zombie waves',()=>{
 let s=newWorld('cat-defense',1);worldAction(s,0,{type:'lane',lane:2});assert.equal(s.players[0].lane,2);assert.throws(()=>worldAction(s,0,{type:'lane',lane:4}),/controls/);
 // Idle cat never shoots automatically even when mouse zombies advance past the old barrier line.
 s=ticks(newWorld('cat-defense',1),250,()=>[{}]);assert.equal(s.players[0].shotsFired,0);assert.equal(s.shots.length,0);assert(s.enemies.some(e=>e.x<300),'mouse zombies advance freely across the street without a barrier');
 // Manual shooting (attack control or shoot action) and shockwave (block control) work on demand.
 s=newWorld('cat-defense',1);s=advanceWorld(s,[{down:true,right:true,attack:true,block:true}]);assert.equal(s.players[0].lane,1);assert(s.players[0].x>195);assert.equal(s.players[0].shotsFired,1);assert.equal(s.shots.length,1);assert.equal(s.players[0].bombs,1);
 s=advanceWorld(s,[{down:true,attack:true,block:true}]);assert.equal(s.players[0].lane,1);assert.equal(s.players[0].shotsFired,1,'fire cooldown prevents instant double fire');assert.equal(s.players[0].bombs,1);
 for(const n of [1,4]){s=ticks(newWorld('cat-defense',n),4000,state=>state.players.map((_,i)=>worldBot(state,i)));assert(s.finished);assert.equal(s.wave,5);assert.equal(s.winners.length,n);assert(s.kills>0);assert(s.gold>50);assert(s.players.some(p=>p.level>1));assert.equal(s.enemies.length,0);assert(s.elapsed<180);}
});
test('new games use real multiplayer rooms, free entry and server-owned held input',async ()=>{
 const store=(await openStore(':memory:'));try{const rooms=(await createArcadeRooms(store)),a=(await store.ensureUser('social-a','Alice','practice')),b=(await store.ensureUser('social-b','Bob','practice'));
  for(const id of ['pocket-soccer','cat-defense','bridge-builders']){
   (await assert.rejects(async ()=>(await rooms.create({game_id:id,entry:'5'},a,1000)),/deposit/));
   let r=(await rooms.create({game_id:id,entry:'0'},a,1000));(await rooms.action(r.id,b,{type:'join'},null,1001));for(const user of [a,b])(await rooms.action(r.id,user,{type:'ready',ready:true},null,1002));r=(await rooms.start(r.id,a,null,1003));assert.equal(r.state.players.length,2);
   if(id!=='pocket-soccer')assert.equal(r.ends_at,null);
   (await rooms.input(r.id,a,{seq:1,controls:{attack:true},score:999},null,4004));(await rooms.input(r.id,a,{seq:2,controls:{}},null,4005));(await rooms.tick(4053));r=(await rooms.get(r.id,a));assert.equal(r.state.players[0].score,0);if(id==='bridge-builders')assert(r.state.players[0].length>0,'quick taps survive the network tick');if(id==='cat-defense')assert.equal(r.state.players[0].shotsFired,1);
   (await rooms.action(r.id,a,{type:'resign'},null,4055));
  }
 }finally{(await store.db.close());}
});
