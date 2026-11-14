import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldSnapshots} from '../src/games/world-snapshots.mjs';

const state = tick => ({game:'platform-relay',tick,elapsed:tick*.05,finished:false,stormX:tick*4,
  players:[{x:tick*10,y:435,ground:true}],
  shots:[{id:1,x:tick*27,y:420,vx:540,life:1.15-tick*.05}],
  platforms:[{id:1,x:tick*2,y:460}],enemies:[],coins:[],hazards:[],springs:[]});

test('20 Hz snapshots produce continuous players, shots, moving islands and storm at 120 Hz',()=>{
  const buffer=new WorldSnapshots();let last=-1,intermediate=0;
  for(let frame=0;frame<=240;frame++){
    const now=frame*1000/120;
    if(frame%6===0)buffer.push(state(frame/6),now);
    const rendered=buffer.sample(now);
    assert(rendered.players[0].x>=last,'presentation must never rewind');
    if(frame>18){
      assert(rendered.players[0].x>last,'movement must not stall between normal packets');
      assert(rendered.players[0].x-last<2,'no full server-tick jumps');
    }
    if(rendered.tick%1!==0)intermediate++;
    assert(Math.abs(rendered.shots[0].x-rendered.players[0].x*2.7)<1e-8);
    assert(Math.abs(rendered.platforms[0].x-rendered.tick*2)<1e-8);
    assert(Math.abs(rendered.stormX-rendered.tick*4)<1e-8);
    assert(Math.abs(rendered.elapsed-rendered.tick*.05)<1e-8);
    last=rendered.players[0].x;
  }
  assert(intermediate>200);
});

test('jitter, a missed packet, duplicates and reordered snapshots never rewind projectiles',()=>{
  const buffer=new WorldSnapshots();const arrivals=[[0,0],[1,48],[2,115],[3,145],[5,260],[6,305],[7,340],[8,415],[9,450]];
  let index=0,last=-1;
  for(let now=0;now<600;now+=8){
    while(index<arrivals.length&&arrivals[index][1]<=now){const [tick,at]=arrivals[index++];buffer.push(state(tick),at);buffer.push(state(tick),at+1);if(tick>2)buffer.push(state(tick-2),at+2);}
    const rendered=buffer.sample(now);
    assert(rendered.shots[0].x>=last);assert(rendered.tick<=buffer.latest.tick);
    last=rendered.shots[0].x;
  }
  assert.equal(buffer.latest.tick,9);assert.equal(last,9*27);
});

test('spawns, deaths and coin pickup change once at their presentation boundary',()=>{
  const buffer=new WorldSnapshots(),a=state(10),b=state(11),c=state(12);
  a.enemies=[{id:8,x:100,y:440,alive:true}];a.coins=[{id:2,x:150,y:400,collectedBy:[]}];
  b.enemies=[];b.shots=[{id:2,x:315,y:420,life:1}];b.coins=[{...a.coins[0],collectedBy:[0]}];
  c.enemies=[];c.shots=[{...b.shots[0],x:342}];c.coins=b.coins;
  const untouched=structuredClone([a,b,c]);buffer.push(a,0);buffer.push(b,50);buffer.push(c,100);
  let before=buffer.sample(100);assert.equal(before.enemies.length,1);
  for(let now=108;now<150;now+=8){before=buffer.sample(now);if(before.tick<11){assert.equal(before.shots[0].id,1);assert.equal(before.enemies.length,1);assert.deepEqual(before.coins[0].collectedBy,[]);}}
  const after=buffer.sample(180);assert(after.tick>=11);assert.equal(after.enemies.length,0);assert.equal(after.shots[0].id,2);assert.deepEqual(after.coins[0].collectedBy,[0]);
  assert.deepEqual([a,b,c],untouched,'render interpolation never changes authoritative state');
});

test('respawns snap at the correct tick instead of flying across a gap; a same-tick finish is accepted',()=>{
  const buffer=new WorldSnapshots(),a=state(0),b=state(1),c=state(2);a.players[0].x=900;b.players[0].x=c.players[0].x=30;
  buffer.push(a,0);buffer.push(b,50);buffer.push(c,100);buffer.sample(100);
  assert.equal(buffer.sample(125).players[0].x,900);assert.equal(buffer.sample(200).players[0].x,30);
  buffer.push({...c,finished:true},220);assert.equal(buffer.sample(220).finished,true);
});

test('tab resume discards accumulated presentation lag and a disconnected world stops at known state',()=>{
  const buffer=new WorldSnapshots();buffer.push(state(0),0);buffer.sample(0);
  for(let tick=1;tick<100;tick++)buffer.push(state(tick),tick*50);
  const resumed=buffer.sample(5000);assert(resumed.tick>=97);assert(resumed.tick<=99);
  assert.equal(buffer.sample(10000).tick,99);
});


test('racing pulse bolts share the smooth player timeline and impact membership boundary',()=>{
 const buffer=new WorldSnapshots();
 for(let tick=0;tick<3;tick++)buffer.push({game:'pocket-racers',tick,elapsed:tick*.05,finished:false,players:[{x:480,y:tick*28,speed:560}],shots:tick<2?[{id:7,x:480,y:32+tick*83,life:1.45-tick*.05}]:[]},tick*50);
 buffer.sample(100);const midway=buffer.sample(125);assert(midway.tick>0&&midway.tick<1);assert(midway.shots[0].y>32&&midway.shots[0].y<115);assert(Math.abs(midway.shots[0].y-(32+midway.tick*83))<1e-8);
 assert.equal(buffer.sample(250).shots.length,0);
});


test('racing stays continuous across a 250ms snapshot gap at full speed',()=>{
 const buffer=new WorldSnapshots();
 for(const tick of [0,5,10])buffer.push({game:'pocket-racers',tick,elapsed:tick*.05,finished:false,players:[{x:480,y:tick*40,speed:800}],shots:[{id:1,x:480,y:32+tick*95,life:1.45-tick*.05}]},tick*50);
 let last=0;
 for(let now=500;now<=580;now+=8){const s=buffer.sample(now);assert(Math.abs(s.players[0].y-s.tick*40)<1e-8);assert(Math.abs(s.shots[0].y-(32+s.tick*95))<1e-8);assert(s.shots[0].y>last);last=s.shots[0].y;}
});
