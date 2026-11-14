import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorld,advanceWorld,worldBot} from '../server/arcade/world.mjs';
import {extendRaceCourse} from '../server/arcade/race-physics.mjs';
import {raceBiome,raceWaterAt,raceWeather,roadHeight,roadGrade,raceBridgeSections,raceTerrainHeight,raceSceneryAllowed,raceRampSections,raceRampHeight,raceTrafficX} from '../server/arcade/race-course.mjs';
import {createArcadeRooms} from '../server/arcade/rooms.mjs';
import {openStore} from './helpers/store.mjs';

const drive=(s,count,input=[])=>{for(let i=0;i<count;i++){const held=typeof input==='function'?input(s):input;s=advanceWorld(s,s.players.map((_,seat)=>({up:true,...held[seat]})));}return s;};
const clear=s=>{s.traffic=[];s.pickups=[];s.boostPads=[];return s;};

test('racing keeps going past the old finish and resolves by distance only at the configured deadline',()=>{
 let s=clear(newWorld('pocket-racers',2));s.timeLimit=180;s.players.forEach((p,i)=>{p.y=13000-i*70;p.speed=560;});extendRaceCourse(s);clear(s);
 s=drive(s,10);assert(!s.finished);assert(s.players[0].y>13000);assert.equal(s.players[0].finish,null);
 s.elapsed=179.9;s.players[0].y=30000;s.players[1].y=29900;s.players[0].coins=0;s.players[1].coins=999;
 s=advanceWorld(s,s.players.map(()=>({up:true})));assert(!s.finished);assert.equal(s.elapsed,179.95);
 s=advanceWorld(s,s.players.map(()=>({up:true})));assert(s.finished);assert.equal(s.elapsed,180);assert.deepEqual(s.winners,[0]);
 const end=structuredClone(s);assert.deepEqual(advanceWorld(s,[{up:true,attack:true}]),end);
});

test('a tied distance at zero produces shared winners and no finish-line tiebreak',()=>{
 let s=clear(newWorld('pocket-racers',2));s.timeLimit=60;s.elapsed=59.95;s.players.forEach(p=>{p.y=9001;p.speed=560;});
 s=advanceWorld(s,s.players.map(()=>({up:true})));assert(s.finished);assert.deepEqual(s.winners,[0,1]);
});

test('acceleration is quick, a steering tap is gentle, sustained steering is smooth and countersteering recovers',()=>{
 let s=clear(newWorld('pocket-racers',1));const x=s.players[0].x;
 s=advanceWorld(s,[{up:true,right:true}]);assert(s.players[0].x-x<1);assert(s.players[0].vx>0&&s.players[0].vx<15);
 const first=s.players[0].vx;s=advanceWorld(s,[{up:true,right:true}]);assert(s.players[0].vx>first&&s.players[0].vx<40);
 const held=s.players[0].vx;s=advanceWorld(s,s.players.map(()=>({up:true})));assert(s.players[0].vx>0);assert(s.players[0].vx-held<15);
 s=drive(s,12,[{left:true}]);assert(s.players[0].vx<-75);assert(s.players[0].x<x);
 s=clear(newWorld('pocket-racers',1));s=drive(s,32);assert.equal(s.players[0].speed,560);
 s.players[0].boost=100;s=drive(s,12,[{attack:true}]);assert.equal(s.players[0].speed,800);
});

test('drift carries momentum and fuel cans fill nitro once before disappearing',()=>{
 let s=clear(newWorld('pocket-racers',1));s.players[0].speed=560;
 // Alternate controlled slides across the road to avoid grinding a rail.
 for(let i=0;i<23;i++)s=advanceWorld(s,[{up:true,block:true,right:i<12,left:i>=12}]);
 assert(s.players[0].driftCharge>=.65);s=advanceWorld(s,s.players.map(()=>({up:true})));assert(s.players[0].driftBoost>1);assert.equal(s.players[0].driftBursts,1);
 s=clear(newWorld('pocket-racers',1));s.boostPads=[{id:900,chunk:0,x:480,distance:5}];s.players[0].boost=20;
 s=advanceWorld(s,s.players.map(()=>({up:true})));assert.equal(s.players[0].nitroPickups,1);assert.equal(s.players[0].boost,55);assert(!s.players[0].boosting);assert.equal(s.players[0].usedPads.length,1);
 const boost=s.players[0].boost;s=advanceWorld(s,s.players.map(()=>({up:true})));assert(s.players[0].boost<boost+1);assert.equal(s.players[0].nitroPickups,1);
});

test('near misses do not refill nitro; collisions reduce speed without teleporting the car',()=>{
 let s=clear(newWorld('pocket-racers',1));Object.assign(s.players[0],{x:520,speed:800,boost:30});s.traffic=[{id:999,chunk:0,x:480,distance:0,speed:0,kind:'car'}];
 s=advanceWorld(s,[{up:true,attack:true}]);assert.equal(s.players[0].nearMisses,1);assert.equal(s.players[0].boost,28.8);assert.equal(s.players[0].crashes,0);
 s=advanceWorld(s,s.players.map(()=>({up:true})));assert.equal(s.players[0].nearMisses,1);
 s=clear(newWorld('pocket-racers',1));Object.assign(s.players[0],{x:480,speed:800,boost:30});s.traffic=[{id:999,chunk:0,x:480,distance:20,speed:0,kind:'car'}];
 s=advanceWorld(s,[{up:true,attack:true}]);assert.equal(s.players[0].crashes,1);assert(s.players[0].speed>=190&&s.players[0].speed<500);assert.equal(s.players[0].y,40);
 s=advanceWorld(s,s.players.map(()=>({up:true})));assert.equal(s.players[0].crashes,1);
});

test('ten-minute sessions remain bounded, generate all environments, and keep rewards beyond the former course',()=>{
 let s=newWorld('pocket-racers',4);s.timeLimit=600;const seen=new Set();
 for(let i=0;i<12000;i++){
  s=advanceWorld(s,s.players.map((_,seat)=>worldBot(s,seat)));seen.add(raceBiome(s.players[0].y/10).id);
  assert(s.traffic.length<=48);assert(s.pickups.length<=128);assert(s.boostPads.length<=16);assert(s.players.every(p=>p.collected.length<=128&&p.usedPads.length<=16));
  if(i<11999)assert(!s.finished);
 }
 assert(s.finished);assert.equal(s.elapsed,600);assert(s.players[0].y>200000);assert.equal(seen.size,4);assert(s.pickups.some(p=>p.distance>9000));
 const leaders=s.players.map((p,i)=>({i,y:p.y})).filter(p=>p.y===Math.max(...s.players.map(p=>p.y))).map(p=>p.i);assert.deepEqual(s.winners,leaders);
 const spread=newWorld('pocket-racers',4);spread.players.forEach((p,i)=>p.y=i*100000);extendRaceCourse(spread);assert(spread.traffic.length<=48);assert(spread.pickups.length<=128);
});

test('room duration is validated, shown to everyone, locked at start and includes only racing time',async ()=>{
 const store=(await openStore(':memory:'));try{
  const rooms=(await createArcadeRooms(store)),a=(await store.ensureUser('race-a','A','practice')),b=(await store.ensureUser('race-b','B','practice'));
  for(const value of [0,59,Infinity,'bad',601])(await assert.rejects(async ()=>(await rooms.create({game_id:'pocket-racers',entry:'0',race_seconds:value},a,1000)),/duration/));
  let r=(await rooms.create({game_id:'pocket-racers',entry:'0',race_seconds:'60'},a,1000));assert.equal(r.race_seconds,60);
  (await rooms.action(r.id,b,{type:'join'},null,1001));for(const u of [a,b])(await rooms.action(r.id,u,{type:'ready',ready:true},null,1002));
  r=(await rooms.start(r.id,a,null,1003));assert.equal(r.state.timeLimit,60);assert.equal(r.ends_at-r.starts_at,60000);assert.equal((await rooms.get(r.id,b)).race_seconds,60);
  (await rooms.tick(r.starts_at));assert.equal((await rooms.get(r.id,a)).state.elapsed,0);
  for(let t=r.starts_at+50;t<=r.ends_at;t+=50)(await rooms.tick(t));
  const result=(await rooms.get(r.id,a));assert.equal(result.status,'finished');assert.equal(result.state.elapsed,60);assert(result.winners.length>0);
 }finally{(await store.db.close());}
});


test('an empty nitro tank stays empty until fuel is supplied and cannot pulse every other tick',()=>{
 let s=clear(newWorld('pocket-racers',1));s.players[0].boost=.5;s.players[0].speed=560;
 s=advanceWorld(s,[{up:true,attack:true}]);assert(s.players[0].boostLocked);assert.equal(s.players[0].boost,0);
 for(let i=0;i<20;i++){s=advanceWorld(s,[{up:true,attack:true}]);assert(!s.players[0].boosting);assert.equal(s.players[0].boost,0);}
 s.players[0].boost=20;s=advanceWorld(s,[{up:true,attack:true}]);assert(s.players[0].boosting);assert(!s.players[0].boostLocked);
});


test('moving traffic survives retirement of its spawn chunk and keeps its identity',()=>{
 const s=newWorld('pocket-racers',1);s.elapsed=60;s.players[0].y=10000;
 s.traffic=[{id:0,chunk:0,x:480,distance:2000,speed:140,model:'sedan'}];
 extendRaceCourse(s);assert(!s.raceChunks.includes(0));assert(s.traffic.some(v=>v.id===0));
 const car=s.traffic.find(v=>v.id===0);assert.equal(car.distance+car.speed*s.elapsed,10400);
 s.players[0].y=10300;extendRaceCourse(s);assert.equal(s.traffic.filter(v=>v.id===0).length,1);
 s.players[0].y=12000;extendRaceCourse(s);assert(!s.traffic.some(v=>v.id===0));
});

test('pulse shots catch a moving rival, award a hit and leave both cars racing',()=>{
 let s=clear(newWorld('pocket-racers',2));s.raceSeed=0;
 s.players.forEach((p,i)=>Object.assign(p,{x:480,y:i*500,speed:560,boost:30}));
 s=advanceWorld(s,[{up:true,fire:true}]);assert.equal(s.players[0].shotsFired,1);assert.equal(s.players[0].ammo,2);assert.equal(s.shots.length,1);
 const old=structuredClone(s);s=drive(s,12);
 assert.equal(s.players[0].hits,1);assert.equal(s.players[1].hitTimer>0,true);assert(s.players[1].shield>0);assert(s.players[1].speed<560);
 assert(s.players.every((p,i)=>p.y>old.players[i].y));assert.equal(s.players.length,2);assert(!s.finished);assert.equal(s.players[0].crashes,0);
 assert.equal(old.players[0].hits,0,'the previous snapshot remains immutable');
});

test('blaster cooldown, ammo and recharge bound sustained fire and projectiles expire',()=>{
 let s=clear(newWorld('pocket-racers',1));s.raceSeed=0;
 s=drive(s,60,[{fire:true}]);assert.equal(s.players[0].shotsFired,3);assert.equal(s.players[0].ammo,0);
 s=drive(s,12,[{fire:true}]);assert.equal(s.players[0].shotsFired,4);assert.equal(s.players[0].ammo,0);
 s=drive(s,90);assert.equal(s.shots.length,0);assert(s.players[0].ammo>0);assert.equal(s.players[0].hits,0);
});

test('a rival can dodge a pulse and hit protection prevents repeated slowing',()=>{
 let s=clear(newWorld('pocket-racers',2));s.raceSeed=0;s.players.forEach((p,i)=>Object.assign(p,{x:480,y:i*450,speed:560}));
 s=advanceWorld(s,[{up:true,fire:true}]);s.players[1].x=600;s=drive(s,30);assert.equal(s.players[0].hits,0);
 Object.assign(s.players[1],{x:480,shield:1,speed:400});s.shots=[{id:99,owner:0,x:480,y:s.players[1].y-40,vx:0,speed:1800,life:1}];
 s=advanceWorld(s,s.players.map(()=>({up:true})));assert.equal(s.shots.length,0);assert.equal(s.players[0].hits,0);assert(s.players[1].speed>=400);
});

test('high-speed contact crashes a rival once, without elimination or a position reset',()=>{
 let s=clear(newWorld('pocket-racers',2));s.raceSeed=0;
 Object.assign(s.players[0],{x:480,y:0,speed:800});Object.assign(s.players[1],{x:480,y:85,speed:260});
 s=drive(s,3,[{attack:true}]);assert.equal(s.players[1].crashes,1);assert.equal(s.players[0].takedowns,1);assert(s.players[1].crashTimer>0);assert(s.players[1].invulnerable>0);
 const y=s.players[1].y;s=drive(s,10);assert.equal(s.players[1].crashes,1);assert(s.players[1].y>y);assert(!s.finished);
});

test('rivers remain below bridge decks, with clear banks and dry racing lanes in every biome',()=>{
 const bridges=raceBridgeSections(0,2600);assert.equal(bridges.length,4);
 for(const bridge of bridges){
  for(let d=bridge.start+3;d<bridge.end-3;d+=4){
   assert(roadHeight(d)-bridge.waterLevel>8,'deck must be well above the river');assert(raceTerrainHeight(d,-20)<bridge.waterLevel);assert.equal(raceWaterAt(d),null);assert.equal(raceSceneryAllowed(d),false);
  }
  assert(raceSceneryAllowed(bridge.start-65,12));assert(raceSceneryAllowed(bridge.end+65,12));
  let s=clear(newWorld('pocket-racers',1));s.raceSeed=0;Object.assign(s.players[0],{y:(bridge.start-5)*10,elevation:roadHeight(bridge.start-5),speed:560});extendRaceCourse(s);clear(s);
  for(let j=0;j<45;j++){s=advanceWorld(s,s.players.map(()=>({up:true})));assert(!s.players[0].water);assert.equal(s.players[0].splashes,0);}
 }
});

test('rain rolls in and clears reproducibly, with gentle grip and speed effects',()=>{
 assert.equal(raceWeather(0,0).rain,0);assert.equal(raceWeather(30,0).rain,1);assert.equal(raceWeather(70,0).rain,0);assert(raceWeather(56,0).wet>0);assert.equal(raceWeather(70,0).wet,0);
 assert.deepEqual(raceWeather(34,123),raceWeather(34,123));assert.notDeepEqual(raceWeather(15,18),raceWeather(15,0));
 let s=clear(newWorld('pocket-racers',1));s.raceSeed=0;s.elapsed=30;s.players[0].speed=560;s=advanceWorld(s,[{up:true,right:true}]);assert(s.players[0].speed<560&&s.players[0].speed>530);assert(s.players[0].vx>0&&s.players[0].vx<15);
});

test('a quick fire press/release between server ticks is preserved',async ()=>{
 const store=(await openStore(':memory:'));try{
  const rooms=(await createArcadeRooms(store)),a=(await store.ensureUser('pulse-a','A','practice')),b=(await store.ensureUser('pulse-b','B','practice'));
  let r=(await rooms.create({game_id:'pocket-racers',entry:'0',race_seconds:60},a,1000));(await rooms.action(r.id,b,{type:'join'},null,1001));
  for(const u of [a,b])(await rooms.action(r.id,u,{type:'ready',ready:true},null,1002));
  r=(await rooms.start(r.id,a,null,1003));(await rooms.tick(r.starts_at));
  (await rooms.input(r.id,a,{seq:1,controls:{fire:true}},null,r.starts_at+10));(await rooms.input(r.id,a,{seq:2,controls:{fire:false}},null,r.starts_at+20));
  (await rooms.tick(r.starts_at+50));const next=(await rooms.get(r.id,a)).state;assert.equal(next.players[0].shotsFired,1);assert.equal(next.players[0].ammo,2);
 }finally{(await store.db.close());}
});


test('hill profiles climb substantially, have matching grades and remain continuous at zone boundaries',()=>{
 const heights=[];
 for(let zone=0;zone<8;zone++){
  let low=Infinity,high=-Infinity;
  for(let d=zone*650+.1;d<(zone+1)*650;d+=3){const h=roadHeight(d);low=Math.min(low,h);high=Math.max(high,h);const derivative=(roadHeight(d+.001)-roadHeight(d-.001))/.002;assert(Math.abs(derivative-roadGrade(d))<.0001);assert(Math.abs(roadGrade(d))<.25);}
  heights.push(high-low);const edge=(zone+1)*650;assert(Math.abs(roadHeight(edge-.001)-roadHeight(edge+.001))<.001);
 }
 assert(heights[0]>10);assert(heights[2]>30);
});

test('ramps launch aligned cars into bounded airtime and land without losing distance, with one clean landing',()=>{
 let s=clear(newWorld('pocket-racers',1));s.raceSeed=0;s.timeLimit=180;
 Object.assign(s.players[0],{x:390,y:1390,elevation:roadHeight(139),speed:800,boost:30});extendRaceCourse(s);clear(s);
 let peak=0,lastY=s.players[0].y,airborne=false,landed=false;
 for(let i=0;i<65;i++){
  s=advanceWorld(s,[{up:true,attack:true}]);const p=s.players[0];assert(p.y>lastY);lastY=p.y;assert(p.height>=0&&p.height<16);peak=Math.max(peak,p.height);airborne ||=p.airborne;
  if(p.landings){assert.equal(p.landings,1);assert.equal(p.landingReward,0);assert(p.boost<=30);assert(p.bestAirTime>.6);landed=true;break;}
 }
 assert(airborne&&landed);assert(peak>4);assert.equal(s.players[0].jumps,1);assert(s.players[0].airBoost>0);assert.equal(s.players[0].height,0);
 s=drive(s,6);assert.equal(s.players[0].landings,1);
 let bypass=clear(newWorld('pocket-racers',1));bypass.players[0].y=1390;bypass.players[0].elevation=roadHeight(139);bypass.players[0].speed=560;extendRaceCourse(bypass);clear(bypass);bypass=drive(bypass,20);assert.equal(bypass.players[0].jumps,0);assert.equal(bypass.players[0].height,0);
});

test('airborne cars clear traffic and rivals, and ground-level shots do not hit them',()=>{
 let s=clear(newWorld('pocket-racers',2));s.raceSeed=0;
 Object.assign(s.players[0],{x:480,y:800,speed:800,airborne:true,height:6,elevation:roadHeight(80)+6,verticalSpeed:0,airTime:.4});
 Object.assign(s.players[1],{x:480,y:830,speed:260,elevation:roadHeight(83)});
 s.traffic=[{id:999,chunk:0,x:480,distance:790,speed:0,kind:'car'}];s.shots=[{id:100,owner:1,x:480,y:760,speed:1800,vx:0,height:0,life:1}];
 s=advanceWorld(s,[{up:true,attack:true}]);assert(s.players[0].height>5);assert.equal(s.players[0].crashes,0);assert.equal(s.players[1].crashes,0);assert.equal(s.players[1].hits,0);assert.equal(s.players[0].hitTimer,0);
});

test('traffic leaves ramp takeoff lanes open and returns smoothly after the ramp',()=>{
 const ramp=raceRampSections(100,200)[0],car={x:480+ramp.x*10};
 assert.equal(raceTrafficX(car,ramp.start-70),car.x);assert(Math.abs(raceTrafficX(car,ramp.start)-480)<1);assert(Math.abs(raceTrafficX(car,ramp.end)-480)<1);assert.equal(raceTrafficX(car,ramp.end+40),car.x);
 let previous=raceTrafficX(car,ramp.start-70);
 for(let d=ramp.start-69;d<ramp.end+40;d++){const x=raceTrafficX(car,d);assert(Math.abs(x-previous)<5);previous=x;}
 assert.equal(raceRampHeight(ramp.start,ramp.x),0);assert.equal(raceRampHeight(ramp.end,ramp.x),ramp.height);assert.equal(raceRampHeight(ramp.end,0),0);
});

test('the clock can end a race in midair, with distance still deciding the winner',()=>{
 let s=clear(newWorld('pocket-racers',2));s.elapsed=59.95;s.timeLimit=60;
 Object.assign(s.players[0],{y:1800,elevation:roadHeight(180)+5,height:5,verticalSpeed:2,airborne:true,speed:800});s.players[1].y=1750;s.players[1].speed=560;
 s=advanceWorld(s,s.players.map(()=>({up:true})));assert(s.finished);assert(s.players[0].airborne);assert.deepEqual(s.winners,[0]);assert.equal(s.elapsed,60);
});


test('leaving a ramp sideways preserves height and a landing does not refill nitro',()=>{
 let s=clear(newWorld('pocket-racers',1));s.raceSeed=0;
 Object.assign(s.players[0],{x:428,y:1540,speed:800,vx:132,steer:1,height:2.8,elevation:roadHeight(154)+2.8});extendRaceCourse(s);clear(s);
 s=advanceWorld(s,[{up:true,right:true}]);assert(s.players[0].airborne);assert(s.players[0].height>2.5);assert.equal(s.players[0].jumps,1);
 s=drive(s,60);assert.equal(s.players[0].landings,1);assert.equal(s.players[0].height,0);
 Object.assign(s.players[0],{airBoost:.85,boost:25});s=advanceWorld(s,[{up:true}]);assert(!s.players[0].boosting);assert.equal(s.players[0].boost,25);
});
