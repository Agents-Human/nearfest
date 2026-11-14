import {extraWorldIds,newExtraWorld,advanceExtraWorld,extraWorldBot} from './extra-worlds.mjs';
import {resetGolfHole,advanceGolf} from './golf-courses.mjs';
export const DT=.05;
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const angle=n=>Math.atan2(Math.sin(n),Math.cos(n));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const controls=d=>Object.fromEntries(['left','right','up','down','attack','block'].map(k=>[k,d?.[k]===true]));
export const worldIds=new Set([...extraWorldIds,'pocket-racers','stick-rivals','paddle-duel','air-hockey','snake-arena','bomb-maze','mini-golf','marble-knockout','kitchen-rush','paint-tag','platform-relay','orbit-rescue']);
export function finish(s,winners,reason){s.finished=true;s.winners=winners;s.reason=reason;return s;}
export function ranked(s,values,reason,low=false){const best=(low?Math.min:Math.max)(...values);return finish(s,values.flatMap((v,i)=>Math.abs(v-best)<1e-7?[i]:[]),reason);}
function fighter(i,round=0){const side=(i+round)%2;return {x:side?700:260,y:410,vx:0,vy:0,facing:side?-1:1,hp:100,energy:100,cooldown:0,attack:0,hit:false,blocking:false,ground:true,attackKind:'punch',attackSeq:0,stun:0};}
export function newWorld(game,n){
 const s={game,tick:0,elapsed:0,finished:false,winners:[],reason:'',players:[],round:0};
 if(game==='pocket-racers'){
  s.courseLength=9000;
  s.players=Array.from({length:n},()=>({x:480,y:0,heading:0,speed:0,boost:100,boosting:false,progress:0,finish:null,coins:0,collected:[],crashes:0,invulnerable:0}));
  s.traffic=Array.from({length:17},(_,i)=>({id:i,x:[390,480,570][i%3],distance:850+i*440,speed:i%4===0?0:55,kind:i%4===0?'barrier':'car'}));
  s.pickups=Array.from({length:45},(_,i)=>({id:i,x:[570,390,480][Math.floor(i/3)%3],distance:550+i*175}));
 }
 else if(game==='stick-rivals'){s.players=Array.from({length:n},(_,i)=>fighter(i));s.scores=Array(n).fill(0);s.roundTime=0;s.breakTime=0;}
 else if(game==='paddle-duel'||game==='air-hockey'){s.players=Array.from({length:n},(_,i)=>({x:i?880:80,y:280,score:0,vx:0,vy:0}));s.ball={x:480,y:280,vx:game==='paddle-duel'?260:190,vy:game==='paddle-duel'?90:60};s.serve=0;s.reset=1;}
 else if(game==='marble-knockout'){s.players=Array.from({length:n},(_,i)=>({x:480+180*Math.cos(i*2*Math.PI/n),y:280+180*Math.sin(i*2*Math.PI/n),vx:0,vy:0,alive:true}));s.radius=245;}
 else if(game==='paint-tag'){s.players=Array.from({length:n},(_,i)=>({x:[120,840,120,840][i],y:[100,460,460,100][i],vx:0,vy:0,aim:i%2?Math.PI:0,score:0,cooldown:0,invulnerable:1}));s.shots=[];s.nextShot=0;s.walls=[{x:300,y:130,w:60,h:180},{x:600,y:250,w:60,h:180}];}
 else if(game==='snake-arena'){s.grid=25;s.step=0;s.players=Array.from({length:n},(_,i)=>{const x=4+i*3,y=i%2?19:5;return {body:[{x,y},{x:x-1,y},{x:x-2,y}],dir:0,alive:true};});s.food=[{x:12,y:12},{x:6,y:12},{x:18,y:12},{x:12,y:6},{x:12,y:18}];s.foodIndex=0;}
 else if(game==='bomb-maze'){s.grid=13;s.scores=Array(n).fill(0);resetMaze(s,n);}
 else if(game==='mini-golf'){s.hole=0;s.turn=0;s.players=Array.from({length:n},()=>({total:0,holes:[]}));s.moving=false;s.shots=[];resetGolfHole(s);}
 else if(game==='kitchen-rush'){s.players=Array.from({length:n},(_,i)=>({x:260+i*100,y:300,carrying:null,cooldown:0}));s.stations=[{x:130,y:110,kind:'tomato',item:null},{x:130,y:430,kind:'lettuce',item:null},{x:460,y:110,kind:'chop',item:null,progress:0},{x:460,y:430,kind:'cook',item:null,progress:0},{x:830,y:280,kind:'serve',item:null}];s.orders=['salad','soup','salad','soup','soup','salad'];s.served=0;}
 else if(game==='platform-relay'){
  s.seed=Math.floor(Math.random()*1000000);s.nextIsland=0;s.platforms=[];s.coins=[];s.hazards=[];s.stormX=-500;s.difficulty=1;
  s.players=Array.from({length:n},(_,i)=>({x:65,y:435,vx:0,vy:0,ground:true,alive:true,coyote:.12,jumpBuffer:0,jumpHeld:false,coins:0,airJumps:0,score:0,deathReason:null}));
  extendIslands(s);
 }
 else if(game==='orbit-rescue'){s.players=Array.from({length:n},(_,i)=>({role:['Steering','Thrust','Docking','Navigation'][i]}));s.ship={x:480,y:280,vx:0,vy:0,heading:0,fuel:100};s.probes=[{x:200,y:150,rescued:false},{x:770,y:130,rescued:false},{x:720,y:440,rescued:false}];s.docked=0;}
 else if(extraWorldIds.has(game))newExtraWorld(s,n);
 else throw Error('Unknown shared world.');
 return s;
}
// The shared seed and server-owned course make every client's terrain identical.
// Only the active section is retained, so a long survival round stays bounded.
function extendIslands(s){
 const lead=Math.max(...s.players.map(p=>p.x));
 while(!s.platforms.length||s.platforms.at(-1).x+s.platforms.at(-1).w<lead+2600){
  const i=s.nextIsland++,difficulty=Math.min(1,i/35),r=Math.abs(Math.sin(s.seed+i*73.17));
  const previous=s.platforms.at(-1),x=previous?previous.x+previous.w+48+Math.round(difficulty*35+r*12):0;
  const y=i===0?460:[420,370,410,460,400,350,410][(i-1)%7],w=i===0?440:Math.round(340-difficulty*60+r*35);
  const floor={id:i,x,y,w,h:85};s.platforms.push(floor);
  for(let j=0;j<3;j++)s.coins.push({id:i*3+j,x:x+w*(.28+j*.22),y:y-58,collectedBy:[]});
  if(i>=7&&i%3===1)s.hazards.push({id:i,kind:i>=12&&i%2===0?'orb':'thorns',x:x+w*.62,y,phase:r*6.28});
 }
 const behind=Math.min(...s.players.filter(p=>p.alive).map(p=>p.x))-700;
 s.platforms=s.platforms.filter(p=>p.x+p.w>behind);s.coins=s.coins.filter(p=>p.x>behind);s.hazards=s.hazards.filter(p=>p.x>behind);
 s.difficulty=1+Math.floor(lead/2500);
}
function resetMaze(s,n){s.players=Array.from({length:n},(_,i)=>({x:[1,11,1,11][(i+s.round)%n],y:[1,11,11,1][(i+s.round)%n],alive:true,moveAt:0,plantAt:0}));s.blocks=[];for(let y=1;y<12;y++)for(let x=1;x<12;x++)if(!(x%2===0&&y%2===0)&&!s.players.some(p=>Math.abs(x-p.x)+Math.abs(y-p.y)<3)&&(Math.abs(x-6)+Math.abs(y-6))%3===0)s.blocks.push(`${x},${y}`);s.bombs=[];s.blasts=[];s.roundTime=0;s.breakTime=0;}
function movement(p,c,speed,dt=DT){let dx=Number(c.right)-Number(c.left),dy=Number(c.down)-Number(c.up),length=Math.hypot(dx,dy)||1;p.x=clamp(p.x+dx/length*speed*dt,30,930);p.y=clamp(p.y+dy/length*speed*dt,30,530);}
export function worldAction(s,i,d){
 if(s.finished)throw Error('This game has ended.');
 if(s.game==='mini-golf'){
  if(i!==s.turn||s.moving||s.players[i].sunk)throw Error('Wait for your shot.');
  if(d.type!=='shoot'||!Number.isFinite(d.angle)||!Number.isFinite(d.power)||d.power<.05||d.power>1)throw Error('Choose an aim and power.');
  const p=s.players[i];p.vx=Math.cos(d.angle)*d.power*420;p.vy=Math.sin(d.angle)*d.power*420;p.strokes++;s.moving=true;s.shots.push({player:i,hole:s.hole,angle:d.angle,power:d.power});return;
 }
 if(s.game==='kitchen-rush'&&d.type==='interact'){
  const p=s.players[i];if(p.cooldown>0)return;const station=s.stations.find(t=>distance(p,t)<90);if(!station)throw Error('Move closer to a kitchen station.');p.cooldown=.35;
  if(['tomato','lettuce'].includes(station.kind)){if(!p.carrying)p.carrying=station.kind;}
  else if(station.kind==='serve'){if(p.carrying===s.orders[s.served]){s.served++;p.carrying=null;if(s.served===s.orders.length)finish(s,s.players.map((_,j)=>j),'Every order served!');}else throw Error('That dish does not match the next order.');}
  else if(!station.item&&p.carrying){if(station.kind==='chop'&&!['tomato','lettuce'].includes(p.carrying)||station.kind==='cook'&&p.carrying!=='chopped tomato')throw Error('Use the right station for this ingredient.');station.item=p.carrying;station.progress=0;p.carrying=null;}
  else if(!p.carrying&&station.item&&station.progress>=3){p.carrying=station.item;station.item=null;station.progress=0;}
  return;
 }

 throw Error('Choose a supported game action.');
}
export function advanceWorld(previous,input){
 if(previous.finished)return previous;const s=structuredClone(previous),cs=s.players.map((_,i)=>controls(input[i]));s.tick++;s.elapsed+=DT;
 if(extraWorldIds.has(s.game))return advanceExtraWorld(s,cs,DT,finish,ranked);
 if(s.game==='pocket-racers'){
  for(let i=0;i<s.players.length;i++){
   const p=s.players[i],c=cs[i];if(p.finish!==null)continue;
   const before=p.y;p.invulnerable=Math.max(0,p.invulnerable-DT);
   p.boosting=Boolean(c.attack&&p.boost>0);p.boost=clamp(p.boost+(p.boosting?-30:8)*DT,0,100);
   const desired=c.down||c.block?130:p.boosting?335:235;
   p.speed=p.speed<desired?Math.min(desired,p.speed+150*DT):Math.max(desired,p.speed-260*DT);
   p.x=clamp(p.x+(Number(c.right)-Number(c.left))*245*DT,350,610);
   p.heading=(Number(c.right)-Number(c.left))*.22;p.y+=p.speed*DT;p.progress=p.y/s.courseLength;
   for(const vehicle of s.traffic){const z=vehicle.distance+vehicle.speed*s.elapsed,oldZ=z-vehicle.speed*DT;if(p.invulnerable===0&&Math.abs(p.x-vehicle.x)<29&&before<=oldZ+35&&p.y>=z-35){p.speed=Math.max(75,p.speed*.38);p.crashes++;p.invulnerable=1.25;}}
   for(const item of s.pickups)if(!p.collected.includes(item.id)&&Math.abs(p.x-item.x)<35&&before<=item.distance+25&&p.y>=item.distance-25){p.collected.push(item.id);p.coins++;p.boost=Math.min(100,p.boost+8);}
   if(p.y>=s.courseLength)p.finish=s.elapsed-DT+DT*(s.courseLength-before)/(p.y-before);
  }
  if(s.players.some(p=>p.finish!==null))ranked(s,s.players.map(p=>p.finish??Infinity),'Coastal sprint complete!',true);
  else if(s.elapsed>=120)ranked(s,s.players.map(p=>p.y),'Furthest along the coast wins.');
 } else if(s.game==='stick-rivals'){
  if(s.breakTime>0){s.breakTime-=DT;if(s.breakTime<=0){s.round++;s.roundTime=0;s.players=s.players.map((_,i)=>fighter(i,s.round));}return s;}
  s.roundTime+=DT;const hits=[];
  s.players.forEach((p,i)=>{const c=cs[i];p.cooldown=Math.max(0,p.cooldown-DT);p.energy=clamp(p.energy+(c.block?7:14)*DT,0,100);p.blocking=c.block&&p.energy>1;p.energy-=p.blocking?5*DT:0;
   p.stun=Math.max(0,(p.stun||0)-DT);const dx=Number(c.right)-Number(c.left),rival=s.players[1-i];if(dx)p.facing=dx;else if(!p.attack)p.facing=rival.x>=p.x?1:-1;p.vx=p.stun>0?0:dx*(p.blocking?85:230);if(c.up&&p.ground){p.vy=-460;p.ground=false;}
   p.vy+=1150*DT;p.x=clamp(p.x+p.vx*DT,55,905);p.y+=p.vy*DT;if(p.y>=410){p.y=410;p.vy=0;p.ground=true;}
   if((c.attack||c.down)&&!p.blocking&&p.cooldown===0&&p.stun===0&&p.energy>=(c.down?22:10)){p.attackKind=c.down?'kick':'punch';p.attack=c.down?.4:.27;p.cooldown=c.down?.78:.42;p.energy-=c.down?22:10;p.attackSeq=(p.attackSeq||0)+1;p.hit=false;}
   p.attack=Math.max(0,p.attack-DT);
   if(p.attack>0&&p.attack<.16&&!p.hit){p.hit=true;s.players.forEach((other,j)=>{if(i!==j&&Math.abs(other.y-p.y)<85&&(other.x-p.x)*p.facing>=-15&&Math.abs(other.x-p.x)<(p.attackKind==='kick'?95:72))hits.push({from:i,to:j,kind:p.attackKind});});}
  });
  for(const hit of hits){const p=s.players[hit.to],attacker=s.players[hit.from],blocked=p.blocking&&(attacker.x-p.x)*p.facing>0;p.hp=Math.max(0,p.hp-(blocked?2:hit.kind==='kick'?18:10));p.x=clamp(p.x+attacker.facing*(blocked?4:hit.kind==='kick'?34:13),55,905);p.stun=blocked?0:.12;if(blocked)p.energy=Math.max(0,p.energy-9);}
  const [left,right]=[...s.players].sort((a,b)=>a.x-b.x);if(right.x-left.x<36&&Math.abs(right.y-left.y)<70){const overlap=(36-(right.x-left.x))/2;left.x=clamp(left.x-overlap,55,905);right.x=clamp(right.x+overlap,55,905);}
  if(s.players.some(p=>p.hp<=0)||s.roundTime>=60){const max=Math.max(...s.players.map(p=>p.hp));s.players.forEach((p,i)=>{if(p.hp===max)s.scores[i]+=s.players.filter(q=>q.hp===max).length===1?1:.5;});s.reason='Round complete';if(s.round>=2||s.scores.some(n=>n>=2))ranked(s,s.scores,'Best score across three rounds.');else s.breakTime=2;}
 } else if(s.game==='paddle-duel'||s.game==='air-hockey'){
  const hockey=s.game==='air-hockey',ball=s.ball;
  s.players.forEach((p,i)=>{const old={x:p.x,y:p.y};if(hockey){movement(p,cs[i],320);p.x=clamp(p.x,i?505:35,i?925:455);}else p.y=clamp(p.y+(Number(cs[i].down)-Number(cs[i].up))*360*DT,55,505);p.vx=(p.x-old.x)/DT;p.vy=(p.y-old.y)/DT;});
  if(s.reset>0){s.reset-=DT;return s;}
  const previousBall={x:ball.x,y:ball.y};ball.x+=ball.vx*DT;ball.y+=ball.vy*DT;
  if(ball.y<15||ball.y>545){ball.y=clamp(ball.y,15,545);ball.vy*=-1;}
  for(let i=0;i<s.players.length;i++){const p=s.players[i];if(hockey){const d=distance(p,ball);if(d<42){const nx=(ball.x-p.x)/(d||1),ny=(ball.y-p.y)/(d||1);ball.x=p.x+nx*43;ball.y=p.y+ny*43;const velocity=clamp(Math.hypot(p.vx,p.vy)*1.3+240,250,600);ball.vx=nx*velocity;ball.vy=ny*velocity;}}else if((Math.abs(ball.x-p.x)<23||Math.min(previousBall.x,ball.x)<=p.x&&Math.max(previousBall.x,ball.x)>=p.x)&&Math.abs(ball.y-p.y)<65&&Math.sign(ball.vx)===(i?1:-1)){ball.x=p.x+(i?-24:24);ball.vx=(i?-1:1)*Math.min(560,Math.abs(ball.vx)+18);ball.vy=(ball.y-p.y)*6;}}
  if(ball.x<12||ball.x>948){if(hockey&&(ball.y<185||ball.y>375)){ball.x=clamp(ball.x,12,948);ball.vx*=-1;}else{const winner=ball.x<12?1:0;s.players[winner].score++;if(s.players[winner].score>=(hockey?5:7))finish(s,[winner],'Score target reached.');s.serve++;s.ball={x:480,y:280,vx:(s.serve%2?-1:1)*(hockey?190:260),vy:(s.serve%4<2?1:-1)*(hockey?60:90)};s.reset=1;}}
  if(s.elapsed>=180&&!s.finished)ranked(s,s.players.map(p=>p.score),'Time limit: highest score wins.');
 } else if(s.game==='marble-knockout'){
  s.radius=Math.max(80,245-s.elapsed*1.3);s.players.forEach((p,i)=>{if(!p.alive)return;const c=cs[i];p.vx=clamp((p.vx+(Number(c.right)-Number(c.left))*400*DT)*.95,-220,220);p.vy=clamp((p.vy+(Number(c.down)-Number(c.up))*400*DT)*.95,-220,220);p.x+=p.vx*DT;p.y+=p.vy*DT;});
  for(let i=0;i<s.players.length;i++)for(let j=i+1;j<s.players.length;j++){const a=s.players[i],b=s.players[j],d=distance(a,b);if(a.alive&&b.alive&&d<38){const nx=d?(b.x-a.x)/d:1,ny=d?(b.y-a.y)/d:0,overlap=(38-d)/2;a.x-=nx*overlap;b.x+=nx*overlap;a.y-=ny*overlap;b.y+=ny*overlap;const impulse=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;if(impulse>0){a.vx-=nx*impulse;b.vx+=nx*impulse;a.vy-=ny*impulse;b.vy+=ny*impulse;}}}
  s.players.forEach(p=>{if(Math.hypot(p.x-480,p.y-280)>s.radius)p.alive=false;});const alive=s.players.flatMap((p,i)=>p.alive?[i]:[]);if(alive.length<=1||s.elapsed>=120)finish(s,alive,'Last marble on the platform.');
 } else if(s.game==='paint-tag'){
  s.players.forEach((p,i)=>{const old={x:p.x,y:p.y};movement(p,cs[i],220);if(s.walls.some(w=>p.x>w.x-20&&p.x<w.x+w.w+20&&p.y>w.y-20&&p.y<w.y+w.h+20)){p.x=old.x;p.y=old.y;}const dx=Number(cs[i].right)-Number(cs[i].left),dy=Number(cs[i].down)-Number(cs[i].up);if(dx||dy)p.aim=Math.atan2(dy,dx);p.cooldown=Math.max(0,p.cooldown-DT);p.invulnerable=Math.max(0,p.invulnerable-DT);if(cs[i].attack&&p.cooldown===0){s.shots.push({id:s.nextShot++,x:p.x,y:p.y,vx:Math.cos(p.aim)*540,vy:Math.sin(p.aim)*540,owner:i,life:1.7});p.cooldown=.3;}});
  for(const shot of s.shots){shot.x+=shot.vx*DT;shot.y+=shot.vy*DT;shot.life-=DT;if(s.walls.some(w=>shot.x>w.x&&shot.x<w.x+w.w&&shot.y>w.y&&shot.y<w.y+w.h))shot.life=0;for(let j=0;j<s.players.length;j++){const p=s.players[j];if(shot.life>0&&j!==shot.owner&&p.invulnerable===0&&distance(p,shot)<23){s.players[shot.owner].score++;p.x=[120,840,120,840][j];p.y=[100,460,460,100][j];p.invulnerable=1.5;shot.life=0;}}}s.shots=s.shots.filter(p=>p.life>0&&p.x>0&&p.x<960&&p.y>0&&p.y<560);if(s.elapsed>=120)ranked(s,s.players.map(p=>p.score),'Most paint tags wins.');
 } else if(s.game==='snake-arena'){
  if(s.tick%4!==0)return s;
  const heads=s.players.map((p,i)=>{if(!p.alive)return null;const c=cs[i],desired=c.right?0:c.down?1:c.left?2:c.up?3:p.dir;if((desired+2)%4!==p.dir)p.dir=desired;return {x:p.body[0].x+[1,0,-1,0][p.dir],y:p.body[0].y+[0,1,0,-1][p.dir]};});
  const dead=new Set();heads.forEach((h,i)=>{if(!h)return;if(h.x<0||h.y<0||h.x>=25||h.y>=25||heads.some((other,j)=>j!==i&&other&&h.x===other.x&&h.y===other.y)||s.players.some((p,j)=>p.alive&&p.body.slice(0,s.food.some(f=>heads[j]&&f.x===heads[j].x&&f.y===heads[j].y)?undefined:-1).some(cell=>cell.x===h.x&&cell.y===h.y)))dead.add(i);});
  heads.forEach((h,i)=>{const p=s.players[i];if(!h)return;if(dead.has(i)){p.alive=false;return;}p.body.unshift(h);const food=s.food.findIndex(f=>f.x===h.x&&f.y===h.y);if(food<0)p.body.pop();else{s.food.splice(food,1);for(let j=0;j<625;j++){const at=(s.foodIndex++*17+37)%625,f={x:at%25,y:Math.floor(at/25)};if(!s.players.some(q=>q.body.some(c=>c.x===f.x&&c.y===f.y))&&!s.food.some(c=>c.x===f.x&&c.y===f.y)){s.food.push(f);break;}}}});
  const alive=s.players.flatMap((p,i)=>p.alive?[i]:[]);if(alive.length<=1)finish(s,alive,'Last snake standing.');else if(s.elapsed>=300)ranked(s,s.players.map(p=>p.alive?p.body.length:-1),'Time limit: longest surviving snake wins.');
 } else if(s.game==='bomb-maze'){
  if(s.breakTime>0){s.breakTime-=DT;if(s.breakTime<=0){s.round++;resetMaze(s,s.players.length);}return s;}s.roundTime+=DT;
  const blocked=(x,y)=>x<1||y<1||x>11||y>11||x%2===0&&y%2===0||s.blocks.includes(`${x},${y}`)||s.bombs.some(b=>b.x===x&&b.y===y);
  s.players.forEach((p,i)=>{if(!p.alive)return;const c=cs[i];if(s.elapsed>=p.moveAt){const dx=c.left?-1:c.right?1:0,dy=dx?0:c.up?-1:c.down?1:0;if((dx||dy)&&!blocked(p.x+dx,p.y+dy)){p.x+=dx;p.y+=dy;p.moveAt=s.elapsed+.16;}}if(c.attack&&s.elapsed>=p.plantAt&&!s.bombs.some(b=>b.x===p.x&&b.y===p.y)){s.bombs.push({x:p.x,y:p.y,until:s.elapsed+2});p.plantAt=s.elapsed+1;}});
  s.blasts=s.blasts.filter(b=>b.until>s.elapsed);
  for(let k=0;k<s.bombs.length;k++){const b=s.bombs[k];if(b.until>s.elapsed)continue;s.bombs.splice(k--,1);const cells=[{x:b.x,y:b.y}];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])for(let r=1;r<=3;r++){const x=b.x+dx*r,y=b.y+dy*r;if(x<1||y<1||x>11||y>11||x%2===0&&y%2===0)break;cells.push({x,y});const block=s.blocks.indexOf(`${x},${y}`);if(block>=0){s.blocks.splice(block,1);break;}for(const chain of s.bombs)if(chain.x===x&&chain.y===y)chain.until=s.elapsed;}s.blasts.push(...cells.map(c=>({...c,until:s.elapsed+.4})));}
  s.players.forEach(p=>{if(s.blasts.some(b=>b.x===p.x&&b.y===p.y))p.alive=false;});const alive=s.players.flatMap((p,i)=>p.alive?[i]:[]);if(alive.length<=1||s.roundTime>=55){for(const i of alive)s.scores[i]+=1/(alive.length||1);if(s.round===2)ranked(s,s.scores,'Best survival score across three rounds.');else s.breakTime=2;}
 } else if(s.game==='mini-golf'){
  advanceGolf(s,DT,ranked);
 } else if(s.game==='kitchen-rush'){
  s.players.forEach((p,i)=>{movement(p,cs[i],220);p.cooldown=Math.max(0,p.cooldown-DT);});for(const t of s.stations)if(t.item&&t.progress<3){t.progress+=DT;if(t.progress>=3)t.item=t.kind==='cook'?'soup':t.item==='lettuce'?'salad':'chopped tomato';}if(s.elapsed>=180)finish(s,[],'Kitchen closed. Try the orders again.');
 } else if(s.game==='platform-relay'){
  s.stormX=-500+Math.max(0,s.elapsed-10)*(95+Math.min(75,s.elapsed*.38));
  s.players.forEach((p,i)=>{
   if(!p.alive)return;
   const c=cs[i],oldY=p.y,jump=c.up||c.attack;
   p.coyote=p.ground?.12:Math.max(0,(p.coyote||0)-DT);
   p.jumpBuffer=jump&&!p.jumpHeld?.15:Math.max(0,(p.jumpBuffer||0)-DT);
   p.vx=(Number(c.right)-Number(c.left))*210;
   const edge=s.platforms.find(f=>p.x>=f.x-8&&p.x<=f.x+f.w+8&&Math.abs(p.y+25-f.y)<2);
   const assisted=p.ground&&c.right&&edge&&p.x>edge.x+edge.w-32;
   if(assisted){p.jumpBuffer=.15;p.autoJump=true;}
   if(p.jumpBuffer>0&&p.coyote>0){p.vy=-510;p.ground=false;p.coyote=0;p.jumpBuffer=0;}else if(p.jumpBuffer>0&&!p.ground&&p.airJumps>0){p.vy=-450;p.airJumps--;p.autoJump=false;p.jumpBuffer=0;}
   if(!jump&&p.jumpHeld&&!p.autoJump&&p.vy< -230)p.vy=-230;
   p.jumpHeld=jump;p.vy+=1050*DT;p.x=Math.max(20,p.x+p.vx*DT);p.y+=p.vy*DT;p.ground=false;
   for(const floor of s.platforms)if(p.x>floor.x-8&&p.x<floor.x+floor.w+8&&oldY+25<=floor.y+.1&&p.y+25>=floor.y&&p.vy>=0){p.y=floor.y-25;p.vy=0;p.ground=true;p.autoJump=false;}
   for(const coin of s.coins)if(!coin.collectedBy.includes(i)&&Math.hypot(p.x-coin.x,p.y-coin.y)<43){coin.collectedBy.push(i);p.coins++;if(p.coins%8===0)p.airJumps=Math.min(2,(p.airJumps||0)+1);}
   for(const hazard of s.hazards){const hit=hazard.kind==='thorns'?Math.abs(p.x-hazard.x)<28&&p.y+23>hazard.y-27&&p.y-20<hazard.y:Math.hypot(p.x-hazard.x,p.y-(hazard.y-65+Math.sin(s.elapsed*2+hazard.phase)*25))<32;if(hit){p.alive=false;p.deathReason=hazard.kind==='thorns'?'hit the spikes':'hit a moving saw';}}
   if(p.y>620){p.alive=false;p.deathReason='fell into the sea';}else if(p.x<s.stormX){p.alive=false;p.deathReason='was caught by the storm';}
   p.score=Math.floor(p.x/10)+p.coins*10;
  });
  const lost=s.players.flatMap((p,i)=>p.alive?[]:[i]);
  if(lost.length){s.eliminated=lost;finish(s,s.players.flatMap((p,i)=>p.alive?[i]:[]),lost.length===s.players.length?'Everyone fell on the same beat. Rematch!':`Player ${lost[0]+1} ${s.players[lost[0]].deathReason}. The survivors win!`);}
  else extendIslands(s);
 } else if(s.game==='orbit-rescue'){
  const ship=s.ship;ship.heading+=(Number(cs[0].right)-Number(cs[0].left))*2.6*DT;
  const thrust=cs[Math.min(1,cs.length-1)];if(thrust.up&&ship.fuel>0){ship.vx+=Math.cos(ship.heading)*100*DT;ship.vy+=Math.sin(ship.heading)*100*DT;ship.fuel=Math.max(0,ship.fuel-2*DT);}if(thrust.down||cs[3]?.down){ship.vx*=.91;ship.vy*=.91;}if(cs[3]?.attack)ship.fuel=Math.min(100,ship.fuel+.3*DT);ship.vx=clamp(ship.vx*.995,-160,160);ship.vy=clamp(ship.vy*.995,-160,160);ship.x=clamp(ship.x+ship.vx*DT,30,930);ship.y=clamp(ship.y+ship.vy*DT,30,530);
  const dock=cs[Math.min(2,cs.length-1)].attack;if(dock&&Math.hypot(ship.vx,ship.vy)<45)for(const p of s.probes)if(!p.rescued&&distance(ship,p)<55){p.rescued=true;s.docked++;}if(s.docked===3)finish(s,s.players.map((_,i)=>i),'All three probes rescued.');else if(s.elapsed>=180)finish(s,[],'Mission clock ended.');
 }
 return s;
}
export function worldBot(s,i){
 const p=s.players[i],c=controls({});if(s.finished)return c;
 if(extraWorldIds.has(s.game))return extraWorldBot(s,i,c);
 if(s.game==='pocket-racers'){
  const next=s.traffic.find(v=>v.distance+v.speed*s.elapsed>p.y-30&&v.distance+v.speed*s.elapsed<p.y+330);
  const target=next&&Math.abs(p.x-next.x)<48?(next.x>=480?390:570):p.x;c.left=p.x>target+12;c.right=p.x<target-12;
 }
 else if(s.game==='stick-rivals'){const q=s.players[1-i],d=q.x-p.x;c.right=d>57;c.left=d< -57;c.attack=Math.abs(d)<75;c.down=Math.abs(d)>=75&&Math.abs(d)<95&&s.tick%30<3;c.block=q.attack>.16&&Math.floor(s.tick/5)%3===0;c.up=Math.abs(d)>130&&s.tick%55<4;}
 else if(['paddle-duel','air-hockey'].includes(s.game)){const target=s.game==='paddle-duel'?s.ball:{x:s.ball.x<(i?480:960)&&s.ball.x>(i?0:480)?i?880:80:s.ball.x,y:s.ball.y};c.up=target.y<p.y-10;c.down=target.y>p.y+10;if(s.game==='air-hockey'){c.left=target.x<p.x-10;c.right=target.x>p.x+10;}}
 else if(s.game==='marble-knockout'){c.left=p.x>480;c.right=p.x<480;c.up=p.y>280;c.down=p.y<280;}
 else if(s.game==='paint-tag'){const q=s.players[(i+1)%s.players.length];c.left=q.x<p.x-60;c.right=q.x>p.x+60;c.up=q.y<p.y-50;c.down=q.y>p.y+50;c.attack=true;}
 else if(s.game==='snake-arena'){const head=p.body[0],food=[...s.food].sort((a,b)=>distance(a,head)-distance(b,head))[0];const dirs=[0,1,2,3].filter(d=>(d+2)%4!==p.dir).map(dir=>({dir,x:head.x+[1,0,-1,0][dir],y:head.y+[0,1,0,-1][dir]})).filter(q=>q.x>=0&&q.y>=0&&q.x<25&&q.y<25&&!s.players.some(other=>other.alive&&other.body.some(b=>b.x===q.x&&b.y===q.y))).sort((a,b)=>distance(a,food)-distance(b,food));if(dirs[0])c[['right','down','left','up'][dirs[0].dir]]=true;}
 else if(s.game==='bomb-maze'){const dirs=[[1,0,'right'],[0,1,'down'],[-1,0,'left'],[0,-1,'up']],options=dirs.filter(([dx,dy])=>{const x=p.x+dx,y=p.y+dy;return x>0&&y>0&&x<12&&y<12&&!(x%2===0&&y%2===0)&&!s.blocks.includes(`${x},${y}`)&&!s.bombs.some(b=>b.x===x&&b.y===y);});const choice=options[Math.floor(s.tick/15+i)%Math.max(1,options.length)];if(choice)c[choice[2]]=true;c.attack=s.tick%60===i*3;}
 else if(s.game==='platform-relay'){
  c.right=true;
  const danger=s.hazards.find(h=>h.x>p.x&&h.x-p.x<100);
  c.up=Boolean(p.ground&&danger&&!p.jumpHeld||!p.ground&&(p.jumpHeld&&p.vy< -30||!p.jumpHeld&&p.airJumps>0&&(p.y>480||danger&&p.vy>0&&p.y>danger.y-150)));
 }
 else if(s.game==='orbit-rescue'){const ship=s.ship,target=s.probes.find(p=>!p.rescued)||ship,d=distance(ship,target);if(i===1){c.up=d>65&&Math.hypot(ship.vx,ship.vy)<100;c.down=d<100;}if(i>=2)c.attack=d<55;}
 return c;
}
