import * as T from 'three';
import {Kit} from './world-kit';

/** Bounded pools: a long match must not accumulate GPU objects. */
export function stickEffects(k:Kit){
 const textures=new Map<string,T.CanvasTexture>();
 function drawing(label:string){
  if(textures.has(label))return textures.get(label)!;
  const c=document.createElement('canvas');c.width=512;c.height=256;
  const x=c.getContext('2d')!;
  if(label==='impact'){
   x.translate(256,128);x.scale(1.5,1);x.beginPath();
   for(let n=0;n<32;n++){const a=n*Math.PI/16,r=n%2?24:90+(n%5)*7;x.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
   x.closePath();x.fillStyle='#fff6b6';x.strokeStyle='#190e24';x.lineWidth=9;x.stroke();x.fill();
   x.beginPath();x.ellipse(0,0,42,28,0,0,Math.PI*2);x.fillStyle='#fff';x.fill();
  }else{
   x.textAlign='center';x.textBaseline='middle';x.font='italic 900 78px Arial, sans-serif';x.lineJoin='round';x.lineWidth=14;x.strokeStyle='#170d20';x.strokeText(label,256,128);x.fillStyle=label==='PARRY!'?'#aafff6':'#fff3c7';x.fillText(label,256,128);
  }
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace; k.textures.push(texture);textures.set(label,texture);return texture;
 }
 const bursts=Array.from({length:24},()=>{
  const m=new T.SpriteMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
  const mesh=new T.Sprite(m);mesh.visible=false;mesh.renderOrder=25;k.dynamic.add(mesh);
  return {mesh,age:1,life:.25,size:1,label:false};
 });
 const dropGeo=new T.CircleGeometry(1,7);
 const drops=Array.from({length:140},()=>{
  const mesh=new T.Mesh(dropGeo,new T.MeshBasicMaterial({color:'#e42247',transparent:true,depthWrite:false,toneMapped:false}));mesh.visible=false;mesh.renderOrder=15;k.dynamic.add(mesh);
  return {mesh,age:2,life:.7,vx:0,vy:0,r:.1};
 });
 const stains=Array.from({length:36},()=>{
  const mesh=new T.Mesh(dropGeo,new T.MeshBasicMaterial({color:'#8f102f',transparent:true,opacity:.65,depthWrite:false,toneMapped:false}));mesh.visible=false;k.dynamic.add(mesh);return {mesh,life:0};
 });
 const rings=Array.from({length:16},()=>{
  const mesh=new T.Mesh(new T.RingGeometry(.88,1,32),new T.MeshBasicMaterial({color:'#fff4c5',transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false}));mesh.visible=false;k.dynamic.add(mesh);return {mesh,age:1,life:.3,slam:false};
 });
 let bi=0,di=0,si=0,ri=0;
 function burst(x:number,y:number,label:string,size:number,life:number){
  const b=bursts[bi++%bursts.length];b.age=0;b.life=life;b.size=size;b.label=label!=='impact';b.mesh.visible=true;b.mesh.material.map=drawing(label);b.mesh.material.opacity=1;b.mesh.position.set(x,y,2);b.mesh.material.rotation=b.label?-.12:Math.random()*.6-.3;
 }
 return {
  hit(imp:any,blood:boolean){
   const x=(imp.x-480)/10,y=(410-imp.y)/10;
   const strike=['hit','heavy','ko'].includes(imp.kind),guard=['block','parry','break'].includes(imp.kind);
   if(imp.kind==='dodge')burst(x,y+3,'DODGE!',7,.38);
   if(imp.kind==='pickup')burst(x,y+5,imp.label==='SWORD'?'KATANA!':imp.label==='HAMMER'?'HAMMER!':'STAFF!',8,.6);
   if(strike||guard){
    burst(x,y,'impact',imp.kind==='hit'?5.5:8,.18);
    if(imp.kind!=='hit'&&imp.kind!=='block')burst(x+imp.dir*1.2,y+3.1,imp.kind==='parry'?'PARRY!':imp.kind==='break'?'BREAK!':imp.kind==='ko'?'K.O.!':imp.label==='UPPERCUT!'?'RISE!':imp.label==='DROPKICK!'?'CRASH!':'WHAM!',9,.42);
   }
   if(strike||guard||imp.kind==='slam'){
    const r=rings[ri++%rings.length];r.age=0;r.slam=imp.kind==='slam';r.mesh.visible=true;r.mesh.position.set(x,y,.8);r.mesh.material.color.set(guard?'#aafff6':'#ffe8be');r.life=guard?.25:.32;
   }
   if(strike&&blood){
    const n=imp.kind==='hit'?13:24;
    for(let i=0;i<n;i++){
     const d=drops[di++%drops.length];d.age=0;d.life=.48+Math.random()*.45;d.r=.07+Math.random()*.14;d.vx=imp.dir*(3+Math.random()*14);d.vy=4+Math.random()*11;d.mesh.position.set(x,y,1+Math.random()*.2);d.mesh.visible=true;d.mesh.material.color.set(i%3?'#ed3150':'#9c1232');
    }
   }
  },
  update(dt:number,blood:boolean){
   for(const b of bursts){if(!b.mesh.visible)continue;b.age+=dt;const u=b.age/b.life;if(u>=1){b.mesh.visible=false;continue;}const size=b.size*(b.label?1+u*.12:.72+u*.75);b.mesh.scale.set(size,size/2,1);b.mesh.material.opacity=Math.min(1,(1-u)*3);if(b.label)b.mesh.position.y+=dt*2.4;}
   for(const r of rings){if(!r.mesh.visible)continue;r.age+=dt;const u=r.age/r.life;r.mesh.visible=u<1;r.mesh.scale.set((1+u*5)*(r.slam?2:1),(1+u*5)*(r.slam?.18:1),1);r.mesh.material.opacity=(1-u)*.65;}
   for(const d of drops){
    if(!d.mesh.visible)continue;if(!blood){d.mesh.visible=false;continue;}d.age+=dt;d.vy-=32*dt;d.mesh.position.x+=d.vx*dt;d.mesh.position.y+=d.vy*dt;d.mesh.material.opacity=Math.min(1,(d.life-d.age)*5);d.mesh.rotation.z=Math.atan2(d.vy,d.vx);d.mesh.scale.set(d.r*(1+Math.abs(d.vx)*.055),d.r*.65,1);
    if(d.mesh.position.y<.05){const stain=stains[si++%stains.length];stain.mesh.position.set(d.mesh.position.x,.02+(si%3)*.04,.5);stain.mesh.scale.set(d.r*2.4,d.r*.4,1);stain.life=3.8;stain.mesh.visible=true;d.mesh.visible=false;}
    if(d.age>=d.life)d.mesh.visible=false;
   }
   for(const s of stains){s.life-=dt;s.mesh.visible=blood&&s.life>0;s.mesh.material.opacity=Math.min(.6,s.life*.3);}
  },
  clear(){for(const p of [...bursts,...drops,...stains,...rings])p.mesh.visible=false;}
 };
}
