// Original flight rules; artwork is Kenney's CC0 Tappy Plane pack.
export const FLIGHT = Object.freeze({width:800,height:480,ground:430,x:170,gravity:780,lift:-275,radiusX:22,radiusY:15});
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const noise=(seed,id)=>{let x=(seed^Math.imul(id+1,2654435761))>>>0;x=Math.imul(x^(x>>>16),2246822507);return ((x^(x>>>13))>>>0)/4294967296;};

function extendCourse(s){
 while(!s.gates.length||s.gates.at(-1).x<s.scroll+1500){
  const id=s.nextGate++,previous=s.gates.at(-1),gap=Math.max(148,194-id*.85);
  const center=clamp((previous?.center??220)+(noise(s.seed,id)-.5)*115,45+gap/2,FLIGHT.ground-45-gap/2);
  s.gates.push({id,x:previous?previous.x+310:640,width:96,center,gap});
 }
 s.gates=s.gates.filter(g=>g.x+g.width>s.scroll-100);
}
export function newTappyWorld(s,n){
 s.seed=Math.floor(Math.random()*2147483647);s.scroll=0;s.speed=165;s.nextGate=0;s.gates=[];s.waiting=n===1;
 s.players=Array.from({length:n},()=>({x:FLIGHT.x,y:220,vy:0,alive:true,score:0,gates:0,stars:0,lastGate:-1,lastStar:-1,cooldown:0,flapHeld:false,pendingFlap:false,flaps:0,deathReason:null}));
 extendCourse(s);
}
export function tappyAction(s,i,d){
 if(d.type!=='flap'||Object.keys(d).some(key=>key!=='type'))throw Error('Tap to flap. Scores and positions are set by the game.');
 const p=s.players[i];if(!p?.alive)throw Error('Your flight has ended. Watch the other pilots or play again.');
 p.pendingFlap=true;
}

// Inset outlines follow the two tapered rock sprites. The plane uses a forgiving
// ellipse, so transparent corners and wing tips do not cause phantom collisions.
const upper=[[.025,0],[.975,0],[.80,.48],[.66,.99],[.60,.99],[.35,.48]];
const lower=[[.59,.015],[.66,.015],[.76,.43],[.80,.44],[.87,.76],[.97,1],[.03,1],[.20,.69],[.27,.55],[.35,.53]];
function touchesRock(p,points){
 const shape=points.map(([x,y])=>[(x-p.x)/FLIGHT.radiusX,(y-p.y)/FLIGHT.radiusY]);
 let inside=false;
 for(let i=0,j=shape.length-1;i<shape.length;j=i++){
  const [ax,ay]=shape[j],[bx,by]=shape[i],dx=bx-ax,dy=by-ay;
  if((ay>0)!==(by>0)&&0<(bx-ax)*(-ay)/(by-ay)+ax)inside=!inside;
  const t=clamp(-(ax*dx+ay*dy)/(dx*dx+dy*dy||1),0,1);
  if((ax+t*dx)**2+(ay+t*dy)**2<=1)return true;
 }
 return inside;
}
function rockCollision(p,g,scroll){
 const left=g.x-scroll-g.width/2,top=g.center-g.gap/2,bottom=g.center+g.gap/2;
 if(p.x+FLIGHT.radiusX<left||p.x-FLIGHT.radiusX>left+g.width)return false;
 return touchesRock(p,upper.map(([x,y])=>[left+x*g.width,y*top]))||touchesRock(p,lower.map(([x,y])=>[left+x*g.width,bottom+y*(FLIGHT.ground-bottom)]));
}
export function advanceTappyWorld(s,cs,dt,finish){
 if(s.waiting){
  s.elapsed=0;
  if(!s.players[0].pendingFlap&&!cs[0].attack&&!cs[0].up)return s;
  s.waiting=false;
 }
 s.speed=Math.min(225,165+s.elapsed*.55);
 for(let i=0;i<s.players.length;i++){
  const p=s.players[i],held=cs[i].attack||cs[i].up;
  p.cooldown=Math.max(0,p.cooldown-dt);
  if(p.alive&&(p.pendingFlap||held&&!p.flapHeld)&&p.cooldown<=0){p.vy=FLIGHT.lift;p.cooldown=.12;p.flaps++;}
  p.pendingFlap=false;p.flapHeld=held;
 }
 // Five small collision steps prevent tunnelling at low snapshot rates.
 for(let step=0;step<5;step++){
  const delta=dt/5;s.scroll+=s.speed*delta;
  for(const p of s.players){
   if(!p.alive)continue;
   p.vy=Math.min(420,p.vy+FLIGHT.gravity*delta);p.y+=p.vy*delta;
   const hit=p.y-FLIGHT.radiusY<=0?'the sky boundary':p.y+FLIGHT.radiusY>=FLIGHT.ground?'the ground':s.gates.some(g=>rockCollision(p,g,s.scroll))?'a rock':null;
   if(hit){p.alive=false;p.deathReason=hit;p.y=clamp(p.y,FLIGHT.radiusY,FLIGHT.ground-FLIGHT.radiusY);continue;}
   for(const g of s.gates){
    const x=g.x-s.scroll;
    if(g.id>p.lastStar&&Math.hypot((x-p.x)/1.2,g.center-p.y)<31){p.lastStar=g.id;p.stars++;p.score+=3;}
    if(g.id>p.lastGate&&x+g.width/2<p.x-FLIGHT.radiusX){p.lastGate=g.id;p.gates++;p.score++;}
   }
  }
 }
 extendCourse(s);
 const alive=s.players.flatMap((p,i)=>p.alive?[i]:[]);
 if(!alive.length){
  if(s.players.length===1)finish(s,[],`Flight complete: ${s.players[0].score} points · ${s.players[0].gates} gates · ${s.players[0].stars} stars.`);
  else finish(s,[], 'Every remaining plane crashed together. It’s a draw!');
 }else if(s.players.length>1&&alive.length===1)finish(s,alive,`Player ${alive[0]+1} is the last plane flying!`);
 return s;
}
export function tappyBot(s,i,c){
 const p=s.players[i],next=s.gates.find(g=>g.x-s.scroll+g.width/2>p.x-FLIGHT.radiusX),target=next?.center??220;
 c.attack=s.waiting||p.alive&&!p.flapHeld&&p.vy>0&&p.y+p.vy*.12>target+12;
 return c;
}
