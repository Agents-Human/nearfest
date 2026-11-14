import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorld,advanceWorld,worldBot} from '../server/arcade/world.mjs';
import {createArcadeRooms} from '../server/arcade/rooms.mjs';
import {openStore} from './helpers/store.mjs';
import {worldControlKey} from '../src/games/world-controls.mjs';

const ticks=(s,n,input=[])=>{for(let i=0;i<n;i++)s=advanceWorld(s,input);return s;};
const empty=()=>{const s=newWorld('pocket-racers',1);s.raceSeed=0;s.traffic=[];s.pickups=[];s.boostPads=[];return s;};

test('W and arrows drive, N is independent nitro, and other games keep their action keys',()=>{
 for(const code of ['KeyW','ArrowUp'])assert.equal(worldControlKey(code,'pocket-racers'),'up');
 assert.equal(worldControlKey('KeyN','pocket-racers'),'attack');
 assert.equal(worldControlKey('KeyS','pocket-racers'),'down');
 assert.equal(worldControlKey('ArrowDown','pocket-racers'),'down');
 assert.equal(worldControlKey('Space','pocket-racers'),undefined);
 assert.equal(worldControlKey('Space','platform-relay'),'attack');
 assert.equal(worldControlKey('KeyN','platform-relay'),undefined);
});

test('a race waits for throttle: idle, steering, nitro and firing cannot start the car',()=>{
 for(const input of [{},{left:true},{right:true},{attack:true},{down:true},{fire:true},{block:true,right:true}]){
  let s=empty();s.players[0].x=input.left?350:input.right?610:480;const {x,y}=s.players[0];
  s=ticks(s,80,[input]);assert.equal(s.players[0].speed,0);assert.equal(s.players[0].vx,0);assert.equal(s.players[0].x,x);assert.equal(s.players[0].y,y);assert.equal(s.players[0].boosting,false);
 }
});

test('throttle accelerates without spending nitro; N boosts only together with throttle',()=>{
 let s=empty();s.players[0].boost=70;s=ticks(s,32,[{up:true}]);assert.equal(s.players[0].speed,560);assert(s.players[0].y>0);assert(s.players[0].boost>=70);assert(!s.players[0].boosting);
 const boost=s.players[0].boost;s=ticks(s,12,[{up:true,attack:true}]);assert.equal(s.players[0].speed,800);assert(s.players[0].boost<boost);assert(s.players[0].boosting);
 s=advanceWorld(s,[{attack:true}]);assert(s.players[0].speed<800);assert(!s.players[0].boosting);
});

test('release slows to a full stop, brake overrides throttle and nitro, and W restarts normally',()=>{
 const moving=ticks(empty(),32,[{up:true}]);let coast=ticks(moving,40);assert.equal(coast.players[0].speed,0);
 const parked=coast.players[0].y;coast=ticks(coast,60);assert.equal(coast.players[0].y,parked);
 let braking=ticks(moving,12,[{up:true,attack:true,down:true}]);assert.equal(braking.players[0].speed,0);assert(!braking.players[0].boosting);assert(braking.players[0].y<parked);
 const before=braking.players[0].y;braking=advanceWorld(braking,[{up:true}]);assert(braking.players[0].speed>0);assert(braking.players[0].y>before);
});

test('stored boosts, turbo pads, traffic hits and pulse hits never give a stopped car forward speed',()=>{
 let s=empty();Object.assign(s.players[0],{padBoost:1.3,driftBoost:1,airBoost:.85});s.boostPads=[{id:777,chunk:0,x:480,distance:0}];s=ticks(s,40);assert.equal(s.players[0].y,0);assert.equal(s.players[0].speed,0);assert(!s.players[0].boosting);assert.equal(s.players[0].usedPads.length,0);
 s=empty();s.traffic=[{id:778,chunk:0,x:480,distance:20,speed:0}];s=ticks(s,10);assert(s.players[0].crashes>0);assert.equal(s.players[0].speed,0);assert.equal(s.players[0].y,0);
 s=newWorld('pocket-racers',2);s.traffic=[];s.pickups=[];s.boostPads=[];Object.assign(s.players[0],{x:480,y:0});Object.assign(s.players[1],{x:570,y:-200});s.shots=[{id:1,owner:1,x:480,y:-60,vx:0,speed:1800,life:1,height:0}];s=advanceWorld(s,[]);assert(s.players[0].hitTimer>0);assert.equal(s.players[0].speed,0);assert.equal(s.players[0].y,0);
});

test('bots explicitly press throttle while a human without input remains parked',()=>{
 let s=newWorld('pocket-racers',2);const before=s.players[0].y;
 for(let i=0;i<60;i++){const bot=worldBot(s,1);assert(bot.up);s=advanceWorld(s,[{},bot]);}
 assert.equal(s.players[0].y,before);assert.equal(s.players[0].speed,0);assert(s.players[1].y>500);
});

test('authoritative rooms wait for input and stop accelerating when held input expires',async ()=>{
 const store=(await openStore(':memory:'));try{
  const rooms=(await createArcadeRooms(store)),a=(await store.ensureUser('driver-a','A','practice')),b=(await store.ensureUser('driver-b','B','practice'));
  let room=(await rooms.create({game_id:'pocket-racers',entry:'0',race_seconds:60},a,1000));(await rooms.action(room.id,b,{type:'join'},null,1001));
  for(const user of [a,b])(await rooms.action(room.id,user,{type:'ready',ready:true},null,1002));
  room=(await rooms.start(room.id,a,null,1003));const start=room.starts_at;
  for(let t=start;t<=start+500;t+=50)(await rooms.tick(t));
  assert((await rooms.get(room.id,a)).state.players.every(p=>p.speed===0&&p.y===0));
  (await rooms.input(room.id,a,{seq:1,controls:{up:true}},null,start+510));
  for(let t=start+550;t<=start+1000;t+=50)(await rooms.tick(t));
  assert((await rooms.get(room.id,a)).state.players[0].speed>0);
  for(let t=start+1050;t<=start+3000;t+=50)(await rooms.tick(t));
  const stopped=(await rooms.get(room.id,a)).state.players[0];assert.equal(stopped.speed,0);const distance=stopped.y;
  for(let t=start+3050;t<=start+3500;t+=50)(await rooms.tick(t));
  assert.equal((await rooms.get(room.id,a)).state.players[0].y,distance);
 }finally{(await store.db.close());}
});

test('nitro starts empty, comes only from driving through a fuel can, and stays empty after use',()=>{
 let s=empty();assert.equal(s.players[0].boost,0);
 s.boostPads=[{id:901,chunk:0,x:480,distance:40,amount:35,kind:'nitro'}];
 s=ticks(s,30,[{attack:true}]);assert.equal(s.players[0].boost,0);assert.equal(s.players[0].y,0);
 s=ticks(s,10,[{up:true}]);assert.equal(s.players[0].boost,35);assert.equal(s.players[0].nitroPickups,1);assert(!s.players[0].boosting);
 s=ticks(s,40,[{up:true}]);assert.equal(s.players[0].boost,35);assert.equal(s.players[0].nitroPickups,1);
 s=ticks(s,50,[{up:true,attack:true}]);assert.equal(s.players[0].boost,0);assert(!s.players[0].boosting);
 s=ticks(s,80);assert.equal(s.players[0].boost,0);assert.equal(s.players[0].speed,0);
 s.boostPads=[{id:902,chunk:Math.floor(s.players[0].y/1800),x:s.players[0].x,distance:s.players[0].y+10,amount:35,kind:'nitro'}];
 s=advanceWorld(s,[{up:true}]);assert.equal(s.players[0].boost,35);assert(!s.players[0].boostLocked);
 s=advanceWorld(s,[{up:true,attack:true}]);assert.equal(s.players[0].boost,33.8);assert(s.players[0].boosting);
});

test('fuel is capped at 100 and a collected can disappears for every racer',()=>{
 let s=newWorld('pocket-racers',2);s.traffic=[];s.pickups=[];s.boostPads=[{id:903,chunk:0,x:480,distance:20,amount:35,kind:'nitro'}];
 s.players.forEach(p=>p.x=480);s.players[0].boost=90;
 s=advanceWorld(s,[{up:true},{}]);assert.equal(s.players[0].boost,100);assert.equal(s.players[0].nitroPickupAmount,10);assert.equal(s.players[1].boost,0);
 assert.equal(s.boostPads.length,0);
 s=advanceWorld(s,[{}, {up:true}]);assert.equal(s.players[1].boost,0);assert.equal(s.players[1].nitroPickups||0,0);assert.equal(s.players[0].boost,100);
});

test('the first crossing racer wins a shared can, regardless of player-array order',()=>{
 for(const reversed of [false,true]){
  let s=newWorld('pocket-racers',2);s.traffic=[];s.pickups=[];s.boostPads=[{id:904,chunk:0,x:480,distance:60,amount:35}];
  Object.assign(s.players[0],{x:455,y:0,speed:800});Object.assign(s.players[1],{x:505,y:15,speed:800});
  if(reversed)s.players.reverse();
  s=advanceWorld(s,[{up:true},{up:true}]);const winner=reversed?0:1;
  assert.equal(s.players[winner].boost,35);assert.equal(s.players[1-winner].boost,0);assert.equal(s.boostPads.length,0);
 }
});

test('road traffic leaves nitro available and an AI racer can collect and spend it',()=>{
 let s=newWorld('pocket-racers',2);s.pickups=[];s.boostPads=[{id:905,chunk:0,x:480,distance:120,amount:35}];
 s.players[0].x=390;Object.assign(s.players[1],{x:480,y:-200});
 s.traffic=[{id:906,chunk:0,x:480,distance:100,speed:150,kind:'car'}];
 s=ticks(s,20);assert.equal(s.boostPads.length,1);assert(s.players.every(p=>p.boost===0));
 s.traffic=[];let collected=false,boosted=false;
 for(let i=0;i<85;i++){
  s=advanceWorld(s,[{},worldBot(s,1)]);
  if(s.players[1].nitroPickups){collected=true;assert(!s.boostPads.some(can=>can.id===905));}
  boosted ||= s.players[1].boosting;
 }
 assert(collected);assert(boosted);assert.equal(s.players[1].nitroPickups,1);assert.equal(s.players[1].boost,0);assert.equal(s.players[0].boost,0);
});

test('AI racers steer toward available fuel; full tanks and airborne cars leave it for others',()=>{
 let s=newWorld('pocket-racers',2);s.traffic=[];s.pickups=[];s.boostPads=[{id:907,chunk:0,x:570,distance:350,amount:35}];
 Object.assign(s.players[1],{x:480,y:0,speed:560});assert(worldBot(s,1).right);
 s.boostPads=[{id:908,chunk:0,x:480,distance:20,amount:35}];
 Object.assign(s.players[0],{x:480,boost:100});Object.assign(s.players[1],{x:480,y:0,speed:560,airborne:true,height:5,elevation:5,verticalSpeed:2});
 s=advanceWorld(s,[{up:true},{up:true}]);assert.equal(s.boostPads.length,1);assert.equal(s.players[1].boost,0);
});
