// Server-owned simulations. Clients send controls, never positions or scores.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const socialWorldIds=new Set(['pocket-soccer','cat-defense','bridge-builders']);
export const catLanes=[200,290,380];
const rand=(seed,n)=>{const v=Math.sin(seed*1.713+n*73.171)*43758.5453;return v-Math.floor(v);};
function soccerReset(s){s.ball={x:480,y:280,vx:0,vy:0,owner:null,lock:.5,lastTouch:null};s.players.forEach((p,i)=>Object.assign(p,{x:i?710:250,y:280,vx:0,vy:0,heading:i?Math.PI:0,kick:0,cooldown:0}));s.reset=1.5;s.kickoffAt=s.elapsed;}
function bridgeTarget(s){const from=s.platforms.at(-1),i=s.round,width=Math.round(Math.max(48,100-i*3)+rand(s.seed,i+9)*22),gap=i===0?110:Math.round(85+rand(s.seed,i)*145+Math.min(45,i*2));const next={id:i+1,x:from.x+from.w+gap,w:width};s.from=from;s.to=next;s.platforms.push(next);s.platforms=s.platforms.slice(-6);s.roundAt=s.elapsed;s.decisionSeconds=s.players.length===1?0:s.round===0?30:15;s.nextRound=0;s.players.forEach(p=>Object.assign(p,{x:from.x+from.w-14,y:0,length:0,rotation:0,phase:'waiting',phaseTime:0,hit:false,perfect:false,held:false}));}
function spawnWave(s){s.wave++;s.toSpawn=5+s.wave*2+(s.players.length-1)*3;s.spawned=0;s.spawnIn=1.6;s.waveBreak=0;}
export function newSocialWorld(s,n){
 if(s.game==='pocket-soccer'){
  s.players=Array.from({length:n},(_,i)=>({x:0,y:0,vx:0,vy:0,score:0,heading:i?Math.PI:0,kick:0,cooldown:0,kicks:0}));s.goal=null;s.goalSeq=0;s.overtime=false;s.matchTime=0;s.target=5;soccerReset(s);
 }else if(s.game==='cat-defense'){
  s.players=Array.from({length:n},(_,i)=>({x:213+(i-(n-1)/2)*52,y:catLanes[i%3],lane:i%3,score:0,coins:0,level:1,shot:0,bomb:0,shootTime:0,upHeld:false,downHeld:false,bombs:0}));s.gate=100;s.wave=0;s.totalWaves=5;s.waveBreak=3;s.enemies=[];s.shots=[];s.coins=[];s.bursts=[];s.nextId=0;s.kills=0;s.gold=0;
 }else{
  s.seed=Math.floor(Math.random()*1000000);s.platforms=[{id:0,x:40,w:100}];s.players=Array.from({length:n},()=>({x:126,y:0,score:0,coins:0,crossings:0,alive:true}));s.round=0;bridgeTarget(s);
 }
}
function advanceSoccer(s,cs,dt,finish,ranked){
 s.matchTime+=dt;
 if(s.reset>0){s.reset=Math.max(0,s.reset-dt);return;}
 s.goal=null;const b=s.ball;b.lock=Math.max(0,b.lock-dt);
 s.players.forEach((p,i)=>{const c=cs[i],dx=Number(c.right)-Number(c.left),dy=Number(c.down)-Number(c.up),l=Math.hypot(dx,dy)||1;p.vx=dx/l*225;p.vy=dy/l*225;p.x=clamp(p.x+p.vx*dt,55,905);p.y=clamp(p.y+p.vy*dt,68,492);if(dx||dy)p.heading=Math.atan2(dy,dx);p.cooldown=Math.max(0,p.cooldown-dt);p.kick=Math.max(0,p.kick-dt);});
 // Soft body separation leaves room to tackle and dribble without pinning anyone.
 for(let i=0;i<s.players.length;i++)for(let j=i+1;j<s.players.length;j++){const a=s.players[i],q=s.players[j],dx=q.x-a.x,dy=q.y-a.y,l=Math.hypot(dx,dy);if(l<48){const nx=l?dx/l:1,ny=l?dy/l:0,over=(48-l)/2;a.x-=nx*over;a.y-=ny*over;q.x+=nx*over;q.y+=ny*over;}}
 if(b.owner!==null){const p=s.players[b.owner];b.x=clamp(p.x+Math.cos(p.heading)*32,44,916);b.y=clamp(p.y+Math.sin(p.heading)*32,60,500);b.vx=p.vx;b.vy=p.vy;}
 // Pickups/tackles are resolved nearest-first instead of seat order.
 const nearest=s.players.map((p,i)=>({p,i,d:Math.hypot(p.x-b.x,p.y-b.y)})).filter(q=>q.i!==b.owner&&q.d<36&&q.p.cooldown===0).sort((a,c)=>Math.abs(a.d-c.d)<.001?(a.i===s.goalSeq%2?-1:1):a.d-c.d);
 if(b.lock===0&&nearest.length){b.owner=nearest[0].i;b.lastTouch=b.owner;b.lock=.32;}
 s.players.forEach((p,i)=>{if(!cs[i].attack||p.cooldown>0||!(b.owner===i||Math.hypot(p.x-b.x,p.y-b.y)<48))return;const goalX=i?35:925,targetY=280+(Number(cs[i].down)-Number(cs[i].up))*62,dx=goalX-b.x,dy=targetY-b.y,l=Math.hypot(dx,dy)||1;b.owner=null;b.lastTouch=i;b.lock=.38;b.vx=dx/l*655;b.vy=dy/l*655;p.cooldown=.42;p.kick=.22;p.kicks++;});
 if(b.owner===null){for(let j=0;j<4;j++){b.x+=b.vx*dt/4;b.y+=b.vy*dt/4;if(b.y<59||b.y>501){b.y=clamp(b.y,59,501);b.vy*=-.78;}if(b.x<44||b.x>916){if(b.y>209&&b.y<351){const winner=b.x<44?1:0;s.players[winner].score++;s.goal=winner;s.goalSeq++;if(s.players[winner].score>=s.target||s.overtime){finish(s,[winner],s.overtime?'Golden goal!':'Five goals wins the match.');return;}soccerReset(s);return;}b.x=clamp(b.x,44,916);b.vx*=-.78;}}const drag=Math.exp(-.75*dt);b.vx*=drag;b.vy*=drag;}
 if(s.matchTime>=150&&!s.overtime){if(s.players[0].score!==s.players[1].score)ranked(s,s.players.map(p=>p.score),'Full time. Most goals wins.');else s.overtime=true;}
 if(s.matchTime>=210&&!s.finished)ranked(s,s.players.map(p=>p.score),'Full time after extra time.');
}
function advanceCats(s,cs,dt,finish){
 s.bursts=s.bursts.filter(b=>s.elapsed-b.at<.65);
 s.players.forEach((p,i)=>{const c=cs[i];if(c.up&&!p.upHeld)p.lane=Math.max(0,p.lane-1);if(c.down&&!p.downHeld)p.lane=Math.min(2,p.lane+1);p.upHeld=c.up;p.downHeld=c.down;p.y+=(catLanes[p.lane]-p.y)*Math.min(1,dt*14);p.shot=Math.max(0,p.shot-dt);p.bomb=Math.max(0,p.bomb-dt);p.shootTime=Math.max(0,p.shootTime-dt);
  if(p.shot===0&&s.enemies.some(e=>e.hp>0&&e.lane===p.lane&&e.x<=815)){p.shot=Math.max(.3,.62-p.level*.035);p.shootTime=.27;s.shots.push({id:s.nextId++,owner:i,x:p.x+30,y:catLanes[p.lane]-26,lane:p.lane,damage:14+(p.level-1)*5});}
  if(c.attack&&p.bomb===0){p.bomb=8;p.bombs++;p.shootTime=.4;s.bursts.push({id:s.nextId++,lane:p.lane,at:s.elapsed});for(const e of s.enemies)if(e.lane===p.lane)e.hp-=75+p.level*10;}
 });
 if(s.waveBreak>0){s.waveBreak-=dt;if(s.waveBreak<=0)spawnWave(s);}
 else if(s.spawned<s.toSpawn){s.spawnIn-=dt;if(s.spawnIn<=0){const boss=s.wave===5&&s.spawned===s.toSpawn-1,brute=!boss&&s.wave>1&&s.spawned%4===3,kind=boss?'boss':brute?'brute':'runner';s.enemies.push({id:s.nextId++,kind,x:945,y:0,lane:(s.spawned+Math.floor(s.spawned/3)+s.wave-1)%3,hp:boss?260+s.players.length*65:brute?72+s.wave*5:30+s.wave*3,maxHp:boss?260+s.players.length*65:brute?72+s.wave*5:30+s.wave*3,speed:boss?17:brute?25:40+s.wave*2,attack:0,hurt:0});s.spawned++;s.spawnIn=Math.max(.75,1.85-s.wave*.14)/Math.sqrt(s.players.length);}}
 for(const e of s.enemies){e.y=catLanes[e.lane];e.hurt=Math.max(0,e.hurt-dt);e.attack=Math.max(0,e.attack-dt);if(e.hp<=0)continue;if(e.x>300)e.x-=e.speed*dt;else if(e.attack===0){s.gate=Math.max(0,s.gate-(e.kind==='boss'?10:e.kind==='brute'?5:3));e.attack=1.2;}}
 for(const shot of s.shots){const before=shot.x;shot.x+=590*dt;const e=s.enemies.filter(e=>e.hp>0&&e.lane===shot.lane&&e.x>=before-20&&e.x<=shot.x+28).sort((a,b)=>a.x-b.x)[0];if(e){e.hp-=shot.damage;e.hurt=.18;shot.x=2000;e.lastHit=shot.owner;}}
 s.shots=s.shots.filter(a=>a.x<1050);
 const dead=s.enemies.filter(e=>e.hp<=0);for(const e of dead){s.kills++;const owner=e.lastHit??s.players.findIndex(p=>p.lane===e.lane),seat=Math.max(0,owner),value=e.kind==='boss'?10:e.kind==='brute'?3:1;s.players[seat].score++;s.coins.push({id:s.nextId++,x:e.x,y:e.y-30,at:s.elapsed,owner:seat,value});}
 s.enemies=s.enemies.filter(e=>e.hp>0);
 for(const coin of s.coins)if(!coin.collected&&s.elapsed-coin.at>=.75){coin.collected=true;const p=s.players[coin.owner];p.coins+=coin.value;s.gold+=coin.value;p.level=Math.min(5,1+Math.floor(p.coins/5));}
 s.coins=s.coins.filter(c=>s.elapsed-c.at<1.15);
 if(s.gate<=0)finish(s,[],`The barricade fell on wave ${s.wave}. Your cats collected ${s.gold} coins.`);
 else if(s.waveBreak<=0&&s.spawned>=s.toSpawn&&s.enemies.length===0){if(s.wave>=s.totalWaves)finish(s,s.players.map((_,i)=>i),'All five waves cleared. The cats saved the neighbourhood!');else{s.waveBreak=4;s.gate=Math.min(100,s.gate+12);}}
}
function advanceBridge(s,cs,dt,finish){
 const origin=s.from.x+s.from.w;
 for(let i=0;i<s.players.length;i++){const p=s.players[i],hold=cs[i].attack;if(!p.alive)continue;p.phaseTime+=dt;
  if(p.phase==='waiting'){if(hold){p.phase='stretching';p.phaseTime=0;}else if(s.decisionSeconds>0&&s.elapsed-s.roundAt>s.decisionSeconds){p.phase='falling';p.phaseTime=0;}}
  if(p.phase==='stretching'){if(hold){p.length=Math.min(450,p.length+200*dt);if(p.length>=450){p.phase='turning';p.phaseTime=0;}}else{p.phase='turning';p.phaseTime=0;}}
  else if(p.phase==='turning'){p.rotation=Math.min(Math.PI/2,p.rotation+Math.PI*1.25*dt);if(p.rotation>=Math.PI/2){const end=origin+p.length;p.hit=end>=s.to.x&&end<=s.to.x+s.to.w;p.perfect=p.hit&&Math.abs(end-(s.to.x+s.to.w/2))<=9;p.phase='walking';p.phaseTime=0;}}
  else if(p.phase==='walking'){p.x+=225*dt;const end=p.hit?s.to.x+s.to.w-14:origin+p.length+12;if(p.x>=end){p.x=end;p.phase=p.hit?'landed':'falling';p.phaseTime=0;if(p.hit){p.crossings++;p.score+=p.perfect?2:1;p.coins+=p.perfect?3:1;}}}
  else if(p.phase==='falling'){p.y+=Math.max(110,p.phaseTime*700)*dt;p.rotation=Math.min(Math.PI,p.rotation+dt*2.4);if(p.phaseTime>.7)p.alive=false;}
  p.held=hold;
 }
 const fallen=s.players.some(p=>!p.alive);
 if(fallen&&s.players.every(p=>!p.alive||p.phase==='landed')){const winners=s.players.flatMap((p,i)=>p.alive?[i]:[]);finish(s,winners,s.players.length===1?`${s.players[0].crossings} ${s.players[0].crossings===1?'bridge':'bridges'} crossed. Try to beat your best!`:winners.length?'The safe crossings win. Rematch for another run!':'Everyone missed. Rematch!');return;}
 if(!fallen&&s.players.every(p=>p.phase==='landed')){if(!s.nextRound)s.nextRound=s.elapsed+.75;else if(s.elapsed>=s.nextRound){s.round++;bridgeTarget(s);}}
}
export function advanceSocialWorld(s,cs,dt,finish,ranked){if(s.game==='pocket-soccer')advanceSoccer(s,cs,dt,finish,ranked);else if(s.game==='cat-defense')advanceCats(s,cs,dt,finish);else advanceBridge(s,cs,dt,finish);return s;}
export function socialWorldAction(s,seat,d){if(s.game==='cat-defense'&&d.type==='lane'&&Number.isInteger(d.lane)&&d.lane>=0&&d.lane<3){s.players[seat].lane=d.lane;return;}throw Error('Use the game controls.');}
export function socialWorldBot(s,i,c){const p=s.players[i];
 if(s.game==='pocket-soccer'){const b=s.ball,dir=i?-1:1;let x=b.x-dir*24,y=b.y;if(b.owner===i){x=i?190:770;y=280;}if(s.elapsed-s.kickoffAt<2.9){x=i?710:250;y=280;}c.left=p.x>x+8;c.right=p.x<x-8;c.up=p.y>y+9;c.down=p.y<y-9;c.attack=b.owner===i&&(i?p.x<600:p.x>360)&&s.tick%13<2;if(c.attack){c.up=Math.floor(s.tick/13)%2===0;c.down=!c.up;}return c;}
 if(s.game==='cat-defense'){const e=[...s.enemies].sort((a,b)=>a.x-b.x)[i%s.enemies.length];if(e){c.up=p.lane>e.lane&&!p.upHeld;c.down=p.lane<e.lane&&!p.downHeld;c.attack=e.x<460;}return c;}
 const target=s.to.x+s.to.w*(.38+rand(s.seed,s.round+i*23)*.24)-(s.from.x+s.from.w);c.attack=(p.phase==='waiting'&&s.elapsed-s.roundAt>.8)||(p.phase==='stretching'&&p.length<target);return c;
}
