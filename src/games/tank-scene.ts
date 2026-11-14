import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {Kit,particles} from './world-kit';
import {car,palette as colors} from './world-models';
import type {ActionAssets} from './action-assets';

type State=any;
type Step=(s:State,dt:number,time:number)=>void;
const W=(x:number)=>(x-480)/10,Z=(y:number)=>(y-280)/10;

/** Low silhouettes and a fixed overhead view keep every collision surface legible. */
export function tankScene(k:Kit,s:State,assets?:ActionAssets):Step{
 k.scene.background=new T.Color('#dce2d2');
 k.scene.traverse(object=>{
  if(object instanceof T.DirectionalLight){object.color.set('#fff8ed');object.intensity=object.castShadow?1.8:.35;}
  if(object instanceof T.HemisphereLight)object.intensity=.85;
 });
 function block(w:number,h:number,d:number,color:string,x:number,y:number,z:number,parent:T.Object3D=k.fixed,radius=.18){
  return k.mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(radius,w/4,h/4,d/4)),k.mat(color,.75),parent,x,y,z);
 }
 k.box(400,.1,400,'#dce2d2',0,-3.1,0);
 block(99,2.6,59,'#bda17c',0,-1.7,0,k.fixed,.7);
 block(98,.5,58,'#e3cfa9',0,-.45,0,k.fixed,.25);
 block(94.8,.3,54.8,'#71956e',0,-.12,0,k.fixed,.14);
 // Broad, nearly tonal panels add scale without a busy checkerboard.
 for(const x of [-35.55,11.85])k.box(23.7,.018,54.2,'#779a72',x,.04,0);
 for(const z of [-27.4,27.4])block(96,1.2,1.2,'#ead9b7',0,.35,z);
 for(const x of [-47.4,47.4])block(1.2,1.2,55,'#ead9b7',x,.35,0);
 const paint=k.mat('#bfd0ab');
 const circle=k.mesh(new T.RingGeometry(7,7.12,64),paint,k.fixed,0,.07,0);circle.rotation.x=-Math.PI/2;circle.castShadow=false;
 for(const [i,[x,z]] of [[-36,-17],[36,17],[-36,17],[36,-17]].entries()){
  const pad=k.mesh(new T.RingGeometry(3.7,3.85,48),k.mat('#c2d1ae'),k.fixed,x,.07,z);pad.rotation.x=-Math.PI/2;pad.castShadow=false;
  block(3.4,.04,.42,colors[i],x,.08,z+(z<0?-4.5:4.5));
 }
 // A solid block occupies exactly the server wall's width and depth.
 for(const w of s.walls){
  const x=W(w.x+w.w/2),z=Z(w.y+w.h/2),width=w.w/10,depth=w.h/10;
  block(width,2.8,depth,'#4e776f',x,1.4,z,k.fixed,.3);
  block(width-.24,.3,depth-.24,'#8eafa1',x,2.8,z,k.fixed,.14);
  const cols=width>6?2:1,rows=depth>9?3:2;
  for(let a=0;a<cols;a++)for(let b=0;b<rows;b++){
   k.cylinder(.8,.88,.3,'#9bbdad',x+(a-(cols-1)/2)*3.4,3.1,z+(b-(rows-1)/2)*3.5,undefined,20);
  }
 }
 // Wooden crates and red barrels are the only destructible scenery.
 const crates=s.crates.map((c:any)=>{
  const root=new T.Group();
  block(3.6,2.6,3.6,'#bf8d52',0,1.3,0,root,.12);
  block(3.5,.2,3.5,'#e2bb80',0,2.65,0,root,.05);
  for(const x of [-1.25,1.25])block(.24,2.65,3.65,'#e7c68b',x,1.4,0,root,.04);
  const brace=block(3.1,.07,.25,'#ad7c45',0,2.8,0,root,.02);brace.rotation.y=.76;
  return k.add(root,W(c.x),0,Z(c.y),k.dynamic);
 });
 const barrels=(s.barrels||[]).map((b:any)=>{
  const root=new T.Group();
  k.cylinder(1.28,1.28,2.65,'#ce6247',0,1.33,0,root);
  for(const y of [.35,2.3])k.cylinder(1.34,1.34,.17,'#f1c798',0,y,0,root);
  k.cylinder(1.2,1.2,.12,'#ec9a6c',0,2.71,0,root);
  block(.22,.04,1.1,'#6d4738',0,2.8,-.12,root,.01);k.cylinder(.15,.15,.04,'#6d4738',0,2.8,.69,root,12);
  return k.add(root,W(b.x),0,Z(b.y),k.dynamic);
 });

 // Dynamic Pool for 3D Power-Up Pickups (s.powerups)
 const powerupColors:Record<string,string>={spread:'#ff9d3b',rapid:'#ffea56',heavy:'#ff5548',shield:'#4ce4ff',boost:'#65ff8f',repair:'#ff6b8b'};
 const powerupMeshes=new Map<number,T.Group>();

 // 3D Articulated Tanks with Muzzle Flash & Shield Dome
 const muzzleTex=assets?.texture('shotLarge.png')||assets?.texture('shotOrange.png');
 const tanks=s.players.map((_:any,i:number)=>{
  const g=assets?.tank(colors[i])||car(colors[i]);
  if(muzzleTex&&g.userData.muzzle){
   const flash=new T.Mesh(new T.PlaneGeometry(2.4,1.5),new T.MeshBasicMaterial({map:muzzleTex,transparent:true,depthWrite:false,side:T.DoubleSide}));
   flash.rotation.x=-Math.PI/2;flash.rotation.z=-Math.PI/2;flash.position.set(1.1,0,0);flash.visible=false;
   g.userData.muzzle.add(flash);g.userData.muzzleFlash=flash;
  }
  return k.add(g,0,0,0,k.dynamic);
 });
 const markers=s.players.map((_:any,i:number)=>k.ring(2.65,.12,colors[i],0,.09,0,k.dynamic));
 const labelCanvas=document.createElement('canvas');labelCanvas.width=192;labelCanvas.height=80;
 const ctx=labelCanvas.getContext('2d')!;ctx.fillStyle='#f7f4e8';ctx.beginPath();ctx.roundRect(4,4,184,64,18);ctx.fill();ctx.fillStyle='#304c3d';ctx.font='bold 34px sans-serif';ctx.textAlign='center';ctx.fillText('YOU',96,49);
 const labelTexture=new T.CanvasTexture(labelCanvas);labelTexture.colorSpace=T.SRGBColorSpace;k.textures.push(labelTexture);
 const you=new T.Sprite(new T.SpriteMaterial({map:labelTexture,depthTest:false,depthWrite:false,toneMapped:false}));you.scale.set(4.8,2,1);you.renderOrder=10;k.dynamic.add(you);

 // Tread Mark Decals Pool
 const trackTex=assets?.texture('tracksDouble.png');
 const treads:T.Mesh[]=[];let treadIdx=0;
 const lastTreadPos=s.players.map((p:any)=>({x:W(p.x),z:Z(p.y)}));
 if(trackTex){
  for(let i=0;i<24;i++){
   const tm=new T.Mesh(new T.PlaneGeometry(1.9,2.2),new T.MeshBasicMaterial({map:trackTex,transparent:true,opacity:0,depthWrite:false}));
   tm.rotation.x=-Math.PI/2;tm.visible=false;k.dynamic.add(tm);treads.push(tm);
  }
 }

 // Fiery 3D Shells (s.shots)
 const bulletTex=assets?.texture('tank_bulletFly3.png')||assets?.texture('shotOrange.png');
 const shots:T.Group[]=[];
 function makeShotMesh(){
  const g=new T.Group();
  const core=new T.Mesh(new T.SphereGeometry(.38,12,10),new T.MeshStandardMaterial({color:'#fff3b8',emissive:'#ff8826',emissiveIntensity:.9,roughness:.2}));
  core.scale.set(1.45,.9,.9);g.add(core);g.userData.core=core;
  if(bulletTex){
   const plume=new T.Mesh(new T.PlaneGeometry(2.3,1.15),new T.MeshBasicMaterial({map:bulletTex,transparent:true,depthWrite:false}));
   plume.rotation.x=-Math.PI/2;plume.rotation.z=-Math.PI/2;plume.position.set(-.75,.05,0);g.add(plume);
  }
  k.dynamic.add(g);return g;
 }

 // Multi-Frame Kenney Explosion Billboards & Flying 3D Crate Debris
 const expFrames=['explosion1.png','explosion2.png','explosion3.png','explosion4.png','explosion5.png'].map(n=>assets?.texture(n)).filter((t):t is T.Texture=>Boolean(t));
 const smokeFrames=['tank_explosion1.png','tank_explosion2.png','tank_explosion3.png','tank_explosion4.png'].map(n=>assets?.texture(n)).filter((t):t is T.Texture=>Boolean(t));
 type ActiveBlast={group:T.Group;sprite:T.Mesh;ring:T.Mesh;age:number;maxAge:number;baseScale:number;frames:T.Texture[]};
 const activeBlasts:ActiveBlast[]=[];
 type DebrisPiece={mesh:T.Object3D;vx:number;vy:number;vz:number;rx:number;ry:number;life:number};
 const debris:DebrisPiece[]=[];
 let seenExplosion=-1,hp=s.players.map((p:any)=>p.hp),nextShot=0;
 const fx=particles(k);

 function spawnBlast(wx:number,wz:number,scale:number,kind:string){
  const frames=kind==='spark'||kind==='shield'?smokeFrames:expFrames.length?expFrames:smokeFrames;
  if(frames.length){
   const g=new T.Group();g.position.set(wx,1.4,wz);
   const mat=new T.MeshBasicMaterial({map:frames[0],transparent:true,depthWrite:false, color:kind==='shield'?'#6ce8ff':'#ffffff'});
   const sprite=new T.Mesh(new T.PlaneGeometry(scale,scale),mat);
   sprite.rotation.x=-.95;g.add(sprite);
   const ring=new T.Mesh(new T.RingGeometry(scale*.18,scale*.28,24),new T.MeshBasicMaterial({color:kind==='barrel'?'#ff5938':kind==='shield'?'#57e2ff':'#ffcf70',transparent:true,opacity:.85,side:T.DoubleSide,depthWrite:false}));
   ring.rotation.x=-Math.PI/2;ring.position.y=-1.25;g.add(ring);
   k.dynamic.add(g);
   activeBlasts.push({group:g,sprite,ring,age:0,maxAge:kind==='barrel'?.62:.45,baseScale:scale,frames});
  }
  if(kind==='crate'||kind==='barrel'||kind==='tank'){
   const count=kind==='barrel'?4:3;
   for(let j=0;j<count;j++){
    const chunk=k.box(.55,.55,.55,kind==='barrel'?'#d94b38':'#d9b47e',0,0,0,new T.Group());
    chunk.scale.setScalar(.5+Math.random()*.35);
    chunk.position.set(wx+(Math.random()-.5)*1.2,1.1,wz+(Math.random()-.5)*1.2);
    k.dynamic.add(chunk);
    const a=Math.random()*Math.PI*2,sp=4+Math.random()*8;
    debris.push({mesh:chunk,vx:Math.cos(a)*sp,vy:7+Math.random()*7,vz:Math.sin(a)*sp,rx:(Math.random()-.5)*10,ry:(Math.random()-.5)*10,life:.65+Math.random()*.25});
   }
  }
 }

 return(state,dt,t)=>{
  const mine=state.players[state.viewSeat??0];
  you.visible=!state.spectating&&mine.respawn<=0;
  you.position.set(W(mine.x),5.5,Z(mine.y)-1.4);
  state.players.forEach((p:any,i:number)=>{
   const g=tanks[i],wx=W(p.x),wz=Z(p.y);
   g.position.set(wx,.08,wz);g.rotation.y=-p.heading;
   g.visible=p.respawn<=0;
   if(g.userData.turret)g.userData.turret.rotation.y=p.heading-p.aim;
   if(g.userData.barrelGroup)g.userData.barrelGroup.position.x=-(p.recoil||0)*.48;
   if(g.userData.muzzleFlash){
    g.userData.muzzleFlash.visible=(p.recoil||0)>.55;
    const sc=.85+(p.recoil||0)*.5;g.userData.muzzleFlash.scale.set(sc,sc,1);
   }
   if(g.userData.shieldDome){
    g.userData.shieldDome.visible=(p.shield||0)>0||p.invulnerable>0;
    g.userData.shieldDome.material.opacity=p.shield>0?.23:.07+Math.sin(t*5)*.025;
    g.userData.shieldDome.rotation.y=t*2.2;
   }
   if(g.visible&&treads.length&&Math.hypot(wx-lastTreadPos[i].x,wz-lastTreadPos[i].z)>1.85){
    const tm=treads[treadIdx++%treads.length];
    tm.visible=true;tm.position.set(wx,.05,wz);tm.rotation.z=-p.heading+Math.PI/2;
    (tm.material as T.MeshBasicMaterial).opacity=.16;
    lastTreadPos[i]={x:wx,z:wz};
   }
   if(p.hp<hp[i])fx.burst(g.position.x,1.5,g.position.z,p.hp===0?'#ffce7b':colors[i],p.hp===0?18:8);
   hp[i]=p.hp;
   markers[i].position.set(wx,.06,wz);markers[i].visible=p.respawn<=0;
   markers[i].scale.setScalar(i===(state.viewSeat??0)?1.12:1);
  });
  for(const tm of treads)if(tm.visible){const m=tm.material as T.MeshBasicMaterial;m.opacity=Math.max(0,m.opacity-dt*.06);if(m.opacity<=.01)tm.visible=false;}

  crates.forEach((g:any,i:number)=>{
   const c=state.crates[i];if(!c)return;
   if(g.visible&&c.hp<=0)fx.burst(g.position.x,1.2,g.position.z,'#d9b47e',8);
   g.visible=c.hp>0;
   if(c.hp===1){g.rotation.z=.05;g.scale.setScalar(.92);}
   else{g.rotation.z=0;g.scale.setScalar(1);}
  });

  barrels.forEach((g:any,i:number)=>{
   const b=(state.barrels||[])[i];if(!b)return;
   if(g.visible&&b.hp<=0)fx.burst(g.position.x,1.6,g.position.z,'#ff5e36',14);
   g.visible=b.hp>0;
   if(g.userData.ring)g.userData.ring.scale.setScalar(1+Math.sin(t*6+i)*.12);
  });

  const pickupIds=new Set((state.powerups||[]).map((p:any)=>p.id));
  powerupMeshes.forEach((m,id)=>{m.visible=false;if(!pickupIds.has(id)){m.removeFromParent();m.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(o.material as T.Material).dispose();}});powerupMeshes.delete(id);}});
  for(const pu of state.powerups||[]){
   if(!pu.active)continue;
   let m=powerupMeshes.get(pu.id);
   if(!m){
    m=new T.Group();
    const col=powerupColors[pu.kind]||'#ffea56';
    const ring=new T.Mesh(new T.TorusGeometry(1.7,.1,6,32),new T.MeshBasicMaterial({color:col}));ring.rotation.x=-Math.PI/2;ring.position.y=.1;m.add(ring);
    const token=new T.Mesh(new T.OctahedronGeometry(1.35),new T.MeshStandardMaterial({color:col,roughness:.4,emissive:col,emissiveIntensity:.16}));token.position.y=1.65;token.castShadow=true;m.add(token);m.userData.spin=token;
    k.dynamic.add(m);powerupMeshes.set(pu.id,m);
   }
   m.visible=true;
   m.position.set(W(pu.x),.1+Math.sin(t*4+pu.id)*.22,Z(pu.y));
   if(m.userData.spin)m.userData.spin.rotation.y=t*2.4;
  }

  for(const ex of state.explosions||[]){
   if(ex.id>seenExplosion){
    seenExplosion=ex.id;
    const wx=W(ex.x),wz=Z(ex.y);
    const sc=ex.kind==='barrel'?9.5:ex.kind==='tank'?7.2:ex.kind==='crate'?4.8:2.8;
    spawnBlast(wx,wz,sc,ex.kind);
    fx.burst(wx,1.4,wz,ex.kind==='barrel'?'#ff6238':ex.kind==='shield'?'#6ce8ff':'#ffd27d',ex.kind==='barrel'?16:7);
   }
  }
  for(let i=activeBlasts.length-1;i>=0;i--){
   const b=activeBlasts[i];b.age+=dt;
   if(b.age>=b.maxAge){b.group.removeFromParent();b.sprite.geometry.dispose();(b.sprite.material as T.Material).dispose();b.ring.geometry.dispose();(b.ring.material as T.Material).dispose();activeBlasts.splice(i,1);continue;}
   const u=b.age/b.maxAge;
   const frameIdx=Math.min(b.frames.length-1,Math.floor(u*b.frames.length));
   const mat=b.sprite.material as T.MeshBasicMaterial;
   mat.map=b.frames[frameIdx];mat.opacity=1-u*u;
   b.sprite.scale.setScalar(.65+u*.75);
   b.ring.scale.setScalar(1+u*2.8);
   (b.ring.material as T.MeshBasicMaterial).opacity=(1-u)*.8;
  }
  for(let i=debris.length-1;i>=0;i--){
   const d=debris[i];d.life-=dt;
   if(d.life<=0){d.mesh.removeFromParent();(d.mesh as T.Mesh).geometry.dispose();debris.splice(i,1);continue;}
   d.vy-=24*dt;
   d.mesh.position.x+=d.vx*dt;d.mesh.position.y=Math.max(.2,d.mesh.position.y+d.vy*dt);d.mesh.position.z+=d.vz*dt;
   d.mesh.rotation.x+=d.rx*dt;d.mesh.rotation.y+=d.ry*dt;
  }

  shots.forEach(o=>o.visible=false);
  state.shots.forEach((p:any,i:number)=>{
   if(!shots[i])shots[i]=makeShotMesh();
   const o=shots[i];
   o.position.set(W(p.x),1.68,Z(p.y));
   o.rotation.y=-Math.atan2(p.vy,p.vx);
   o.scale.setScalar(p.heavy?1.45:1.05);
   o.visible=true;
   if(p.id>=nextShot)fx.burst(o.position.x,1.68,o.position.z,p.heavy?'#ff6e42':'#fff0b5',6);
  });
  nextShot=state.nextShot;
  fx.update(dt);
 };
}
