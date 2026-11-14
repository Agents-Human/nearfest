import * as T from 'three';
import {Kit} from './world-kit';
import {roadCenter,roadHeight,roadSlope,roadGrade,raceBridgeSections,raceRampSections,type RaceBridge,type RaceRamp} from '../../server/arcade/race-course.mjs';

/** Recycled, instanced bridge structures. The road deck and the river use the shared course profile. */
export function raceStructures(k:Kit){
 const bridgeSlots=Array.from({length:2},()=>{
  const mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),k.mat('#ffffff',.65,.18),384);mesh.castShadow=true;mesh.receiveShadow=true;k.dynamic.add(mesh);
  const matrix=new T.Matrix4(),q=new T.Quaternion(),up=new T.Vector3(0,1,0),scale=new T.Vector3(),middle=new T.Vector3(),direction=new T.Vector3();let id=-1,count=0;
  function beam(a:T.Vector3,b:T.Vector3,width:number,depth:number,color:string){direction.subVectors(b,a);const length=direction.length();middle.addVectors(a,b).multiplyScalar(.5);q.setFromUnitVectors(up,direction.normalize());scale.set(width,length,depth);matrix.compose(middle,q,scale);mesh.setMatrixAt(count,matrix);mesh.setColorAt(count++,new T.Color(color));}
  const point=(d:number,x:number,h:number)=>new T.Vector3(roadCenter(d)+x,h,-d);
  return {mesh,set(bridge:RaceBridge){if(id===bridge.id)return;id=bridge.id;count=0;
   const steel=['#4f929f','#b5593e','#55776b','#628caf'][bridge.biome],stone=['#d6d5bc','#cba082','#c7d1ca','#a9c5d4'][bridge.biome];
   const n=Math.ceil((bridge.end-bridge.start)/7),span=(bridge.end-bridge.start)/n;
   for(let j=0;j<n;j++){
    const a=bridge.start+j*span,b=a+span,d=(a+b)/2,h=roadHeight(d);
    q.setFromEuler(new T.Euler(Math.atan((roadHeight(b)-roadHeight(a))/span),-Math.atan(roadSlope(d)),0));matrix.compose(point(d,0,h-.55),q,new T.Vector3(33,1.05,span*1.025));mesh.setMatrixAt(count,matrix);mesh.setColorAt(count++,new T.Color(stone));
    for(const side of [-1,1]){
     for(const y of [.45,1.5])beam(point(a,side*15.9,roadHeight(a)+y),point(b,side*15.9,roadHeight(b)+y),.22,.26,steel);
     beam(point(a,side*15.9,roadHeight(a)),point(a,side*15.9,roadHeight(a)+1.65),.28,.28,stone);
     beam(point(a,side*15.2,roadHeight(a)-2.8),point(b,side*15.2,roadHeight(b)-.65),.25,.25,steel);
     beam(point(a,side*15.2,roadHeight(a)-.65),point(b,side*15.2,roadHeight(b)-2.8),.25,.25,steel);
     beam(point(a,side*15.2,roadHeight(a)-2.8),point(b,side*15.2,roadHeight(b)-2.8),.4,.45,steel);
    }
   }
   for(const d of [bridge.start+10,bridge.end-10]){
    for(const side of [-1,1])beam(point(d,side*11,bridge.waterLevel-3),point(d,side*11,roadHeight(d)-.5),1.9,2.4,stone);
    beam(point(d,-13,roadHeight(d)-1.8),point(d,13,roadHeight(d)-1.8),1.2,2,stone);
   }
   // Coastal and city bridges have tall pylons and suspension cables; upland crossings use trusses.
   if(bridge.biome===0||bridge.biome===3){
    const a=bridge.start+8,b=bridge.end-8;
    for(const d of [a,b]){
     for(const side of [-1,1])beam(point(d,side*15,roadHeight(d)-1),point(d,side*15,roadHeight(d)+10),.85,1.1,steel);
     beam(point(d,-15,roadHeight(d)+9),point(d,15,roadHeight(d)+9),.9,.9,steel);
    }
    for(const side of [-1,1])for(let j=0;j<12;j++){
     const da=a+(b-a)*j/12,db=a+(b-a)*(j+1)/12,ha=roadHeight(da)+3.2+6.2*(2*j/12-1)**2,hb=roadHeight(db)+3.2+6.2*(2*(j+1)/12-1)**2;
     beam(point(da,side*15,ha),point(db,side*15,hb),.13,.13,'#e9e6cb');beam(point(da,side*15,roadHeight(da)+1.5),point(da,side*15,ha),.08,.08,'#d7ded5');
    }
   }
   mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();
  }};
 });
 const rampSlots=Array.from({length:3},()=>{
  const root=new T.Group();k.dynamic.add(root);let id=-1;
  return {root,set(r:Ramp){if(id===r.id)return;id=r.id;root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});root.clear();
   const positions:number[]=[],indices:number[]=[],steps=12;
   for(let j=0;j<=steps;j++){
    const d=r.start+(r.end-r.start)*j/steps,h=roadHeight(d),rise=r.height*j/steps;
    for(const side of [-1,1])positions.push(roadCenter(d)+r.x+side*r.width/2,h+rise+.035,-d);
    for(const side of [-1,1])positions.push(roadCenter(d)+r.x+side*r.width/2,h-.03,-d);
    if(j<steps){const a=j*4,b=a+4;indices.push(a,a+1,b,a+1,b+1,b,a,b,a+2,a+2,b,b+2,a+1,a+3,b+1,a+3,b+3,b+1);}
   }
   const end=steps*4;indices.push(end,end+2,end+1,end+1,end+2,end+3);
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();const mesh=new T.Mesh(geo,k.mat('#ef9e3f',.78));mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
   for(let j=1;j<6;j++){
    const d=r.start+(r.end-r.start)*j/6,h=roadHeight(d)+r.height*j/6+.08;
    for(const side of [-1,1]){const arrow=k.box(2.5,.055,.32,'#fff8c2',roadCenter(d)+r.x+side*.86,h,-d,root);arrow.rotation.set(Math.atan(r.height/(r.end-r.start)+roadGrade(d)), -Math.atan(roadSlope(d))-side*.55,0);}
   }
   for(const side of [-1,1])for(let j=0;j<8;j++){
    const d=r.start+(r.end-r.start)*(j+.5)/8,h=roadHeight(d)+r.height*(j+.5)/8;
    const edge=k.box(.22,.12,(r.end-r.start)/8+.03,j%2?'#243648':'#fff0a8',roadCenter(d)+r.x+side*(r.width/2-.12),h+.09,-d,root);edge.rotation.x=Math.atan(r.height/(r.end-r.start)+roadGrade(d));edge.rotation.y=-Math.atan(roadSlope(d));
   }
   // A roadside launch marker makes the ramp readable well before the takeoff lane.
   const d=r.start-14,x=roadCenter(d)+Math.sign(r.x)*16.4,h=roadHeight(d);
   k.box(.16,2.6,.16,'#233744',x,h+1.3,-d,root);const board=k.box(1.65,1.3,.16,'#ffd46b',x,h+2.6,-d,root);board.rotation.y=-Math.atan(roadSlope(d));
   const arrow=k.mesh(new T.ConeGeometry(.48,.75,3),k.mat('#243648'),root,x,h+2.62,-d+.13);arrow.rotation.z=0;
  }};
 });
 type Ramp=RaceRamp;
 return (distance:number)=>{
  const bridges=raceBridgeSections(distance-90,distance+345);bridgeSlots.forEach((slot,i)=>{slot.mesh.visible=!!bridges[i];if(bridges[i])slot.set(bridges[i]);});
  const ramps=raceRampSections(distance-65,distance+330);rampSlots.forEach((slot,i)=>{slot.root.visible=!!ramps[i];if(ramps[i])slot.set(ramps[i]);});
 };
}
