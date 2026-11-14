import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorld,advanceWorld} from '../server/arcade/world.mjs';
import {createArcadeRooms} from '../server/arcade/rooms.mjs';
import {openStore} from '../server/store.mjs';
const step=(s,n,c=[])=>{for(let i=0;i<n;i++)s=advanceWorld(s,c);return s;};
const close=()=>{const s=newWorld('stick-rivals',2);s.weapons=[];s.players[0].x=435;s.players[1].x=495;return s;};

test('terrace fights stay on one floor; a held attack lands all four moves in one second',()=>{
 let s=close();assert.deepEqual(s.platforms,[]);assert.equal(newWorld('stick-rivals',2).weapons.length,3);
 const before=structuredClone(s),kinds=new Set();for(let i=0;i<21;i++){s=advanceWorld(s,[{attack:true},{}]);kinds.add(s.players[0].attackKind);}
 assert.deepEqual([...kinds],['punch','cross','knee','crescent']);assert.equal(s.players[0].hitCombo,4);assert.equal(s.players[1].hp,71);assert.equal(before.players[1].hp,100);assert(s.players[1].y<410,'finisher launches the defender');
 const whiff=step(newWorld('stick-rivals',2),20,[{attack:true},{}]);assert.equal(whiff.players[0].hitCombo,0);
});
test('a quick attack during recovery is buffered without requiring the button to stay held',()=>{
 let s=close();s=advanceWorld(s,[{attack:true},{}]);s=step(s,2);s=advanceWorld(s,[{attack:true},{}]);s=step(s,4);
 assert.equal(s.players[0].attackSeq,2);assert.equal(s.players[0].attackKind,'cross');assert.equal(s.players[1].hp,89);
});
test('holding jump does not auto-flip or bunny-hop; a second press performs exactly one air flip',()=>{
 let s=newWorld('stick-rivals',2);s=step(s,30,[{up:true},{}]);assert.equal(s.players[0].y,410);assert.equal(s.players[0].airJumps,1);assert.equal(s.players[0].airFlip,0);
 s=newWorld('stick-rivals',2);s=advanceWorld(s,[{up:true},{}]);s=advanceWorld(s,[{},{}]);s=advanceWorld(s,[{up:true},{}]);assert.equal(s.players[0].airJumps,0);assert(s.players[0].airFlip>0);const vy=s.players[0].vy;s=advanceWorld(s,[{},{}]);s=advanceWorld(s,[{up:true},{}]);assert(s.players[0].vy>vy,'a third press cannot reset upward velocity');
});
test('parry prevents damage and opens a counter; normal guard chips and can break',()=>{
 let s=advanceWorld(close(),[{attack:true},{block:true}]);assert.equal(s.players[1].hp,100);assert(s.players[0].stun>0);assert.equal(s.players[0].attack,0);assert(s.impacts.some(i=>i.kind==='parry'&&i.owner===1));
 const guard=close();guard.players[1].blocking=true;s=advanceWorld(guard,[{attack:true},{block:true}]);assert.equal(s.players[1].hp,98);assert(s.impacts.some(i=>i.kind==='block'));assert(!s.impacts.some(i=>['hit','heavy'].includes(i.kind)));
 const tired=close();Object.assign(tired.players[1],{blocking:true,energy:6});s=advanceWorld(tired,[{attack:true},{block:true}]);assert(s.players[1].guardBroken>0);assert.equal(s.players[1].blocking,false);assert(s.impacts.some(i=>i.kind==='break'));
});
test('dropkicks preserve forward momentum and successful hits locate their contact before knockback',()=>{
 let s=newWorld('stick-rivals',2);Object.assign(s.players[0],{x:410,y:320,ground:false,vy:0});s.players[1].x=485;
 s=advanceWorld(s,[{down:true},{}]);const x=s.players[0].x;s=advanceWorld(s,[{},{}]);assert(s.players[0].x>x+15,'dropkick does not lose its impulse on the next tick');s=step(s,6);assert(s.players[1].hp<100);
 s=advanceWorld(close(),[{attack:true},{}]);const impact=s.impacts.find(i=>i.kind==='hit');assert(impact);assert.equal(impact.x,485);assert.equal(impact.owner,0);assert.equal(s.players[1].hurtKind,'punch');
});
test('round-break physics settles a defeated fighter onto the terrace before resetting',()=>{
 let s=close();s.players[1].hp=5;s=advanceWorld(s,[{attack:true},{}]);assert(s.breakTime>0);s=step(s,18);assert.equal(s.players[1].hp,0);assert.equal(s.players[1].y,410);assert.equal(s.players[1].ground,true);s=step(s,24);assert.equal(s.round,1);assert.equal(s.players[1].hp,100);assert.equal(s.players[0].hitCombo,0);
});
test('quick kick, blast and guard taps survive release between server ticks',()=>{
 for(const [key,kind] of [['down','kick'],['fire','blast'],['block',null]]){
  const store=openStore(':memory:');try{
   const rooms=createArcadeRooms(store),user=store.ensureUser('stick-'+key,'Fighter','practice'),r=rooms.create({game_id:'stick-rivals',solo:true,entry:'0'},user,1000);
   rooms.input(r.id,user,{seq:1,controls:{[key]:true}},null,4001);rooms.input(r.id,user,{seq:2,controls:{[key]:false}},null,4002);rooms.tick(4050);
   const p=rooms.get(r.id,user).state.players[0];if(kind){assert.equal(p.attackKind,kind);assert.equal(p.attackSeq,1);}else assert.equal(p.blocking,true);
   rooms.tick(4100);if(!kind)assert.equal(rooms.get(r.id,user).state.players[0].blocking,false);
  }finally{store.db.close();}
 }
});

test('terrace pickups equip finite-use weapons with distinct heavy moves and respawn',()=>{
 for(const [index,kind,move] of [[0,'sword','slash'],[1,'hammer','smash'],[2,'staff','staff']]){
  let s=newWorld('stick-rivals',2);s.players[0].x=s.weapons[index].x;s.players[1].x=s.players[0].x+80;s=advanceWorld(s,[{},{}]);assert.equal(s.players[0].weapon,kind);assert.equal(s.players[0].weaponUses,6);assert.equal(s.weapons[index].active,false);s=step(s,5,[{down:true},{}]);assert.equal(s.players[0].attackKind,move);assert(s.players[1].hp<100);assert.equal(s.players[0].weaponUses,5);
  s.players[0].x=350;s.players[1].x=610;s=step(s,270);assert(s.weapons[index].active);assert.equal(s.players[0].weapon,null);
 }
});
test('a well-timed defensive dash evades a strike, but spends spirit and has a cooldown',()=>{
 let s=close();s=advanceWorld(s,[{attack:true},{left:true,block:true}]);assert.equal(s.players[1].hp,100);assert(s.players[1].dashCooldown>0);assert(s.players[1].energy<100);assert(s.impacts.some(i=>i.kind==='dodge'));
});
