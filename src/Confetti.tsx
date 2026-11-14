import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import './game-result.css';

type Particle={
 x:number;
 y:number;
 vx:number;
 vy:number;
 size:number;
 aspect:number;
 color:string;
 shape:'rect'|'ribbon'|'circle';
 rotation:number;
 vr:number;
 tilt:number;
 tiltSpeed:number;
 wobble:number;
 wobbleSpeed:number;
 age:number;
 life:number;
};

const PALETTE=['#f8df58','#fa8264','#c6b5ef','#a9d5e8','#deea9a','#e64332','#f7c839','#72b59a'];
const rand=(min:number,max:number)=>min+Math.random()*(max-min);

function createParticles(width:number,height:number):Particle[]{
 const list:Particle[]=[];
 const narrow=width<640;
 const speedScale=Math.max(0.75,Math.min(1.15,height/800));
 const add=(x:number,y:number,angleMin:number,angleMax:number,speedMin:number,speedMax:number,lifeMin:number,lifeMax:number)=>{
  const angle=rand(angleMin,angleMax);
  const speed=rand(speedMin,speedMax)*speedScale;
  const shapes:Particle['shape'][]=['rect','rect','ribbon','circle'];
  const shape=shapes[Math.floor(Math.random()*shapes.length)];
  list.push({
   x,
   y,
   vx:Math.cos(angle)*speed,
   vy:Math.sin(angle)*speed,
   size:shape==='circle'?rand(4,7):rand(7,12),
   aspect:shape==='ribbon'?rand(0.35,0.55):rand(0.55,0.9),
   color:PALETTE[Math.floor(Math.random()*PALETTE.length)],
   shape,
   rotation:rand(0,Math.PI*2),
   vr:rand(-6,6),
   tilt:rand(0,Math.PI*2),
   tiltSpeed:rand(4,9),
   wobble:rand(0,Math.PI*2),
   wobbleSpeed:rand(2.5,5),
   age:0,
   life:rand(lifeMin,lifeMax),
  });
 };

 const sideCount=narrow?26:34;
 const topCount=narrow?34:44;
 for(let i=0;i<sideCount;i++){
  add(width*(narrow?0.08:0.14),height*0.46,-Math.PI*0.44,-Math.PI*0.16,420,920,2.4,3.4);
  add(width*(narrow?0.92:0.86),height*0.46,-Math.PI*0.84,-Math.PI*0.56,420,920,2.4,3.4);
 }
 for(let i=0;i<topCount;i++){
  add(rand(width*0.12,width*0.88),rand(-30,height*0.12),Math.PI*0.25,Math.PI*0.75,90,320,2.5,3.7);
 }
 return list;
}

export default function Confetti({active}:{active:boolean}){
 const canvasRef=useRef<HTMLCanvasElement>(null);

 useEffect(()=>{
  if(!active||typeof window==='undefined')return;
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  const canvas=canvasRef.current;
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  if(!ctx)return;

  let width=window.innerWidth;
  let height=window.innerHeight;
  let dpr=Math.min(window.devicePixelRatio||1,2);
  const resize=()=>{
   width=window.innerWidth;
   height=window.innerHeight;
   dpr=Math.min(window.devicePixelRatio||1,2);
   canvas.width=Math.max(1,Math.floor(width*dpr));
   canvas.height=Math.max(1,Math.floor(height*dpr));
  };
  resize();
  window.addEventListener('resize',resize);

  const particles=createParticles(width,height);
  let raf=0;
  let last=performance.now();

  const frame=(now:number)=>{
   const dt=Math.min(0.05,Math.max(0.001,(now-last)/1000));
   last=now;

   ctx.setTransform(dpr,0,0,dpr,0,0);
   ctx.clearRect(0,0,width,height);

   const drag=Math.pow(0.984,dt*60);
   let alive=0;

   for(const p of particles){
    p.age+=dt;
    if(p.age>=p.life||p.y>height+40)continue;
    alive++;

    p.vx*=drag;
    p.vy=p.vy*drag+540*dt;
    p.wobble+=p.wobbleSpeed*dt;
    p.x+=p.vx*dt+Math.sin(p.wobble)*32*dt;
    p.y+=p.vy*dt;
    p.rotation+=p.vr*dt;
    p.tilt+=p.tiltSpeed*dt;

    const fadeStart=p.life*0.68;
    const alpha=p.age>fadeStart?Math.max(0,1-(p.age-fadeStart)/(p.life-fadeStart)):1;

    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.translate(p.x,p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle=p.color;

    if(p.shape==='circle'){
     ctx.beginPath();
     ctx.arc(0,0,p.size*0.5,0,Math.PI*2);
     ctx.fill();
    }else{
     const tiltScale=Math.cos(p.tilt);
     const w=p.size;
     const h=p.size*p.aspect*Math.max(0.25,Math.abs(tiltScale));
     ctx.fillRect(-w/2,-h/2,w,h);
    }
    ctx.restore();
   }

   if(alive>0)raf=requestAnimationFrame(frame);
   else ctx.clearRect(0,0,width,height);
  };

  raf=requestAnimationFrame(frame);
  return()=>{
   cancelAnimationFrame(raf);
   window.removeEventListener('resize',resize);
  };
 },[active]);

 if(!active||typeof document==='undefined')return null;
 return createPortal(<canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true"/>,document.body);
}
