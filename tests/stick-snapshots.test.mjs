import test from 'node:test';
import assert from 'node:assert/strict';
import {StickSnapshots} from '../src/games/stick-snapshots.mjs';
import {newWorld,advanceWorld} from '../server/arcade/world.mjs';

test('an accepted strike or guard is shown immediately with no two-tick presentation delay',()=>{
 const buffer=new StickSnapshots(),start=newWorld('stick-rivals',2);buffer.push(start,0);
 const strike=advanceWorld(start,[{attack:true},{}]);buffer.push(strike,50);
 assert.equal(buffer.sample(50).players[0].attackSeq,1);
 const guard=advanceWorld(start,[{block:true},{}]);buffer.push({...guard,tick:2},100);
 assert.equal(buffer.sample(100).players[0].blocking,true);
});
test('movement remains continuous at 120 Hz and prediction stops after one missing tick',()=>{
 const buffer=new StickSnapshots();let s=newWorld('stick-rivals',2),last=-Infinity,intermediate=0;
 s.players[1].x=900;
 for(let frame=0;frame<120;frame++){
  const now=frame*1000/120;
  if(frame%6===0){s=advanceWorld(s,[{right:true},{}]);buffer.push(s,now);}
  const p=buffer.sample(now).players[0];assert(p.x>last,'regular movement must not freeze between packets');
  if(frame%6!==0){assert(p.x>s.players[0].x);intermediate++;}
  last=p.x;
 }
 assert.equal(intermediate,100);
 const settled=buffer.sample(1100);assert.deepEqual(buffer.sample(3000),settled,'lost packets cannot keep the fighter moving');
});
test('release, hit and round reset replace predictions immediately without mutating game state',()=>{
 const buffer=new StickSnapshots();let s=advanceWorld(newWorld('stick-rivals',2),[{right:true},{}]);buffer.push(s,0);
 s=advanceWorld(s,[{},{}]);buffer.push(s,50);const stopped=s.players[0].x;
 assert.equal(buffer.sample(80).players[0].x,stopped);
 const hit=structuredClone(s);hit.tick++;Object.assign(hit.players[0],{hp:89,x:stopped-42,vx:-275,stun:.23,hurtTimer:.24});
 buffer.push(hit,100);assert.equal(buffer.sample(100).players[0].x,hit.players[0].x);assert.equal(buffer.sample(100).players[0].stun,.23);
 const reset=newWorld('stick-rivals',2);reset.tick=hit.tick+1;reset.round=1;const before=structuredClone(reset);buffer.push(reset,150);buffer.sample(175);
 assert.equal(buffer.sample(150).players[0].x,350);assert.deepEqual(reset,before);
 buffer.push({...reset,tick:0},160);assert.equal(buffer.latest.tick,reset.tick);
 buffer.push({...reset,finished:true},170);assert.equal(buffer.sample(190).finished,true);
});
test('a heavy hit begins at contact before smoothly following knockback',()=>{
 const buffer=new StickSnapshots();let s=newWorld('stick-rivals',2);s.players[0].x=435;s.players[1].x=505;
 buffer.push(s,0);s=advanceWorld(s,[{down:true},{}]);buffer.push(s,50);
 const contactX=s.players[1].x;s=advanceWorld(s,[{},{}]);const before=structuredClone(s);buffer.push(s,100);
 assert.equal(buffer.sample(100).players[1].x,contactX,'impact must touch the defender before recoil');
 assert(buffer.sample(125).players[1].x>contactX);assert(buffer.sample(150).players[1].x>=s.players[1].x);
 assert.deepEqual(s,before);assert.equal(buffer.sample(100).players[1].hp,89);
});
