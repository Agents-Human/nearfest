import * as T from 'three';
import type {Kit} from './world-renderer';
import type {CatAssets} from './cat-assets';
import type {SoccerAssets} from './soccer-assets';
const W=(x:number)=>(x-480)/10,Z=(y:number)=>(y-280)/10;
const team=['#55bfff','#ff715f','#ffc653','#b58cf4'];
function line(k:Kit,points:T.Vector3[],color:string,parent:T.Object3D=k.fixed,opacity=1){const m=new T.LineBasicMaterial({color,transparent:opacity<1,opacity});const g=new T.BufferGeometry().setFromPoints(points),o=new T.Line(g,m);parent.add(o);k.cleanups.push(()=>{g.dispose();m.dispose();});return o;}
function label(k:Kit,text:string,color:string,width=18){const c=document.createElement('canvas');c.width=768;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='800 56px sans-serif';const fit=Math.min(56,56*710/Math.max(1,ctx.measureText(text).width));ctx.font=`800 ${fit}px sans-serif`;ctx.fillText(text,384,64);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;k.textures.push(t);return new T.Mesh(new T.PlaneGeometry(width,width/6),new T.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,toneMapped:false}));}
function ninja(k:Kit,tint:string){const root=new T.Group(),body=new T.Group();root.add(body);k.sphere(.68,'#172e36',0,2.48,0,body);const torso=k.sphere(.6,'#19333c',0,1.5,0,body);torso.scale.set(.82,1.22,.65);k.box(1.18,.26,.85,tint,0,1.87,0,body);k.box(.83,.22,.18,'#fce5af',0,2.52,.59,body);for(const x of [-.23,.23])k.sphere(.065,'#17232a',x,2.55,.7,body);const scarf=k.box(1.35,.22,.13,tint,-.86,1.95,0,body);scarf.rotation.z=.25;
 const limbs=Array.from({length:4},(_,i)=>{const g=new T.Group();g.position.set(i%2? .3:-.3,i<2?.9:1.7,0);k.box(i<2?.26:.23,i<2?.8:.65,.28,'#19333c',0,-.3,0,g);body.add(g);return g;});return {root,update(walk:boolean,time:number){body.position.y=walk?Math.abs(Math.sin(time*15))*.11:Math.sin(time*2)*.025;limbs.forEach((limb,i)=>limb.rotation.z=walk?Math.sin(time*15+i*Math.PI)*.65:0);scarf.rotation.z=.2+Math.sin(time*7)*.12;}};
}
export function bridgeScene(k:Kit,s:any){
 k.sky('#476c96','#f5cf9a');k.scene.fog=new T.Fog('#d1c6b6',90,200);
 // Layered ravine, warm mist, and an original pagoda skyline.
 const sun=k.sphere(6,'#fff0c2',5,25,-90);sun.material=new T.MeshBasicMaterial({color:'#ffe3a1',fog:false,toneMapped:false});
 for(let layer=0;layer<3;layer++)for(let i=0;i<15;i++){const x=i*23-130,h=15+Math.sin(i*2.37+layer)*8;k.mesh(new T.ConeGeometry(19,h,5),k.mat(['#a4adb1','#81999e','#648589'][layer]),k.fixed,x,-8+h/2,-84+layer*18);}
 k.surface(1500,180,'#80b8b8','water',-27);for(let i=0;i<8;i++){const cloud=k.sphere(9,'#d3ded6',i*45-70,-17,-23);cloud.scale.set(2,.16,1.1);}
 for(let i=0;i<5;i++){const x=i*49-30,z=-37-i%2*8;const g=new T.Group();k.box(3,29,3,'#52686b',0,-11,0,g);for(let j=0;j<3;j++){const roof=k.mesh(new T.ConeGeometry(4.6-j*.7,1.6,4),k.mat('#3b5860'),g,0,3+j*2.3,0);roof.rotation.y=Math.PI/4;k.box(2-j*.3,1.5,2-j*.3,'#d2a275',0,4+j*2.3,0,g);}k.add(g,x,-3,z);}
 const towers=Array.from({length:6},()=>{const root=new T.Group();k.box(1,18,5.8,'#456572',0,-9.2,0,root);k.box(1,1,6.4,'#75909a',0,-.65,0,root);k.box(1,.25,6.65,'#d5c6a1',0,0,0,root);for(let row=0;row<5;row++)k.box(1,.1,.05,'#2c4e5a',0,-2-row*3,2.94,root);for(const x of [-.36,0,.36])k.box(.025,16,.08,'#56747c',x,-9,2.96,root);k.dynamic.add(root);return root;});
 const marker=k.box(1.8,.11,6.8,'#f9be49',0,.21,0,k.dynamic);
 const coins=Array.from({length:3},(_,i)=>{const root=new T.Group();const disc=k.cylinder(.57,.57,.16,'#ffc64b',0,0,0,root,24);disc.rotation.x=Math.PI/2;const rim=k.ring(.42,.045,'#fff0a1',0,0,.1,root);rim.rotation.x=0;k.add(label(k,'★','#a56b21',.64),0,0,.11,root);k.dynamic.add(root);return root;});
 const crew=s.players.map((_:any,i:number)=>{const n=ninja(k,team[i]);k.dynamic.add(n.root);return n;});
 const sticks=s.players.map((_:any,i:number)=>{const pivot=new T.Group();const beam=k.box(.32,1,.36,i===0?'#57351e':team[i],0,.5,0,pivot);k.dynamic.add(pivot);return {pivot,beam};});
 let offset=s.from.x/10;
 return (state:any,dt:number,time:number)=>{offset=T.MathUtils.lerp(offset,state.from.x/10,1-Math.exp(-dt*5));k.fixed.position.x=offset-4;
  towers.forEach((g,i)=>{const p=state.platforms[i];g.visible=!!p;if(!p)return;g.position.set((p.x+p.w/2)/10,0,0);g.scale.x=p.w/10;});
  marker.position.x=(state.to.x+state.to.w/2)/10;
  state.players.forEach((p:any,i:number)=>{const n=crew[i],own=i===state.viewSeat;n.root.position.set(p.x/10,-p.y/10,own?3:-1-i*1.4);n.root.scale.setScalar(own?1:.87);n.root.rotation.y=.55;n.root.visible=p.y<450;n.update(p.phase==='walking',time+i);const stick=sticks[i];stick.pivot.position.set((state.from.x+state.from.w)/10,.16,own?2.9:-1-i*1.4);stick.pivot.rotation.z=-p.rotation;stick.pivot.visible=p.length>0;stick.beam.scale.y=Math.max(.02,p.length/10);stick.beam.position.y=p.length/20;});
  coins.forEach((g,i)=>{const mine=state.players[state.viewSeat];g.visible=!mine.hit||mine.phase==='walking';g.position.set((state.to.x+state.to.w/2)/10+(i-1)*1.5,4.2+Math.sin(time*3+i)*.2,0);g.rotation.y=time*1.7+i;});
 };
}
export function soccerScene(k:Kit,s:any,assets:SoccerAssets){
 k.sky('#101e37','#303f59');k.scene.background=new T.Color('#15243b');
 k.box(112,2,67,'#172d37',0,-1.4,0);k.surface(96,50,'#318f60','grass',0);
 for(let i=0;i<12;i++)k.box(7.3,.02,44.2,i%2?'#319360':'#2c8759',-40.15+i*7.3,.03,0);
 // White pitch markings sit in the same place as the authoritative bounds.
 const mark=(x:number,z:number,w:number,d:number)=>k.box(w,.04,d,'#e0efd7',x,.07,z);
 mark(0,-22.1,87.2,.13);mark(0,22.1,87.2,.13);mark(-43.6,0,.13,44.2);mark(43.6,0,.13,44.2);mark(0,0,.13,44.2);k.ring(6.8,.08,'#e0efd7',0,.12,0);k.cylinder(.22,.22,.03,'#e0efd7',0,.09,0);
 for(const side of [-1,1]){mark(side*32,0,.14,26);mark(side*37.8,-13,11.6,.14);mark(side*37.8,13,11.6,.14);mark(side*39,0,.14,15);mark(side*41.3,-7.5,4.6,.14);mark(side*41.3,7.5,4.6,.14);
  for(const z of [-7.1,7.1]){k.cylinder(.16,.16,4.4,'#f4f5eb',side*43.8,2.2,z);k.cylinder(.12,.12,3.9,'#dce3df',side*48,1.95,z);}k.box(.3,.3,14.5,'#faf5db',side*43.8,4.4,0);k.box(.25,.25,14.5,'#dce3df',side*48,3.9,0);
  for(let z=-7;z<=7;z+=.7)line(k,[new T.Vector3(side*43.8,4.3,z),new T.Vector3(side*48,3.8,z),new T.Vector3(side*48,.1,z)],'#dbe5e2',k.dynamic,.45);
  for(let y=.2;y<4.2;y+=.55){line(k,[new T.Vector3(side*43.8,y,-7.1),new T.Vector3(side*48,y,-7.1),new T.Vector3(side*48,y,7.1),new T.Vector3(side*43.8,y,7.1)],'#dbe5e2',k.dynamic,.45);}
 }
 // Compact stands with actual seats, advertising boards and illuminated rails.
 for(const side of [-1,1]){for(let r=0;r<3;r++){k.box(105,1.25,3.2,'#415467',0,r*1.3+.35,side*(29+r*3));for(let i=0;i<34;i++)k.box(1.6,.65,1.4,(i+r)%5<2?'#de684f':'#5572a1',i*3-49.5,r*1.3+1.3,side*(29+r*3));}k.box(105,2,.35,'#101e35',0,1.1,side*25.8);k.box(105,.08,.4,'#8ad9d6',0,2.13,side*25.8);}
 for(const side of [-1,1])for(let row=0;row<3;row++)for(let i=0;i<27;i++){if((i+row)%4===0)continue;const x=i*3.6-47,z=side*(29+row*3),y=row*1.3+1.9;k.sphere(.42,['#c49a73','#eac8a1','#7f5c47'][(i+row)%3],x,y+.8,z);k.box(.9,.8,.55,[(side<0?'#dd715b':'#708ccc'),'#ddd7bd','#4a6b71'][(i+row)%3],x,y,z);}
 for(const side of [-1,1]){const board=label(k,side<0?'POCKET SOCCER  •  PLAY TOGETHER':'FIVE GOALS. ONE WINNER.','#dfeedd',42);board.position.set(0,1.1,side*25.55);if(side>0)board.rotation.y=Math.PI;k.dynamic.add(board);}
 for(const x of [-52,52])for(const z of [-28,28]){k.cylinder(.32,.5,18,'#7c8c99',x,9,z);k.box(5,.3,1.6,'#283d51',x,18,z);for(let j=0;j<4;j++)k.box(.85,.15,1.2,'#effbe7',x+(j-1.5)*1.13,17.8,z);}
 const crew=s.players.map((_:any,i:number)=>{const player=assets.player(i,7.2);k.dynamic.add(player.root);k.cleanups.push(player.dispose);return player;});
 const rings=s.players.map((_:any,i:number)=>k.ring(3.1,.09,team[i],0,.17,0,k.dynamic));
 const ball=assets.ball(1.05);k.dynamic.add(ball);const ballShadow=k.mesh(new T.CircleGeometry(1,20),new T.MeshBasicMaterial({color:'#123b2a',transparent:true,opacity:.28,depthWrite:false}),k.dynamic);ballShadow.rotation.x=-Math.PI/2;const trail=Array.from({length:8},()=>k.sphere(.14,'#fff1ab',0,-200,0,k.dynamic));let ballX=s.ball.x,ballY=s.ball.y;
 return (state:any,_dt:number,time:number)=>{state.players.forEach((p:any,i:number)=>{crew[i].root.position.set(W(p.x),.22,Z(p.y));crew[i].face(p.heading);crew[i].update(Math.hypot(p.vx,p.vy)>5,p.kick>0,time);rings[i].position.set(W(p.x),.14,Z(p.y));rings[i].visible=i===state.viewSeat;});const b=state.ball;ball.position.set(W(b.x),.1+Math.min(.35,Math.hypot(b.vx,b.vy)/700)*Math.abs(Math.sin(time*12)),Z(b.y));ball.userData.roll?.((b.x-ballX)/10,(b.y-ballY)/10);ballX=b.x;ballY=b.y;ballShadow.position.set(W(b.x),.12,Z(b.y));const speed=Math.hypot(b.vx,b.vy)||1;trail.forEach((p,i)=>{p.visible=speed>300&&state.reset<=0;p.position.set(W(b.x)-b.vx/speed*(i+1)*.35,.6,Z(b.y)-b.vy/speed*(i+1)*.35);p.scale.setScalar(1-i/9);});};
}
export function catsScene(k:Kit,s:any,assets:CatAssets){
 k.scene.background=new T.Color('#bdc7bb');const bg=assets.backdrop(96);k.dynamic.add(bg);
 const cats=s.players.map((_:any,i:number)=>{const cat=assets.cat(i,s.players.length>2?7.8:8.8);k.dynamic.add(cat.root);k.cleanups.push(cat.dispose);return cat;});
 const enemies=new Map<number,ReturnType<CatAssets['enemy']>>(),shots=new Map<number,T.Object3D>(),coins=new Map<number,T.Object3D>();
 // Replace the source's decorative bar with the real shared barricade health.
 const sourceScale=96/2143,barX=(680.5-2143/2)*sourceScale,barY=(1062/2-473)*sourceScale,barH=398*sourceScale;
 const track=k.mesh(new T.PlaneGeometry(21*sourceScale,barH),new T.MeshBasicMaterial({color:'#48372f',toneMapped:false}),k.dynamic,barX,barY,-3.9),health=k.mesh(new T.PlaneGeometry(17*sourceScale,barH),new T.MeshBasicMaterial({color:'#71d455',toneMapped:false}),k.dynamic,barX,barY,-3.8);track.renderOrder=1;health.renderOrder=2;
 const selected=k.mesh(new T.PlaneGeometry(17,7.5),new T.MeshBasicMaterial({color:'#fff5a8',transparent:true,opacity:.13,depthWrite:false}),k.dynamic,-22,0,-3.5);
 const flashes=Array.from({length:3},()=>k.mesh(new T.PlaneGeometry(67,6.5),new T.MeshBasicMaterial({color:'#fff4b0',transparent:true,opacity:0,depthWrite:false}),k.dynamic,14,0,1));
 return (state:any,dt:number,time:number)=>{
  const mine=state.players[state.viewSeat];selected.position.y=-Z(mine.y)+3;
  health.scale.y=Math.max(.001,state.gate/100);health.position.y=barY-barH*(1-state.gate/100)/2;
  state.players.forEach((p:any,i:number)=>{const cat=cats[i];cat.root.position.set(W(p.x),-Z(p.y),i*.02);cat.setAnimation(p.shootTime>0?'shoot':'idle');cat.update(dt);});
  const live=new Set<number>();for(const e of state.enemies){live.add(e.id);let sprite=enemies.get(e.id);if(!sprite){sprite=assets.enemy(e.kind,e.kind==='boss'?13:e.kind==='brute'?10.5:8);enemies.set(e.id,sprite);k.dynamic.add(sprite.root);}sprite.root.position.set(W(e.x),-Z(e.y),.1+e.lane*.03);sprite.setAnimation(e.x<=302?'attack':'walk');sprite.update(dt);sprite.root.scale.x=e.hurt>0?1.04:1;}
  for(const [id,sprite] of enemies)if(!live.has(id)){if(sprite.root.userData.diedAt===undefined){sprite.root.userData.diedAt=time;sprite.setAnimation('dead',true);}sprite.update(dt);if(time-sprite.root.userData.diedAt>.5){k.dynamic.remove(sprite.root);sprite.dispose();enemies.delete(id);}}
  const liveShots=new Set<number>();for(const shot of state.shots){liveShots.add(shot.id);let sprite=shots.get(shot.id);if(!sprite){sprite=assets.projectile(1.6);shots.set(shot.id,sprite);k.dynamic.add(sprite);}sprite.position.set(W(shot.x),-Z(shot.y),.5);}
  for(const [id,sprite] of shots)if(!liveShots.has(id)){k.dynamic.remove(sprite);sprite.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(o.material as T.MeshBasicMaterial).map?.dispose();(o.material as T.Material).dispose();}});shots.delete(id);}
  const liveCoins=new Set<number>();for(const c of state.coins){liveCoins.add(c.id);let sprite=coins.get(c.id);if(!sprite){sprite=assets.coin(2.3);coins.set(c.id,sprite);k.dynamic.add(sprite);}const age=state.elapsed-c.at,fly=Math.max(0,(age-.4)/.75),p=state.players[c.owner];sprite.position.set(W(T.MathUtils.lerp(c.x,p.x,fly)),-Z(T.MathUtils.lerp(c.y,p.y-55,fly))+Math.sin(Math.min(1,age/.7)*Math.PI)*2,1);sprite.rotation.z=Math.sin(time*6)*.12;}
  for(const [id,sprite] of coins)if(!liveCoins.has(id)){k.dynamic.remove(sprite);sprite.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(o.material as T.MeshBasicMaterial).map?.dispose();(o.material as T.Material).dispose();}});coins.delete(id);}
  flashes.forEach((flash,i)=>{const burst=state.bursts.find((b:any)=>b.lane===i),age=burst?state.elapsed-burst.at:1;(flash.material as T.MeshBasicMaterial).opacity=age<.5?(1-age/.5)*.65:0;flash.position.y=-Z([200,290,380][i])+2;});
 };
}
