import {WorldSnapshots} from './world-snapshots.mjs';
import type {WorldMetrics} from './world-renderer';
import {idlePose,travelPose,guardPose,recoilPose,airbornePose,fallenPose,sampleAttackPose,mixPose,fitAttackReach,jumpFlipAngle} from './stick-poses';
import type {StickPose} from './stick-poses';

const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const ink=['#307ae8','#171722'];
const accents=['#93c5ff','#eee8e0'];
const TAU=Math.PI*2;
type Trail={pose:StickPose;x:number;y:number;facing:number;age:number;rotation:number};
type Animation={seq:number;kind:string;duration:number;age:number;stride:number;lastX:number;pose:StickPose;trail:Trail[];trailAge:number;ko:number;flip:number;flipping:boolean};
type Burst={id:number;x:number;y:number;kind:string;dir:number;age:number;life:number;label:string};
type Drop={x:number;y:number;vx:number;vy:number;age:number;life:number;r:number};
type Stain={x:number;r:number;life:number};
let terrace:Promise<HTMLImageElement>|undefined;
export class StickRenderer {
 private canvas=document.createElement('canvas');
 private ctx:CanvasRenderingContext2D;
 private snapshots=new WorldSnapshots();
 private resize:ResizeObserver;
 private observer:IntersectionObserver;
 private anims:Animation[]=[];
 private bursts:Burst[]=[];
 private drops:Drop[]=[];
 private stains:Stain[]=[];
 private frame=0;private last=0;private elapsed=0;private seenImpact=0;private round=0;
 private finishAge=0;private freeze=0;private shake=0;private blood=true;private visible=true;private disposed=false;
 private width=960;private height=540;private ratio=1;private center=480;private zoom=1.6;
 private sampleAt=0;private frames=0;private frameTimes:number[]=[];
 private reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
 constructor(private host:HTMLElement,state:any,_seat:number|null,private metrics:(m:WorldMetrics)=>void,private background:HTMLImageElement){
  const ctx=this.canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('The 2D canvas could not start.');this.ctx=ctx;
  this.canvas.setAttribute('aria-label','2D Yokai Duel — animated stick fighters on the vampire terrace');this.canvas.dataset.renderer='canvas-2d';
  this.canvas.style.width='100%';this.canvas.style.height='100%';this.canvas.style.display='block';host.appendChild(this.canvas);host.dataset.assetPack='craftpix-yokai-2d';
  this.round=state.round;this.center=(state.players[0].x+state.players[1].x)/2;this.sampleAt=performance.now();
  this.resetAnimations(state);this.snapshots.push(state,performance.now());
  this.resize=new ResizeObserver(()=>{this.size();this.render(this.snapshots.latest,0);});this.resize.observe(host);this.size();
  this.observer=new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;});this.observer.observe(host);
  this.render(state,0);this.frame=requestAnimationFrame(this.draw);
 }
 static prepare():Promise<HTMLImageElement>{
  return terrace??=new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('The terrace artwork could not load.'));image.src='/models/fighters/vampire-terrace.webp';}).catch(e=>{terrace=undefined;throw e;});
 }
 push(state:any,_seat:number|null){this.snapshots.push(state,performance.now());}
 setBlood(enabled:boolean){this.blood=enabled;if(!enabled){this.drops=[];this.stains=[];}}
 setAim(_angle:number,_power:number){}
 setCamera(_mode:string){}
 aimAt(_x:number,_y:number):{angle:number;power:number}|null{return null;}
 private resetAnimations(state:any){this.anims=state.players.map((p:any)=>({seq:p.attackSeq||0,kind:p.attackKind||'punch',duration:p.attackDuration||.22,age:1,stride:0,lastX:p.x,pose:idlePose(0),trail:[],trailAge:0,ko:0,flip:0,flipping:false}));}
 private size(){
  const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;
  this.ratio=Math.min(devicePixelRatio||1,2);this.width=w;this.height=h;
  this.canvas.width=Math.round(w*this.ratio);this.canvas.height=Math.round(h*this.ratio);
 }
 private draw=(now:number)=>{
  if(this.disposed)return;this.frame=requestAnimationFrame(this.draw);
  const ms=this.last?now-this.last:16.7,dt=Math.min(.04,Math.max(0,ms/1000));this.last=now;
  if(document.hidden||!this.visible){this.sampleAt=now;this.frames=0;this.frameTimes=[];return;}
  const s=this.snapshots.sample(now);if(!s)return;this.elapsed+=dt;
  this.render(s,dt);this.frames++;this.frameTimes.push(ms);
  if(now-this.sampleAt>1500){
   this.metrics({fps:Math.round(this.frames*1000/(now-(this.sampleAt||now-1500))),drawCalls:1,triangles:0,quality:'2D',frameP95:[...this.frameTimes].sort((a,b)=>a-b)[Math.floor(this.frameTimes.length*.95)]||0,geometries:0,textures:1});
   this.sampleAt=now;this.frames=0;this.frameTimes=[];
  }
 };
 private render(s:any,dt:number){
  if(!s)return;
  if(s.round!==this.round){this.round=s.round;this.bursts=[];this.drops=[];this.stains=[];this.freeze=0;this.resetAnimations(s);}
  this.finishAge=s.finished?this.finishAge+dt:0;
  const motionDt=this.freeze>0?0:dt;this.freeze=Math.max(0,this.freeze-dt);
  s.players.forEach((p:any,i:number)=>{
   const a=this.anims[i];
   if(a.seq!==p.attackSeq){a.seq=p.attackSeq;a.kind=p.attackKind;a.duration=p.attackDuration||.22;a.age=Math.max(0,a.duration-(p.attack||0));}
   else a.age+=motionDt;
   const dx=p.x-a.lastX;a.lastX=p.x;if(Math.abs(dx)<50)a.stride+=Math.abs(dx);
   if(p.hurtTimer>0||p.hp<=0)a.age=a.duration;
   a.ko=p.hp<=0?a.ko+motionDt:0;
   if(p.airFlip>0&&!a.flipping)a.flip=.32;a.flipping=p.airFlip>0;a.flip=Math.max(0,a.flip-motionDt);
   if(p.hurtTimer>0||p.stun>0||p.tumble>0||p.hp<=0)a.flip=0;
  });
  for(const imp of s.impacts||[]){
   if(imp.id<=this.seenImpact)continue;this.seenImpact=imp.id;if(imp.age>.25)continue;
   this.hit(imp);
   if(['hit','heavy','ko','parry'].includes(imp.kind)){
    this.freeze=imp.kind==='hit'?.035:imp.kind==='ko'?.075:.05;this.shake=this.reducedMotion?0:imp.kind==='hit'?2:4;
    const a=this.anims[imp.owner];if(a&&a.age<a.duration*.36)a.age=a.duration*.36;
   }
  }
  const ctx=this.ctx,W=960,H=this.height/Math.max(1,this.width)*W,floor=H*.77,scale=this.canvas.width/W;
  ctx.setTransform(scale,0,0,scale,0,0);ctx.globalAlpha=1;ctx.fillStyle='#1c1428';ctx.fillRect(0,0,W,H);
  // The original terrace remains a complete, flat painted backdrop.
  ctx.drawImage(this.background,0,0,W,H);
  const a=s.players[0],b=s.players[1],gap=Math.abs(a.x-b.x),air=Math.max(0,410-Math.min(a.y,b.y));
  const desiredZoom=Math.min(clamp(760/(gap+190),.88,1.9),(floor-82)/(air+120));
  const blend=dt?1-Math.exp(-dt*4):1;
  this.zoom=lerp(this.zoom,desiredZoom,blend);this.center=lerp(this.center,(a.x+b.x)/2,blend);
  this.shake=Math.max(0,this.shake-dt*36);
  ctx.save();ctx.translate(W/2+Math.sin(this.elapsed*110)*this.shake,floor+Math.cos(this.elapsed*139)*this.shake*.5);ctx.scale(this.zoom,this.zoom);ctx.translate(-this.center,-410);
  for(const stain of this.stains){ctx.globalAlpha=Math.min(.55,stain.life*.3);ctx.fillStyle='#741b32';ctx.beginPath();ctx.ellipse(stain.x,411,stain.r*2.4,stain.r*.48,0,0,TAU);ctx.fill();}ctx.globalAlpha=1;
  s.players.forEach((p:any,i:number)=>this.shadow(p,this.anims[i]));
  s.players.forEach((p:any,i:number)=>{
   const a=this.anims[i],active=a.age<a.duration,progress=clamp(a.age/a.duration,0,1);
   let target:StickPose;
   const settled=p.ground||(s.finished&&this.finishAge>.5);
   if(p.hp<=0)target=settled?fallenPose():mixPose(recoilPose('kick',1),fallenPose(),clamp(a.ko/.3,0,1));
   else if(s.finished)target=idlePose(this.elapsed+i*.7);
   else if(p.hurtTimer>0||p.stun>0)target=recoilPose(p.hurtKind||'cross',clamp((p.hurtTimer||p.stun)/.16,.25,1));
   else if(p.tumble>0)target=p.ground?mixPose(fallenPose(),idlePose(this.elapsed),1-clamp(p.tumble/.16,0,1)):recoilPose(p.hurtKind||'cross',.8);
   else if(p.parryPose>0)target=guardPose(this.elapsed,0,1);
   else if(active)target=fitAttackReach(sampleAttackPose(a.kind,progress),a.kind,(s.players[1-i].x-p.x)*p.facing);
   else if(p.blocking&&!(p.dashTimer>0))target=guardPose(this.elapsed,clamp((p.guardHit||0)/.18,0,1));
   else if(!p.ground)target=airbornePose(p.vy);
   else if(Math.abs(p.vx)>16)target=travelPose(a.stride,p.vx*p.facing<0?-1:1,p.dashTimer>0);
   else target=idlePose(this.elapsed+i*.7);
   a.pose=active||p.hp<=0?target:mixPose(a.pose,target,dt?1-Math.exp(-motionDt*32):1);
   // Final KO snapshots stop simulating: visually settle the body onto the floor.
   const y=s.finished?lerp(p.y,410,clamp(this.finishAge/.5,0,1)):p.y;
   const rotation=jumpFlipAngle(p,a.flip);
   for(const tr of a.trail){tr.age+=dt;if(tr.age<.13)this.figure(tr.pose,tr.x,tr.y,tr.facing,ink[i],(.13-tr.age)*1.15,tr.rotation,false);}
   a.trail=a.trail.filter(tr=>tr.age<.13);
   if(!this.reducedMotion&&(p.dashTimer>0||active&&['divekick','kick','roundhouse','frontkick'].includes(a.kind))){
    a.trailAge+=dt;if(a.trailAge>.025){a.trailAge=0;a.trail.push({pose:a.pose,x:p.x,y,facing:p.facing,age:0,rotation});if(a.trail.length>5)a.trail.shift();}
   }
   if(active&&progress>.25&&progress<.68)this.smear(p,a);
   this.figure(a.pose,p.x,y,p.facing,ink[i],1,rotation,true);
   if(p.dashTimer>0)this.speedLines(p,ink[i]);
  });
  for(const beam of s.beams||[])this.beam(beam);
  for(const burst of this.bursts)this.burst(burst);
  for(const d of this.drops){ctx.globalAlpha=clamp((d.life-d.age)*5,0,1);ctx.strokeStyle=d.r>1.6?'#b71d3b':'#e64658';ctx.lineWidth=d.r;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(d.x,d.y);ctx.lineTo(d.x-d.vx*.018,d.y-d.vy*.018);ctx.stroke();}ctx.globalAlpha=1;
  ctx.restore();this.updateEffects(dt);
 }
 private figure(p:StickPose,x:number,y:number,facing:number,color:string,alpha:number,rotation:number,outline:boolean){
  const c=this.ctx;c.save();c.translate(x,y);c.scale(facing||1,1);
  if(rotation){c.translate(p.hip[0],p.hip[1]);c.rotate(rotation);c.translate(-p.hip[0],-p.hip[1]);}
  c.globalAlpha=alpha;c.lineCap='round';c.lineJoin='round';
  const body=new Path2D();
  for(const [knee,foot] of [[p.rearKnee,p.rearFoot],[p.leadKnee,p.leadFoot]]){body.moveTo(...p.hip);body.lineTo(...knee);body.lineTo(...foot);}
  const arms=new Path2D();
  for(const [elbow,hand] of [[p.rearElbow,p.rearHand],[p.leadElbow,p.leadHand]]){arms.moveTo(...p.shoulder);arms.lineTo(...elbow);arms.lineTo(...hand);}
  const spine=new Path2D();spine.moveTo(...p.hip);spine.quadraticCurveTo(...p.waist,...p.shoulder);spine.lineTo(p.head[0],p.head[1]+7);
  // A narrow paper edge keeps the black silhouette legible on the supplied dark terrace.
  if(outline){c.strokeStyle='rgba(238,231,218,.5)';c.lineWidth=8.6;c.stroke(body);c.lineWidth=8;c.stroke(arms);c.lineWidth=10.5;c.stroke(spine);c.fillStyle='rgba(238,231,218,.5)';c.beginPath();c.arc(...p.head,11,0,TAU);c.fill();}
  c.strokeStyle=color;c.fillStyle=color;c.lineWidth=7.4;c.stroke(body);c.lineWidth=6.9;c.stroke(arms);c.lineWidth=9.5;c.stroke(spine);c.beginPath();c.arc(...p.head,10.5,0,TAU);c.fill();c.restore();
 }
 private shadow(p:any,a:Animation){
  const c=this.ctx,altitude=Math.max(0,410-p.y),opacity=.24*clamp(1-altitude/240,.22,1);
  c.save();c.translate(p.x,412);c.scale(1+altitude/220,1);const g=c.createRadialGradient(0,0,2,0,0,43);g.addColorStop(0,`rgba(10,4,18,${opacity})`);g.addColorStop(1,'rgba(10,4,18,0)');c.fillStyle=g;c.scale(1,.18);c.beginPath();c.arc(0,0,43,0,TAU);c.fill();c.restore();
  if(p.ground&&p.hp>0)for(const foot of [a.pose.rearFoot,a.pose.leadFoot])if(foot[1]>-3){c.fillStyle='rgba(12,5,19,.3)';c.beginPath();c.ellipse(p.x+foot[0]*p.facing,412,7,1.7,0,0,TAU);c.fill();}
 }
 private smear(p:any,a:Animation){
  const c=this.ctx,u=a.age/a.duration,kick=['kick','roundhouse','frontkick','sweep','divekick'].includes(a.kind),point=kick?a.pose.leadFoot:a.kind==='cross'?a.pose.rearHand:a.pose.leadHand;
  if(['throw','blast'].includes(a.kind))return;
  c.save();c.translate(p.x,p.y);c.scale(p.facing,1);c.globalAlpha=Math.sin(clamp((u-.23)/.5,0,1)*Math.PI)*.65;c.strokeStyle='#fff6dc';c.lineCap='round';
  if(kick){for(let n=0;n<3;n++){c.lineWidth=n===0?2.2:.7;c.beginPath();c.moveTo(point[0]-31,point[1]+24+n*5);c.quadraticCurveTo(point[0]-8,point[1]+16+n*2,point[0]+6,point[1]-3-n*3);c.stroke();}}
  else for(let n=0;n<3;n++){c.lineWidth=n===0?1.6:.65;c.beginPath();c.moveTo(point[0]-34-n*4,point[1]-5+n*5);c.lineTo(point[0]-5,point[1]-5+n*4);c.stroke();}
  c.restore();
 }
 private speedLines(p:any,color:string){const c=this.ctx;c.save();c.strokeStyle=color;c.globalAlpha=.4;c.lineWidth=1.8;for(let n=0;n<4;n++){c.beginPath();c.moveTo(p.x-p.facing*(32+n*4),p.y-82+n*18);c.lineTo(p.x-p.facing*(65+n*9),p.y-82+n*18);c.stroke();}c.restore();}
 private beam(b:any){const c=this.ctx;c.save();c.translate(b.x,b.y);c.scale(b.facing,1);c.strokeStyle=ink[b.owner%2];c.lineWidth=17;c.lineCap='round';c.beginPath();c.moveTo(-54,0);c.lineTo(0,0);c.stroke();c.strokeStyle='#f3f7ff';c.lineWidth=7;c.stroke();c.strokeStyle=accents[b.owner%2];c.lineWidth=1.4;for(const offset of [-13,13]){c.beginPath();c.moveTo(-75,offset*.7);c.quadraticCurveTo(-20,offset*1.4,10,0);c.stroke();}c.restore();}
 private hit(imp:any){
  if(!['hit','heavy','ko','block','parry','break','slam','dodge'].includes(imp.kind))return;
  this.bursts.push({id:imp.id,x:imp.x,y:imp.y,dir:imp.dir||1,kind:imp.kind,age:0,life:['parry','ko','break'].includes(imp.kind)?.4:.25,label:imp.kind==='parry'?'PARRY':imp.kind==='ko'?'K.O.':imp.kind==='break'?'BREAK':imp.kind==='dodge'?'MISS':imp.kind==='heavy'?'WHAM':''});if(this.bursts.length>20)this.bursts.shift();
  if(this.blood&&['hit','heavy','ko'].includes(imp.kind))for(let n=0;n<(imp.kind==='hit'?11:21);n++){
   const seed=Math.sin((imp.id*31+n*17)*12.9898)*43758.5453,r=seed-Math.floor(seed),v=Math.sin(n*37+imp.id)*.5+.5;
   this.drops.push({x:imp.x,y:imp.y,vx:imp.dir*(70+r*230),vy:-50-v*180,age:0,life:.45+r*.4,r:.8+v*1.7});
  }
  if(this.drops.length>120)this.drops.splice(0,this.drops.length-120);
 }
 private burst(b:Burst){
  const c=this.ctx,u=b.age/b.life;c.save();c.translate(b.x,b.y);c.globalAlpha=clamp((1-u)*2,0,1);
  if(b.kind==='slam'){
   c.strokeStyle='#eee1d2';c.lineWidth=1.4;for(let n=0;n<9;n++){const a=n/9*TAU;c.beginPath();c.moveTo(Math.cos(a)*10,Math.sin(a)*3);c.lineTo(Math.cos(a)*(18+u*42),Math.sin(a)*(5+u*13));c.stroke();}
  }else if(b.kind!=='dodge'){
   const guard=['block','parry'].includes(b.kind),r=(guard?13:b.kind==='hit'?15:20)*(1+u*.45);
   c.rotate(b.id*.7);c.beginPath();for(let n=0;n<24;n++){const angle=n/24*TAU,d=n%2?5:r*(.6+(n%5)*.1);c.lineTo(Math.cos(angle)*d,Math.sin(angle)*d);}c.closePath();c.lineWidth=2;c.strokeStyle='#211520';c.fillStyle=guard?'#bcdcff':'#fff8db';c.stroke();c.fill();c.rotate(-b.id*.7);
   c.strokeStyle=guard?'#eef5ff':'#fff1cb';c.lineWidth=.9;for(let n=0;n<7;n++){const angle=n/7*TAU+.25;c.beginPath();c.moveTo(Math.cos(angle)*(r+4),Math.sin(angle)*(r+4));c.lineTo(Math.cos(angle)*(r+13+u*15),Math.sin(angle)*(r+13+u*15));c.stroke();}
  }
  if(b.label){c.translate(b.dir*6,-34-u*8);c.rotate(-.1*b.dir);c.font='italic 900 19px system-ui';c.textAlign='center';c.lineJoin='round';c.lineWidth=3.5;c.strokeStyle='#221525';c.strokeText(b.label,0,0);c.fillStyle=b.kind==='parry'?'#bcdcff':'#fff0cf';c.fillText(b.label,0,0);}
  c.restore();
 }
 private updateEffects(dt:number){
  this.bursts=this.bursts.filter(b=>(b.age+=dt)<b.life);
  this.drops=this.drops.filter(d=>{d.age+=dt;d.vy+=650*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;if(d.y>=411){this.stains.push({x:d.x,r:d.r,life:2.7});if(this.stains.length>35)this.stains.shift();return false;}return d.age<d.life;});
  this.stains=this.stains.filter(s=>(s.life-=dt)>0);
 }
 dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.resize.disconnect();this.observer.disconnect();this.canvas.remove();this.bursts=[];this.drops=[];this.stains=[];this.anims=[];}
}
