import Matter from 'matter-js';
const {Engine,World,Bodies,Body}=Matter;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const extraWorldIds=new Set(['marble-run','tank-arena']);
export const marbleGaps=[1600,3000,4500,6100,7600];
export const marbleCourseLength=9000;
export const tankWalls=[{x:280,y:120,w:80,h:130},{x:600,y:310,w:80,h:130},{x:440,y:225,w:80,h:110},{x:135,y:245,w:42,h:70},{x:783,y:245,w:42,h:70}];
const spawns=[[120,110],[840,450],[120,450],[840,110]];
const initialCrates=[
 {x:200,y:280,kind:'wood'},{x:760,y:280,kind:'wood'},{x:480,y:100,kind:'ammo'},{x:480,y:460,kind:'armor'},
 {x:370,y:150,kind:'repair'},{x:590,y:150,kind:'ammo'},{x:370,y:410,kind:'ammo'},{x:590,y:410,kind:'repair'},
 {x:200,y:180,kind:'wood'},{x:760,y:380,kind:'wood'}
];
const initialBarrels=[{x:370,y:280},{x:590,y:280},{x:280,y:385},{x:680,y:175}];
const powerupKinds=['spread','rapid','heavy','shield','boost'];

export function newExtraWorld(s,n){
 if(s.game==='marble-run'){
  s.courseLength=marbleCourseLength;s.gaps=marbleGaps;
  const bumperXs=[1100,2200,3600,5200,6900,8400,1380,2680,3950,4880,5680,6500,7250,8050,8680];
  s.bumpers=bumperXs.map((x,i)=>{const baseY=[0,-37,37][i%3];return {id:i,x,y:baseY,baseY,sweep:i>=6};});
  s.boostPads=[420,1450,2450,3320,4180,5020,5880,6720,7420,8220].map((x,id)=>({id,x,y:[0,-34,34,0,34,-34,0,-34,34,0][id]}));
  s.jumpPads=[780,1920,3220,4740,6340,7860].map((x,id)=>({id,x,y:[-34,34,0,-34,34,0][id]}));
  s.tunnels=[950,2750,4150,5750,7300];
  s.pickups=Array.from({length:64},(_,i)=>({id:i,x:520+i*130,y:[-37,0,37][Math.floor(i/3)%3],high:i%7===3})).filter(p=>!marbleGaps.some(g=>p.x>g-50&&p.x<g+200));
  s.players=Array.from({length:n},()=>({x:0,y:0,vx:0,vy:0,height:0,vz:0,ground:true,airHop:true,jumpHeld:false,coins:0,collected:[],lives:3,alive:true,respawn:0,checkpoint:0,finish:null,score:0,boost:0,padBoost:0,bumped:0,collisions:0,roll:0}));
 }else{
  s.walls=tankWalls.map(w=>({...w}));
  s.crates=initialCrates.map((p,id)=>({...p,id,hp:2,maxHp:2,respawn:0}));
  s.barrels=initialBarrels.map((p,id)=>({...p,id,hp:1,respawn:0}));
  s.powerups=[
   {id:0,x:480,y:165,kind:'spread',active:true,respawn:0},
   {id:1,x:480,y:395,kind:'rapid',active:true,respawn:0}
  ];
  s.nextPowerup=2;
  s.shots=[];s.nextShot=0;
  s.explosions=[];s.nextExplosion=0;
  s.players=Array.from({length:n},(_,i)=>({
   x:spawns[i][0],y:spawns[i][1],vx:0,vy:0,aim:i%2?Math.PI:0,heading:i%2?Math.PI:0,
   hp:3,maxHp:3,shield:0,score:0,cooldown:0,respawn:0,invulnerable:1.5,kos:0,
   weapon:null,weaponTimer:0,boostTimer:0,dashTimer:0,dashCooldown:0,recoil:0
  }));
 }
}
const inside=(x,y,w,r=0)=>x>w.x-r&&x<w.x+w.w+r&&y>w.y-r&&y<w.y+w.h+r;
function resolve(p,w,r){if(!inside(p.x,p.y,w,r))return;const options=[[Math.abs(p.x-w.x+r),w.x-r,p.y],[Math.abs(p.x-w.x-w.w-r),w.x+w.w+r,p.y],[Math.abs(p.y-w.y+r),p.x,w.y-r],[Math.abs(p.y-w.y-w.h-r),p.x,w.y+w.h+r]].sort((a,b)=>a[0]-b[0]);p.x=options[0][1];p.y=options[0][2];}
function angleLerp(cur,target,maxStep){
 let diff=((target-cur+Math.PI*3)%(Math.PI*2))-Math.PI;
 if(Math.abs(diff)<=maxStep)return target;
 return cur+Math.sign(diff)*maxStep;
}
function addExplosion(s,x,y,radius,kind='hit'){
 s.explosions.push({id:s.nextExplosion++,x,y,radius,kind,age:0});
 if(s.explosions.length>24)s.explosions.shift();
}
function damageTank(s,target,ownerIndex,amount=1){
 if(target.hp<=0||target.respawn>0||target.invulnerable>0)return false;
 if((target.shield||0)>0){
  target.shield=Math.max(0,target.shield-1);
  target.invulnerable=.22;
  addExplosion(s,target.x,target.y,26,'shield');
  return true;
 }
 target.hp=Math.max(0,target.hp-amount);
 target.invulnerable=.18;
 if(target.hp===0){
  target.respawn=1.7;target.kos++;target.weapon=null;target.weaponTimer=0;target.boostTimer=0;
  if(ownerIndex!==undefined&&ownerIndex!==null&&s.players[ownerIndex]&&s.players[ownerIndex]!==target){
   s.players[ownerIndex].score++;
  }
  addExplosion(s,target.x,target.y,55,'tank');
 }else{
  addExplosion(s,target.x,target.y,28,'hit');
 }
 return true;
}
function detonateBarrel(s,barrel,ownerIndex){
 if(barrel.hp<=0)return;
 barrel.hp=0;barrel.respawn=12;
 addExplosion(s,barrel.x,barrel.y,85,'barrel');
 for(const c of s.crates){
  if(c.hp>0&&Math.hypot(c.x-barrel.x,c.y-barrel.y)<88){
   c.hp=0;c.respawn=14;
   addExplosion(s,c.x,c.y,36,'crate');
   spawnCrateDrop(s,c);
  }
 }
 for(const other of s.barrels){
  if(other.id!==barrel.id&&other.hp>0&&Math.hypot(other.x-barrel.x,other.y-barrel.y)<90){
   detonateBarrel(s,other,ownerIndex);
  }
 }
 s.players.forEach((p,idx)=>{
  if(p.hp<=0||p.respawn>0)return;
  const dist=Math.hypot(p.x-barrel.x,p.y-barrel.y);
  if(dist<85){
   const ang=Math.atan2(p.y-barrel.y,p.x-barrel.x);
   p.vx+=Math.cos(ang)*220;p.vy+=Math.sin(ang)*220;
   damageTank(s,p,ownerIndex===idx?null:ownerIndex,1);
  }
 });
}
function spawnCrateDrop(s,crate){
 const kind=crate.kind==='ammo'?powerupKinds[(crate.id+s.nextPowerup)%3]:crate.kind==='armor'?'shield':crate.kind==='repair'?'repair':powerupKinds[(crate.id+s.nextPowerup)%powerupKinds.length];
 if(s.powerups.filter(p=>p.active).length<6){
  s.powerups.push({id:s.nextPowerup++,x:crate.x,y:crate.y,kind,active:true,respawn:0,dropped:true});
 }
}
function applyPowerup(p,kind){
 if(kind==='repair'){p.hp=Math.min(p.maxHp||3,p.hp+1);return;}
 if(kind==='shield'){p.shield=Math.min(2,(p.shield||0)+1);return;}
 if(kind==='boost'){p.boostTimer=8;return;}
 p.weapon=kind;p.weaponTimer=8.5;
}
function stepTankPhysics(s,obstacles,dt){
 const engine=Engine.create({gravity:{x:0,y:0}});
 const statics=obstacles.map(w=>Bodies.rectangle(w.x+w.w/2,w.y+w.h/2,w.w,w.h,{isStatic:true,restitution:.2,friction:0}));
 World.add(engine.world,statics);
 const bodies=new Map();
 s.players.forEach((p,i)=>{
  if(p.respawn>0||p.hp<=0)return;
  const b=Bodies.circle(p.x,p.y,18,{restitution:.35,friction:0,frictionAir:0,density:.002});
  Body.setVelocity(b,{x:p.vx*dt,y:p.vy*dt});
  bodies.set(i,b);
  World.add(engine.world,b);
 });
 Engine.update(engine,1000/60);
 bodies.forEach((b,i)=>{
  const p=s.players[i];
  p.x=clamp(b.position.x,35,925);
  p.y=clamp(b.position.y,35,525);
  for(const w of obstacles)resolve(p,w,18);
 });
}
export function advanceExtraWorld(s,cs,dt,finish,ranked){
 if(s.game==='marble-run'){
  for(const b of s.bumpers||[])if(b.sweep)b.y=clamp((b.baseY||0)+Math.sin(s.elapsed*2.1+b.id)*28,-42,42);
  s.players.forEach((p,i)=>{if(!p.alive||p.finish!==null)return;const c=cs[i]||{},jump=Boolean(c.up||c.attack),pressed=jump&&!p.jumpHeld;p.jumpHeld=jump;
   if(p.respawn>0){p.respawn=Math.max(0,p.respawn-dt);return;}
   const before=p.x;p.boost=Math.max(0,(p.boost||0)-dt);p.padBoost=Math.max(0,(p.padBoost||0)-dt);p.bumped=Math.max(0,(p.bumped||0)-dt);
   const desired=(p.padBoost||0)>0?285:p.boost>0?258:205;
   p.vx=p.vx<desired?Math.min(desired,p.vx+115*dt):Math.max(desired,p.vx-90*dt);
   const steer=Number(Boolean(c.right))-Number(Boolean(c.left));
   p.vy=(p.vy+steer*235*dt)*Math.exp(-3.6*dt);p.y+=p.vy*dt;
   p.roll=((p.roll||0)+steer*dt*4)*Math.exp(-5*dt);
   if(Math.abs(p.y)>57){p.y=clamp(p.y,-57,57);p.vy*=-.4;}
   const nearGap=s.gaps.find(g=>g>p.x&&g-p.x<42);
   if(p.ground&&(pressed||nearGap!==undefined)){
    p.vz=pressed&&nearGap!==undefined?355:320;
    if(pressed&&nearGap!==undefined)p.boost=Math.max(p.boost,1.1);
    p.ground=false;p.airHop=true;
   }else if(!p.ground&&pressed&&p.airHop){
    p.vz=Math.max(p.vz,250);p.airHop=false;p.vx=Math.min(285,p.vx+16);
   }
   p.x+=p.vx*dt;p.height+=p.vz*dt;if(!p.ground)p.vz-=900*dt;
   const overGap=s.gaps.some(g=>p.x>=g&&p.x<g+100);
   if(p.height<=0&&!overGap&&p.vz<=0){p.height=0;p.vz=0;p.ground=true;p.airHop=true;}
   if(overGap&&p.height<=0)p.ground=false;
   if(p.height< -100){p.lives--;p.alive=p.lives>0;p.x=p.checkpoint;p.y=0;p.height=0;p.vz=0;p.vx=0;p.ground=true;p.airHop=true;p.respawn=.8;}
   if(p.ground&&!overGap)p.checkpoint=Math.max(p.checkpoint,Math.floor(Math.max(0,p.x-200)/1000)*1000);
   for(const pad of s.boostPads||[])if(Math.abs(p.x-pad.x)<28&&Math.abs(p.y-pad.y)<22&&p.height<18){p.boost=Math.max(p.boost,1.8);p.padBoost=.65;p.vx=Math.min(285,Math.max(p.vx,248)+24);}
   for(const jp of s.jumpPads||[])if(p.ground&&Math.abs(p.x-jp.x)<24&&Math.abs(p.y-jp.y)<20){p.vz=380;p.ground=false;p.airHop=true;p.boost=Math.max(p.boost,1.25);}
   for(const item of s.pickups)if(!p.collected.includes(item.id)&&Math.hypot(p.x-item.x,p.y-item.y)<24&&p.height<(item.high?75:45)){p.coins++;p.collected.push(item.id);p.boost=Math.min(2.2,p.boost+.8);p.vx=Math.min(265,p.vx+28);}
   for(const b of s.bumpers||[])if(p.bumped===0&&Math.abs(p.x-b.x)<24&&Math.abs(p.y-b.y)<27&&p.height<25){p.vx=65;p.boost=0;p.padBoost=0;p.bumped=1.2;p.collisions=(p.collisions||0)+1;}
   p.score=Math.floor(p.x/10);if(p.x>=s.courseLength)p.finish=s.elapsed-dt+dt*(s.courseLength-before)/Math.max(.01,p.x-before);
  });
  if(s.players.some(p=>p.finish!==null))ranked(s,s.players.map(p=>p.finish??Infinity),'First marble across the sky wins!',true);
  else if(s.players.every(p=>!p.alive)||s.elapsed>=120)ranked(s,s.players.map(p=>p.x),'Furthest along the skyway wins.');
 }else{
  s.barrels=s.barrels||[];s.powerups=s.powerups||[];s.explosions=s.explosions||[];s.nextExplosion=s.nextExplosion||0;s.nextPowerup=s.nextPowerup||0;
  for(const ex of s.explosions)ex.age+=dt;
  s.explosions=s.explosions.filter(ex=>ex.age<.75);
  for(const c of s.crates)if(c.hp<=0&&(c.respawn||0)>0){c.respawn-=dt;if(c.respawn<=0)c.hp=c.maxHp||2;}
  for(const b of s.barrels)if(b.hp<=0&&(b.respawn||0)>0){b.respawn-=dt;if(b.respawn<=0)b.hp=1;}
  for(const pu of s.powerups)if(!pu.active&&!pu.dropped&&(pu.respawn||0)>0){pu.respawn-=dt;if(pu.respawn<=0){pu.active=true;pu.kind=powerupKinds[(pu.id+Math.floor(s.elapsed))%powerupKinds.length];}}
  s.powerups=s.powerups.filter(pu=>pu.active||!pu.dropped);

  const obstacles=[
   ...s.walls,
   ...s.crates.filter(c=>c.hp>0).map(c=>({x:c.x-18,y:c.y-18,w:36,h:36})),
   ...s.barrels.filter(b=>b.hp>0).map(b=>({x:b.x-14,y:b.y-14,w:28,h:28}))
  ];
  s.players.forEach((p,i)=>{
   p.cooldown=Math.max(0,p.cooldown-dt);p.invulnerable=Math.max(0,p.invulnerable-dt);
   p.recoil=Math.max(0,(p.recoil||0)-dt*4.5);
   p.dashTimer=Math.max(0,(p.dashTimer||0)-dt);p.dashCooldown=Math.max(0,(p.dashCooldown||0)-dt);
   p.boostTimer=Math.max(0,(p.boostTimer||0)-dt);
   if((p.weaponTimer||0)>0){p.weaponTimer=Math.max(0,p.weaponTimer-dt);if(p.weaponTimer===0)p.weapon=null;}
   if(p.respawn>0){
    p.respawn-=dt;
    if(p.respawn<=0)Object.assign(p,{x:spawns[i][0],y:spawns[i][1],vx:0,vy:0,hp:3,maxHp:3,shield:0,invulnerable:1.5,weapon:null,weaponTimer:0});
    return;
   }
   const c=cs[i]||{},dx=Number(Boolean(c.right))-Number(Boolean(c.left)),dy=Number(Boolean(c.down))-Number(Boolean(c.up)),len=Math.hypot(dx,dy)||1;
   if(c.block&&p.dashCooldown<=0&&(dx||dy)){p.dashTimer=.22;p.dashCooldown=2.4;}
   const topSpeed=162*((p.boostTimer||0)>0?1.35:1)*((p.dashTimer||0)>0?1.85:1);
   const targetVx=(dx/len)*topSpeed,targetVy=(dy/len)*topSpeed;
   const accel=(dx||dy)?14:11;
   p.vx+=(targetVx-(p.vx||0))*Math.min(1,dt*accel);
   p.vy+=(targetVy-(p.vy||0))*Math.min(1,dt*accel);
   if(dx||dy){
    const targetHeading=Math.atan2(dy,dx);
    p.heading=angleLerp(p.heading??targetHeading,targetHeading,dt*14);
   }
   for(const pu of s.powerups){
    if(pu.active&&Math.hypot(p.x-pu.x,p.y-pu.y)<28){
     pu.active=false;pu.respawn=10;
     applyPowerup(p,pu.kind);
    }
   }
  });
  stepTankPhysics(s,obstacles,dt);

  s.players.forEach((p,i)=>{
   if(p.respawn>0||p.hp<=0)return;
   const c=cs[i]||{};
   const visible=s.players.map((q,j)=>({...q,i:j,d:Math.hypot(q.x-p.x,q.y-p.y)})).filter(q=>q.i!==i&&q.hp>0&&q.respawn<=0&&!obstacles.some(w=>Array.from({length:18},(_,k)=>k/17).some(t=>inside(p.x+(q.x-p.x)*t,p.y+(q.y-p.y)*t,w)))).sort((a,b)=>a.d-b.d)[0];
   p.aim=visible?Math.atan2(visible.y-p.y,visible.x-p.x):p.heading;
   if(c.attack&&p.cooldown===0){
    const wep=p.weapon;
    p.cooldown=wep==='rapid'?.26:wep==='heavy'?.62:.55;
    p.recoil=1;
    p.vx-=Math.cos(p.aim)*28;p.vy-=Math.sin(p.aim)*28;
    const speed=wep==='heavy'?410:wep==='rapid'?380:330;
    const angles=wep==='spread'?[p.aim-.18,p.aim,p.aim+.18]:[p.aim];
    for(const ang of angles){
     s.shots.push({
      id:s.nextShot++,owner:i,
      x:p.x+Math.cos(ang)*29,y:p.y+Math.sin(ang)*29,
      vx:Math.cos(ang)*speed,vy:Math.sin(ang)*speed,
      life:wep==='heavy'?3.4:2.8,bounces:0,maxBounces:wep==='heavy'?3:1,
      heavy:wep==='heavy',kind:wep||'normal'
     });
    }
   }
  });
  for(const shot of s.shots){shot.life-=dt;const maxB=shot.maxBounces??1;for(let step=0;step<4&&shot.life>0;step++){
   const ox=shot.x,oy=shot.y;shot.x+=shot.vx*dt/4;shot.y+=shot.vy*dt/4;
   if(shot.x<20||shot.x>940||shot.y<20||shot.y>540){if(shot.bounces++>=maxB)shot.life=0;else{if(shot.x<20||shot.x>940)shot.vx*=-1;if(shot.y<20||shot.y>540)shot.vy*=-1;shot.x=clamp(shot.x,20,940);shot.y=clamp(shot.y,20,540);}}
   const barrel=s.barrels.find(b=>b.hp>0&&Math.hypot(shot.x-b.x,shot.y-b.y)<20);
   if(barrel){shot.life=0;detonateBarrel(s,barrel,shot.owner);break;}
   const crate=s.crates.find(c=>c.hp>0&&Math.abs(shot.x-c.x)<21&&Math.abs(shot.y-c.y)<21);
   if(crate){
    crate.hp=Math.max(0,crate.hp-(shot.heavy?2:1));
    shot.life=0;
    if(crate.hp===0){crate.respawn=14;addExplosion(s,crate.x,crate.y,34,'crate');spawnCrateDrop(s,crate);}
    else addExplosion(s,shot.x,shot.y,18,'spark');
    break;
   }
   const wall=s.walls.find(w=>inside(shot.x,shot.y,w,3));if(wall){if(shot.bounces++>=maxB){shot.life=0;addExplosion(s,shot.x,shot.y,16,'spark');}else{if(ox<=wall.x-3||ox>=wall.x+wall.w+3)shot.vx*=-1;else shot.vy*=-1;shot.x=ox;shot.y=oy;addExplosion(s,shot.x,shot.y,14,'spark');}}
   if(shot.life<=0)break;
   const target=s.players.find((p,j)=>j!==shot.owner&&p.hp>0&&p.respawn<=0&&p.invulnerable<=0&&Math.hypot(p.x-shot.x,p.y-shot.y)<22);
   if(target){damageTank(s,target,shot.owner,1);shot.life=0;break;}
  }}
  s.shots=s.shots.filter(p=>p.life>0);
  if(s.players.some(p=>p.score>=5)||s.elapsed>=120)ranked(s,s.players.map(p=>p.score),'Five knockouts wins. Most knockouts takes the arena.');
 }
 return s;
}
export function extraWorldBot(s,i,c){const p=s.players[i];if(s.game==='marble-run'){const coin=s.pickups.find(g=>g.x>p.x&&g.x<p.x+180&&!p.collected.includes(g.id));const obstacle=(s.bumpers||[]).find(b=>b.x>p.x&&b.x<p.x+155),target=obstacle&&Math.abs((coin?.y||0)-obstacle.y)<27?(obstacle.y>=0?-37:37):coin?.y||0;c.left=p.y>target+6;c.right=p.y<target-6;c.attack=Boolean(obstacle&&obstacle.x-p.x<45&&Math.abs(p.y-obstacle.y)<30);return c;}
 const q=s.players.filter((_,j)=>j!==i&&_.hp>0&&_.respawn<=0).sort((a,b)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(p.x-b.x,p.y-b.y))[0]||s.players.find((_,j)=>j!==i);if(!q)return c;
 const pu=(s.powerups||[]).filter(u=>u.active).sort((a,b)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(p.x-b.x,p.y-b.y))[0];
 const turn=Math.floor(s.elapsed/2+i)%4;
 const tx=pu&&Math.hypot(p.x-pu.x,p.y-pu.y)<190?pu.x:q.x+(turn%2?115:-115);
 const ty=pu&&Math.hypot(p.x-pu.x,p.y-pu.y)<190?pu.y:q.y+(turn<2?115:-115);
 c.left=p.x>tx+22;c.right=p.x<tx-22;c.up=p.y>ty+22;c.down=p.y<ty-22;c.attack=true;
 return c;
}
