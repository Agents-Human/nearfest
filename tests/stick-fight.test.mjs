import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorld,advanceWorld,worldBot} from '../server/arcade/world.mjs';
import {createArcadeRooms} from '../server/arcade/rooms.mjs';
import {openStore} from '../server/store.mjs';
const step=(s,n,c=[])=>{for(let i=0;i<n;i++)s=advanceWorld(s,c);return s;};
const close=()=>{const s=newWorld('stick-rivals',2);s.weapons=[];s.players[0].x=435;s.players[1].x=495;return s;};

test('terrace fights stay on one floor; a held attack lands all four moves in one second',()=>{
 let s=close();assert.deepEqual(s.platforms,[]);assert.equal(newWorld('stick-rivals',2).weapons.length,0);
 const before=structuredClone(s),kinds=new Set();for(let i=0;i<21;i++){s=advanceWorld(s,[{attack:true},{}]);kinds.add(s.players[0].attackKind);}
 assert.deepEqual([...kinds],['punch','cross','frontkick','roundhouse']);assert.equal(s.players[0].hitCombo,4);assert.equal(s.players[1].hp,71);assert.equal(before.players[1].hp,100);assert(s.players[1].vx>0,'roundhouse drives the defender backwards');
 const whiff=step(newWorld('stick-rivals',2),20,[{attack:true},{}]);assert.equal(whiff.players[0].hitCombo,0);
});
test('a quick attack during recovery is buffered without requiring the button to stay held',()=>{
 let s=close();s=advanceWorld(s,[{attack:true},{}]);s=step(s,2);s=advanceWorld(s,[{attack:true},{}]);s=step(s,4);
 assert.equal(s.players[0].attackSeq,2);assert.equal(s.players[0].attackKind,'cross');assert.equal(s.players[1].hp,89);
});
test('releasing a held attack ends the chain; an idle player never attacks automatically',()=>{
 let s=step(newWorld('stick-rivals',2),4,[{attack:true},{}]);
 const sequence=s.players[0].attackSeq;
 s=step(s,20);
 assert.equal(s.players[0].attackSeq,sequence,'release must not queue one more move');
 for(let i=0;i<60;i++)s=advanceWorld(s,[{},worldBot(s,1)]);
 assert.equal(s.players[0].attackSeq,sequence,'the practice bot cannot drive the human fighter');
});
test('footwork stops on release and reverses on the next simulation step',()=>{
 let s=step(newWorld('stick-rivals',2),3,[{right:true},{}]);const x=s.players[0].x;
 s=advanceWorld(s,[{},{}]);assert.equal(s.players[0].x,x);assert.equal(s.players[0].vx,0);
 s=advanceWorld(s,[{left:true},{}]);assert(s.players[0].x<x);assert(s.players[0].vx<0);
});
test('guard and buffered jump can interrupt strike recovery, while contact remains committed',()=>{
 let s=newWorld('stick-rivals',2);s=advanceWorld(s,[{attack:true},{}]);
 s=advanceWorld(s,[{block:true},{}]);assert.equal(s.players[0].blocking,false,'startup cannot be cancelled');
 s=step(s,2,[{block:true},{}]);assert.equal(s.players[0].blocking,true);assert.equal(s.players[0].attack,0);
 s=step(s,12,[{block:true},{}]);assert.equal(s.players[0].attackSeq,1,'guard clears the attack buffer');
 s=advanceWorld(newWorld('stick-rivals',2),[{attack:true},{}]);
 s=advanceWorld(s,[{up:true},{}]);s=step(s,2);
 assert.equal(s.players[0].ground,false,'a quick jump during recovery cannot be lost');assert(s.players[0].vy<0);
});
test('guard becomes available on the step hit stun ends',()=>{
 let s=newWorld('stick-rivals',2);Object.assign(s.players[0],{stun:.05,hurtTimer:.2});
 s=advanceWorld(s,[{block:true},{}]);assert.equal(s.players[0].stun,0);assert.equal(s.players[0].blocking,true);
});
test('holding jump does not auto-flip or bunny-hop; a second press performs exactly one air flip',()=>{
 let s=newWorld('stick-rivals',2);s=step(s,30,[{up:true},{}]);assert.equal(s.players[0].y,410);assert.equal(s.players[0].airJumps,1);assert.equal(s.players[0].airFlip,0);
 s=newWorld('stick-rivals',2);s=advanceWorld(s,[{up:true},{}]);s=advanceWorld(s,[{},{}]);s=advanceWorld(s,[{up:true},{}]);assert.equal(s.players[0].airJumps,0);assert(s.players[0].airFlip>0);const vy=s.players[0].vy;s=advanceWorld(s,[{},{}]);s=advanceWorld(s,[{up:true},{}]);assert(s.players[0].vy>vy,'a third press cannot reset upward velocity');
});
test('parry prevents damage and opens a counter; normal guard chips and can break',()=>{
 let s=step(close(),2,[{attack:true},{block:true}]);assert.equal(s.players[1].hp,100);assert(s.players[0].stun>0);assert.equal(s.players[0].attack,0);assert(s.impacts.some(i=>i.kind==='parry'&&i.owner===1));
 const guard=close();guard.players[1].blocking=true;s=step(guard,2,[{attack:true},{block:true}]);assert.equal(s.players[1].hp,98);assert(s.impacts.some(i=>i.kind==='block'));assert(!s.impacts.some(i=>['hit','heavy'].includes(i.kind)));
 const tired=close();Object.assign(tired.players[1],{blocking:true,energy:6});s=step(tired,2,[{attack:true},{block:true}]);assert(s.players[1].guardBroken>0);assert.equal(s.players[1].blocking,false);assert(s.impacts.some(i=>i.kind==='break'));
});
test('dropkicks preserve forward momentum and successful hits locate their contact before knockback',()=>{
 let s=newWorld('stick-rivals',2);Object.assign(s.players[0],{x:410,y:320,ground:false,vy:0});s.players[1].x=485;
 s=advanceWorld(s,[{down:true},{}]);const x=s.players[0].x;s=advanceWorld(s,[{},{}]);assert(s.players[0].x>x+15,'dropkick does not lose its impulse on the next tick');s=step(s,6);assert(s.players[1].hp<100);
 s=step(close(),2,[{attack:true},{}]);const impact=s.impacts.find(i=>i.kind==='hit');assert(impact);assert.equal(impact.x,485);assert.equal(impact.owner,0);assert.equal(s.players[1].hurtKind,'punch');
});
test('round-break physics settles a defeated fighter onto the terrace before resetting',()=>{
 let s=close();s.players[1].hp=5;s=step(s,2,[{attack:true},{}]);assert(s.breakTime>0);s=step(s,18);assert.equal(s.players[1].hp,0);assert.equal(s.players[1].y,410);assert.equal(s.players[1].ground,true);s=step(s,24);assert.equal(s.round,1);assert.equal(s.players[1].hp,100);assert.equal(s.players[0].hitCombo,0);
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

test('unarmed duels clear equipment from older room snapshots',()=>{const s=close();Object.assign(s.players[0],{weapon:'sword',weaponTimer:10,weaponUses:6});const next=advanceWorld(s,[{},{}]);assert.equal(next.players[0].weapon,null);assert.equal(next.players[0].weaponUses,0);});
test('a well-timed defensive dash evades a strike, but spends spirit and has a cooldown',()=>{
 let s=close();s=step(s,2,[{attack:true},{left:true,block:true}]);assert.equal(s.players[1].hp,100);assert(s.players[1].dashCooldown>0);assert(s.players[1].energy<100);assert(s.impacts.some(i=>i.kind==='dodge'));
});

test('2D pose clips plant the support foot while the kicking knee chambers and extends',async()=>{
 const {sampleAttackPose,stickAttackKinds,idlePose,guardPose}=await import('../src/games/stick-poses.ts');
 const angle=p=>{const a=[p.hip[0]-p.leadKnee[0],p.hip[1]-p.leadKnee[1]],b=[p.leadFoot[0]-p.leadKnee[0],p.leadFoot[1]-p.leadKnee[1]];return Math.acos(Math.max(-1,Math.min(1,(a[0]*b[0]+a[1]*b[1])/(Math.hypot(...a)*Math.hypot(...b)))));};
 const chamber=sampleAttackPose('frontkick',.2),contact=sampleAttackPose('frontkick',.4);
 assert(angle(chamber)<Math.PI*.45,'the knee must fold before the kick');assert(angle(contact)>Math.PI*.85,'the striking leg extends at contact');assert(contact.leadFoot[0]>65);
 for(const kind of stickAttackKinds)for(let frame=0;frame<=30;frame++){
  const pose=sampleAttackPose(kind,frame/30);for(const joint of Object.values(pose))assert(joint.every(Number.isFinite),`${kind}: invalid joint at frame ${frame}`);
  if(['frontkick','roundhouse','kick','sweep'].includes(kind))assert.equal(pose.rearFoot[1],0,'the support foot cannot float during a grounded kick');
 }
 for(let frame=0;frame<90;frame++)for(const p of [idlePose(frame/30),guardPose(frame/30)]){assert.equal(p.rearFoot[1],0);assert.equal(p.leadFoot[1],0);assert(p.leadHand[1]<p.shoulder[1],'the lead hand stays up in guard');}
});
test('strikes have a visible startup and retreating preserves a guard facing the rival',()=>{
 let s=close();s=advanceWorld(s,[{attack:true},{}]);assert.equal(s.players[1].hp,100,'damage must wait for the extended contact pose');s=advanceWorld(s,[{},{}]);assert.equal(s.players[1].hp,95);
 s=advanceWorld(close(),[{left:true},{}]);assert.equal(s.players[0].facing,1);assert(s.players[0].vx<0);
 s=advanceWorld(close(),[{left:true,block:true},{}]);assert.equal(s.players[0].facing,1);s=advanceWorld(s,[{left:true,block:true},{}]);assert(s.players[0].vx<0,'a backward defensive dash must not reverse towards the rival');
});

test('close-range 2D contact bends the striking joint without putting a fist through the defender',async()=>{
 const {sampleAttackPose,fitAttackReach}=await import('../src/games/stick-poses.ts');
 for(const kind of ['punch','cross','frontkick','roundhouse'])for(const distance of [54,65,85]){
  const original=sampleAttackPose(kind,.4),p=fitAttackReach(original,kind,distance),end=kind==='cross'?p.rearHand:kind==='punch'?p.leadHand:p.leadFoot;
  assert(end[0]<=distance-12+1e-8);assert.deepEqual(p.rearFoot,original.rearFoot,'contact adaptation cannot move the planted foot');assert.notStrictEqual(p,original);
 }
});
test('hit reactions, throws and knockouts never rotate the fighter; only a deliberate jump flip can',async()=>{
 const {jumpFlipAngle}=await import('../src/games/stick-poses.ts');
 for(const reaction of [{hurtTimer:.24},{stun:.3},{tumble:.6},{hp:0}])for(const remaining of [0,.08,.16,.24,.32]){
  assert.equal(jumpFlipAngle({hp:100,airFlip:.32,...reaction},remaining),0,'being struck must cancel even an active jump flip');
 }
 assert.equal(jumpFlipAngle({hp:100},.16),0,'ordinary jumping and falling cannot spin');
 assert.equal(jumpFlipAngle({hp:100,airFlip:.16},.16),-Math.PI);
 assert.equal(jumpFlipAngle({hp:100,airFlip:0},0),0,'the intentional flip ends upright');
});
