const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const extraWorldIds=new Set(['marble-run','tank-arena']);
export const marbleGaps=[1600,3000,4500,6100,7600];
export const marbleCourseLength=9000;
export const tankWalls=[{x:280,y:120,w:80,h:130},{x:600,y:310,w:80,h:130},{x:440,y:225,w:80,h:110}];
const spawns=[[120,110],[840,450],[120,450],[840,110]];
export function newExtraWorld(s,n){
 if(s.game==='marble-run'){
  s.courseLength=marbleCourseLength;s.gaps=marbleGaps;s.bumpers=[1100,2200,3600,5200,6900,8400].map((x,i)=>({id:i,x,y:[0,-37,37][i%3]}));s.pickups=Array.from({length:48},(_,i)=>({id:i,x:650+i*160,y:[-37,0,37][Math.floor(i/4)%3]})).filter(p=>!marbleGaps.some(g=>p.x>g-50&&p.x<g+200));
  s.players=Array.from({length:n},()=>({x:0,y:0,vx:0,vy:0,height:0,vz:0,ground:true,jumpHeld:false,coins:0,collected:[],lives:3,alive:true,respawn:0,checkpoint:0,finish:null,score:0,boost:0,bumped:0,collisions:0}));
 }else{
  s.walls=tankWalls.map(w=>({...w}));s.crates=[{x:200,y:280},{x:760,y:280},{x:480,y:100},{x:480,y:460}].map((p,id)=>({...p,id,hp:2}));s.shots=[];s.nextShot=0;
  s.players=Array.from({length:n},(_,i)=>({x:spawns[i][0],y:spawns[i][1],vx:0,vy:0,aim:i%2?Math.PI:0,heading:i%2?Math.PI:0,hp:3,score:0,cooldown:0,respawn:0,invulnerable:1.5,kos:0}));
 }
}
const inside=(x,y,w,r=0)=>x>w.x-r&&x<w.x+w.w+r&&y>w.y-r&&y<w.y+w.h+r;
function resolve(p,w,r){if(!inside(p.x,p.y,w,r))return;const options=[[Math.abs(p.x-w.x+r),w.x-r,p.y],[Math.abs(p.x-w.x-w.w-r),w.x+w.w+r,p.y],[Math.abs(p.y-w.y+r),p.x,w.y-r],[Math.abs(p.y-w.y-w.h-r),p.x,w.y+w.h+r]].sort((a,b)=>a[0]-b[0]);p.x=options[0][1];p.y=options[0][2];}
export function advanceExtraWorld(s,cs,dt,finish,ranked){
 if(s.game==='marble-run'){
  s.players.forEach((p,i)=>{if(!p.alive||p.finish!==null)return;const c=cs[i],jump=c.up||c.attack,pressed=jump&&!p.jumpHeld;p.jumpHeld=jump;
   if(p.respawn>0){p.respawn=Math.max(0,p.respawn-dt);return;}
   const before=p.x;p.boost=Math.max(0,(p.boost||0)-dt);p.bumped=Math.max(0,(p.bumped||0)-dt);const desired=p.boost>0?255:205;p.vx=p.vx<desired?Math.min(desired,p.vx+105*dt):Math.max(desired,p.vx-90*dt);p.vy=(p.vy+(Number(c.right)-Number(c.left))*215*dt)*Math.exp(-3.5*dt);p.y+=p.vy*dt;
   if(Math.abs(p.y)>57){p.y=clamp(p.y,-57,57);p.vy*=-.4;}
   const nearGap=s.gaps.find(g=>g>p.x&&g-p.x<42);if(p.ground&&(pressed||nearGap!==undefined)){p.vz=315;p.ground=false;}
   p.x+=p.vx*dt;p.height+=p.vz*dt;if(!p.ground)p.vz-=900*dt;
   const overGap=s.gaps.some(g=>p.x>=g&&p.x<g+100);
   if(p.height<=0&&!overGap&&p.vz<=0){p.height=0;p.vz=0;p.ground=true;}
   if(overGap&&p.height<=0)p.ground=false;
   if(p.height< -100){p.lives--;p.alive=p.lives>0;p.x=p.checkpoint;p.y=0;p.height=0;p.vz=0;p.vx=0;p.ground=true;p.respawn=.8;}
   if(p.ground&&!overGap)p.checkpoint=Math.max(p.checkpoint,Math.floor(Math.max(0,p.x-200)/1000)*1000);
   for(const item of s.pickups)if(!p.collected.includes(item.id)&&Math.hypot(p.x-item.x,p.y-item.y)<23&&p.height<45){p.coins++;p.collected.push(item.id);p.boost=Math.min(2,p.boost+.8);p.vx=Math.min(255,p.vx+28);}
   for(const b of s.bumpers||[])if(p.bumped===0&&Math.abs(p.x-b.x)<24&&Math.abs(p.y-b.y)<27&&p.height<25){p.vx=65;p.boost=0;p.bumped=1.2;p.collisions=(p.collisions||0)+1;}
   p.score=Math.floor(p.x/10);if(p.x>=s.courseLength)p.finish=s.elapsed-dt+dt*(s.courseLength-before)/Math.max(.01,p.x-before);
  });
  if(s.players.some(p=>p.finish!==null))ranked(s,s.players.map(p=>p.finish??Infinity),'First marble across the sky wins!',true);
  else if(s.players.every(p=>!p.alive)||s.elapsed>=120)ranked(s,s.players.map(p=>p.x),'Furthest along the skyway wins.');
 }else{
  const walls=[...s.walls,...s.crates.filter(c=>c.hp>0).map(c=>({x:c.x-18,y:c.y-18,w:36,h:36}))];
  s.players.forEach((p,i)=>{p.cooldown=Math.max(0,p.cooldown-dt);p.invulnerable=Math.max(0,p.invulnerable-dt);if(p.respawn>0){p.respawn-=dt;if(p.respawn<=0)Object.assign(p,{x:spawns[i][0],y:spawns[i][1],hp:3,invulnerable:1.5});return;}
   const c=cs[i],dx=Number(c.right)-Number(c.left),dy=Number(c.down)-Number(c.up),len=Math.hypot(dx,dy)||1;p.vx=dx/len*155;p.vy=dy/len*155;if(dx||dy)p.heading=Math.atan2(dy,dx);p.x=clamp(p.x+p.vx*dt,35,925);p.y=clamp(p.y+p.vy*dt,35,525);for(const w of walls)resolve(p,w,18);
   // The turret assists aim at the nearest visible rival; movement stays independent.
   const visible=s.players.map((q,j)=>({...q,i:j,d:Math.hypot(q.x-p.x,q.y-p.y)})).filter(q=>q.i!==i&&q.hp>0&&q.respawn<=0&&!walls.some(w=>Array.from({length:18},(_,k)=>k/17).some(t=>inside(p.x+(q.x-p.x)*t,p.y+(q.y-p.y)*t,w)))).sort((a,b)=>a.d-b.d)[0];
   p.aim=visible?Math.atan2(visible.y-p.y,visible.x-p.x):p.heading;
   if(c.attack&&p.cooldown===0){p.cooldown=.55;s.shots.push({id:s.nextShot++,owner:i,x:p.x+Math.cos(p.aim)*29,y:p.y+Math.sin(p.aim)*29,vx:Math.cos(p.aim)*330,vy:Math.sin(p.aim)*330,life:2.8,bounces:0});}
  });
  for(const shot of s.shots){shot.life-=dt;for(let step=0;step<4&&shot.life>0;step++){
   const ox=shot.x,oy=shot.y;shot.x+=shot.vx*dt/4;shot.y+=shot.vy*dt/4;
   if(shot.x<20||shot.x>940||shot.y<20||shot.y>540){if(shot.bounces++)shot.life=0;else{if(shot.x<20||shot.x>940)shot.vx*=-1;if(shot.y<20||shot.y>540)shot.vy*=-1;shot.x=clamp(shot.x,20,940);shot.y=clamp(shot.y,20,540);}}
   const crate=s.crates.find(c=>c.hp>0&&Math.abs(shot.x-c.x)<21&&Math.abs(shot.y-c.y)<21);if(crate){crate.hp--;shot.life=0;break;}
   const wall=s.walls.find(w=>inside(shot.x,shot.y,w,3));if(wall){if(shot.bounces++)shot.life=0;else{if(ox<=wall.x-3||ox>=wall.x+wall.w+3)shot.vx*=-1;else shot.vy*=-1;shot.x=ox;shot.y=oy;}}
   if(shot.life<=0)break;
   const target=s.players.find((p,j)=>j!==shot.owner&&p.hp>0&&p.respawn<=0&&p.invulnerable<=0&&Math.hypot(p.x-shot.x,p.y-shot.y)<22);if(target){target.hp--;target.invulnerable=.18;shot.life=0;if(target.hp===0){target.respawn=1.7;target.kos++;s.players[shot.owner].score++;}break;}
  }}
  s.shots=s.shots.filter(p=>p.life>0);
  if(s.players.some(p=>p.score>=5)||s.elapsed>=120)ranked(s,s.players.map(p=>p.score),'Five knockouts wins. Most knockouts takes the arena.');
 }
 return s;
}
export function extraWorldBot(s,i,c){const p=s.players[i];if(s.game==='marble-run'){const coin=s.pickups.find(g=>g.x>p.x&&g.x<p.x+180&&!p.collected.includes(g.id));const obstacle=(s.bumpers||[]).find(b=>b.x>p.x&&b.x<p.x+155),target=obstacle&&Math.abs((coin?.y||0)-obstacle.y)<27?(obstacle.y>=0?-37:37):coin?.y||0;c.left=p.y>target+6;c.right=p.y<target-6;c.attack=Boolean(obstacle&&obstacle.x-p.x<45&&Math.abs(p.y-obstacle.y)<30);return c;}
 const q=s.players.filter((_,j)=>j!==i).sort((a,b)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(p.x-b.x,p.y-b.y))[0];if(!q)return c;
 const turn=Math.floor(s.elapsed/2+i)%4;const tx=q.x+(turn%2?100:-100),ty=q.y+(turn<2?110:-110);c.left=p.x>tx+25;c.right=p.x<tx-25;c.up=p.y>ty+25;c.down=p.y<ty-25;c.attack=true;return c;
}
