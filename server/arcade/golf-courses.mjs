// Server and renderer share the same playable tiles, rails and obstacle footprints.
export const GOLF_BALL_RADIUS=5.5;
export const GOLF_CUP_RADIUS=6.667;
const row=(y,a,b)=>Array.from({length:Math.abs(b-a)+1},(_,i)=>[a+Math.sign(b-a||1)*i,y]);
const col=(x,a,b)=>Array.from({length:Math.abs(b-a)+1},(_,i)=>[x,a+Math.sign(b-a||1)*i]);
const courses=[
 {name:'Garden welcome',par:2,cells:[...row(2,1,6),...row(1,1,6)],tee:[1,2],cup:[6,1],obstacles:[]},
 {name:'Around the bend',par:3,cells:[...row(4,1,6),...col(6,3,0)],obstacles:[]},
 {name:'Diamond avenue',par:3,cells:[...row(3,0,8),...row(2,0,8)],tee:[0,3],cup:[8,3],obstacles:[{kind:'diamond',cx:3,cy:3,scale:1},{kind:'diamond',cx:5,cy:2,scale:1}]},
 {name:'The switchback',par:6,cells:[...row(4,0,7),[7,3],...row(2,7,1),[1,1],...row(0,1,8)],obstacles:[]},
 {name:'Castle passage',par:3,cells:row(2,0,8),obstacles:[{kind:'tunnel',cx:4,cy:2,scale:1,rotation:Math.PI/2}]},
 {name:'The final bank',par:5,cells:[...row(4,0,8),...col(8,3,0),...row(0,7,1)],obstacles:[{kind:'diamond',cx:4,cy:4,scale:.65},{kind:'diamond',cx:4,cy:0,scale:.65}]},
];
const center=([x,y])=>({x:80+x*100,y:80+y*100});
export const golfCourses=courses.map((c,index)=>{
 const cells=[...new Map(c.cells.map(p=>[p.join(','),p])).values()],keys=new Set(cells.map(p=>p.join(','))),walls=[];
 for(const [x,y] of cells)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(!keys.has(`${x+dx},${y+dy}`)){
  const p=center([x,y]);walls.push({x:p.x+dx*45-(dy?50:5),y:p.y+dy*45-(dx?50:5),w:dy?100:10,h:dx?100:10});
 }
 const obstacles=c.obstacles.map(o=>({...o,...center([o.cx,o.cy])}));
 for(const o of obstacles){if(o.kind==='tunnel'){
  // Arch runs along X after the quarter turn. Ball center must stay in its passage.
  walls.push({x:o.x-40,y:o.y-40,w:80,h:28},{x:o.x-40,y:o.y+12,w:80,h:28});
 }}
 return {...c,index,cells:cells.map(center),tee:center(c.tee||cells[0]),cup:center(c.cup||cells.at(-1)),walls,obstacles};
});
export function resetGolfHole(s){const course=golfCourses[s.hole];s.courseName=course.name;s.par=course.par;s.holeCount=golfCourses.length;s.cup={...course.cup};s.players.forEach(p=>Object.assign(p,{...course.tee,vx:0,vy:0,strokes:0,sunk:false}));}
function bounceWall(p,w){const r=GOLF_BALL_RADIUS,x=Math.max(w.x,Math.min(w.x+w.w,p.x)),y=Math.max(w.y,Math.min(w.y+w.h,p.y)),dx=p.x-x,dy=p.y-y,d=Math.hypot(dx,dy);if(d>=r)return;
 let nx,ny,penetration;if(d>1e-8){nx=dx/d;ny=dy/d;penetration=r-d;}else{const candidates=[[p.x-w.x,-1,0],[w.x+w.w-p.x,1,0],[p.y-w.y,0,-1],[w.y+w.h-p.y,0,1]].sort((a,b)=>a[0]-b[0]);[,nx,ny]=candidates[0];penetration=candidates[0][0]+r;}
 p.x+=nx*(penetration+.001);p.y+=ny*(penetration+.001);const dot=p.vx*nx+p.vy*ny;if(dot<0){p.vx-=1.72*dot*nx;p.vy-=1.72*dot*ny;}
}
function bounceDiamond(p,o){
 const r=24.7591*o.scale,b=1.7678*o.scale,vertices=[[b,-r],[r,-b],[r,b],[b,r],[-b,r],[-r,b],[-r,-b],[-b,-r]].map(([x,y])=>[x+o.x,y+o.y]);let closest=null,best=Infinity,inside=true;
 for(let i=0;i<vertices.length;i++){const a=vertices[i],b=vertices[(i+1)%vertices.length],dx=b[0]-a[0],dy=b[1]-a[1];if(dx*(p.y-a[1])-dy*(p.x-a[0])<0)inside=false;const t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.y-a[1])*dy)/(dx*dx+dy*dy))),x=a[0]+dx*t,y=a[1]+dy*t,d=Math.hypot(p.x-x,p.y-y);if(d<best){best=d;closest={x,y,dx,dy};}}
 if(!inside&&best>=GOLF_BALL_RADIUS)return;let nx,ny;if(best>1e-7){nx=(p.x-closest.x)/best*(inside?-1:1);ny=(p.y-closest.y)/best*(inside?-1:1);}else{const length=Math.hypot(closest.dx,closest.dy);nx=closest.dy/length;ny=-closest.dx/length;}
 const penetration=GOLF_BALL_RADIUS+(inside?best:-best);p.x+=nx*(penetration+.001);p.y+=ny*(penetration+.001);const dot=p.vx*nx+p.vy*ny;if(dot<0){p.vx-=1.72*dot*nx;p.vy-=1.72*dot*ny;}
}
export function advanceGolf(s,dt,ranked){
 const course=golfCourses[s.hole];if(!course)return;
 if(s.moving){const p=s.players[s.turn],steps=Math.max(1,Math.ceil(Math.hypot(p.vx,p.vy)*dt/3)),step=dt/steps;
  for(let i=0;i<steps&&!p.sunk;i++){p.x+=p.vx*step;p.y+=p.vy*step;for(const wall of course.walls)bounceWall(p,wall);for(const o of course.obstacles)if(o.kind==='diamond')bounceDiamond(p,o);
   if(Math.hypot(p.x-s.cup.x,p.y-s.cup.y)<GOLF_CUP_RADIUS&&Math.hypot(p.vx,p.vy)<110){p.sunk=true;p.x=s.cup.x;p.y=s.cup.y;p.vx=p.vy=0;}
  }
  const friction=Math.exp(-1.15*dt);p.vx*=friction;p.vy*=friction;
  if(Math.hypot(p.vx,p.vy)<3||p.sunk){p.vx=p.vy=0;s.moving=false;if(p.strokes>=10)p.sunk=true;
   if(s.players.every(q=>q.sunk)){s.players.forEach(q=>{q.total+=q.strokes;q.holes=[...(q.holes||[]),q.strokes];});s.hole++;
    if(s.hole===golfCourses.length)ranked(s,s.players.map(q=>q.total),'Fewest strokes across six garden holes.',true);else{s.turn=s.hole%s.players.length;resetGolfHole(s);}
   }else{do{s.turn=(s.turn+1)%s.players.length;}while(s.players[s.turn].sunk);}
  }
 }
 if(s.elapsed>=480&&!s.finished)ranked(s,s.players.map(p=>p.total+(p.sunk?p.strokes:10)+10*(golfCourses.length-1-s.hole)),'Time limit: unfinished holes count ten strokes.',true);
}
