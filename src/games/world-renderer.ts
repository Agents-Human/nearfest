import * as T from 'three';
import {bridgeScene,soccerScene,catsScene} from './social-scenes';
import type {SoccerAssets} from './soccer-assets';
import type {CatAssets} from './cat-assets';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {RacingAssets} from './racing-assets';
import type {PlatformAssets} from './platform-assets';
import type {SceneryAssets} from './scenery-assets';
import type {ActionAssets} from './action-assets';
import type {GolfAssets} from './golf-assets';
import type {FighterAssets} from './fighter-assets';
import {golfCourses} from '../../server/arcade/golf-courses.mjs';
type WorldAssets={soccer?:SoccerAssets;cats?:CatAssets;racing?:RacingAssets;platform?:PlatformAssets;scenery?:SceneryAssets;action?:ActionAssets;golf?:GolfAssets;fighters?:FighterAssets};
import {car,explorer,tree,rock,crystal,coin,island,sign,palette} from './world-models';

type State=any;
type Step=(s:State,dt:number,time:number)=>void;
const W=(x:number)=>(x-480)/10,Z=(y:number)=>(y-280)/10;
const clamp=T.MathUtils.clamp;
const colors=palette;
const v=new T.Vector3();
function noise(n:number){return Math.sin(n*127.1+311.7)*43758.5453%1;}
function random(n:number){return Math.abs(noise(n));}

/** One scene owns all GPU resources. Static scenery is merged by material. */
export class Kit {
 scene=new T.Scene();fixed=new T.Group();dynamic=new T.Group();skyDome:T.Mesh|null=null;cleanups:(()=>void)[]=[];
 mats=new Map<string,T.MeshStandardMaterial>();textures:T.Texture[]=[];
 constructor(){this.scene.add(this.fixed,this.dynamic);}
 mat(color:string,roughness=.8,metalness=0,emissive?:string){const key=[color,roughness,metalness,emissive].join();if(!this.mats.has(key))this.mats.set(key,new T.MeshStandardMaterial({color,roughness,metalness,emissive:emissive||'#000000',emissiveIntensity:emissive?1.5:0}));return this.mats.get(key)!;}
 mesh(g:T.BufferGeometry,m:T.Material,parent:T.Object3D=this.fixed,x=0,y=0,z=0){const obj=new T.Mesh(g,m);obj.position.set(x,y,z);obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);return obj;}
 box(w:number,h:number,d:number,c:string,x=0,y=0,z=0,parent:T.Object3D=this.fixed){return this.mesh(new T.BoxGeometry(w,h,d),this.mat(c),parent,x,y,z);}
 sphere(r:number,c:string,x=0,y=0,z=0,parent:T.Object3D=this.fixed){return this.mesh(new T.SphereGeometry(r,16,10),this.mat(c),parent,x,y,z);}
 cylinder(top:number,bottom:number,h:number,c:string,x=0,y=0,z=0,parent:T.Object3D=this.fixed,segments=20){return this.mesh(new T.CylinderGeometry(top,bottom,h,segments),this.mat(c),parent,x,y,z);}
 add(obj:T.Object3D,x=0,y=0,z=0,parent:T.Object3D=this.fixed){obj.position.set(x,y,z);parent.add(obj);return obj;}
 ring(radius:number,tube:number,c:string,x=0,y=0,z=0,parent:T.Object3D=this.fixed){const o=this.mesh(new T.TorusGeometry(radius,tube,6,64),this.mat(c,.35,.3),parent,x,y,z);o.rotation.x=-Math.PI/2;return o;}
 texture(kind:'asphalt'|'grass'|'stone'|'water',color:string){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d')!;ctx.fillStyle=color;ctx.fillRect(0,0,256,256);
  for(let i=0;i<5500;i++){const n=random(i+12);ctx.fillStyle=`rgba(${kind==='asphalt'?'220,225,230':'255,255,255'},${n*.12})`;ctx.fillRect(random(i+2)*256,random(i+7)*256,kind==='grass'?1:2,kind==='grass'?7:2);}
  if(kind==='water'){ctx.strokeStyle='#97eee638';ctx.lineWidth=2;for(let i=0;i<24;i++){ctx.beginPath();ctx.ellipse(random(i)*256,random(i+20)*256,20,2,0,0,Math.PI*2);ctx.stroke();}}
  const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(kind==='asphalt'?12:8,8);t.anisotropy=4;this.textures.push(t);return t;
 }
 surface(w:number,d:number,c:string,kind:'asphalt'|'grass'|'stone'|'water',y=0){const m=new T.MeshStandardMaterial({color:'#ffffff',map:this.texture(kind,c),roughness:kind==='water'?.32:.94,metalness:kind==='water'?.25:0});const o=this.mesh(new T.PlaneGeometry(w,d),m,this.fixed,0,y,0);o.rotation.x=-Math.PI/2;return o;}
 sky(top:string,bottom:string){
  const m=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color(top)},bottom:{value:new T.Color(bottom)}},vertexShader:'varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 top;uniform vec3 bottom;varying vec3 p;void main(){float h=smoothstep(-.08,.65,normalize(p).y);gl_FragColor=vec4(mix(bottom,top,h),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
  const sky=this.mesh(new T.SphereGeometry(650,24,16),m,this.dynamic);sky.castShadow=sky.receiveShadow=false;this.scene.background=new T.Color(bottom);this.skyDome=sky;return sky;
 }
 light(night=false){
  this.scene.add(new T.HemisphereLight(night?'#8db6ff':'#ceeaff',night?'#19233e':'#6c7e5e',night?1.5:.65));
  const sun=new T.DirectionalLight(night?'#d1dfff':'#fff0c7',night?2:2.8);sun.position.set(-35,65,30);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-75,right:75,top:65,bottom:-65,near:1,far:180});sun.shadow.bias=-.0004;sun.shadow.normalBias=.1;this.scene.add(sun,sun.target);
  const rim=new T.DirectionalLight(night?'#ff72c8':'#b1eaff',night?1.7:.45);rim.position.set(40,20,-35);this.scene.add(rim);return sun;
 }
 mountains(xStart=-160,xEnd=170,z=-65){for(let i=0,x=xStart;x<xEnd;x+=18,i++){const h=12+random(i+26)*36;const m=this.mesh(new T.ConeGeometry(15+random(i)*10,h,5),this.mat(i%2?'#7d9d9b':'#557f83'),this.fixed,x,h/2-6,z-random(i+2)*22);m.rotation.y=i;}}
 trees(count:number,bounds:[number,number,number,number],exclude?:(x:number,z:number)=>boolean){for(let i=0;i<count;i++){const x=bounds[0]+random(i+9)*(bounds[1]-bounds[0]),z=bounds[2]+random(i+99)*(bounds[3]-bounds[2]);if(exclude?.(x,z))continue;this.add(tree(i%4?'pine':'broadleaf',4+random(i+4)*5),x,0,z);}}
 batch(root:T.Group=this.fixed){
  root.updateMatrixWorld(true);const buckets=new Map<string,{m:T.Material,g:T.BufferGeometry[]}>();
  root.traverse(obj=>{if(!(obj instanceof T.Mesh)||Array.isArray(obj.material))return;const m=obj.material as T.MeshStandardMaterial;const key=[m.type,m.color?.getHex(),m.roughness,m.metalness,m.emissive?.getHex(),m.emissiveIntensity,m.map?.source.uuid,m.map?.colorSpace,m.map?.flipY,m.map?.repeat.toArray(),m.map?.offset.toArray(),m.transparent,m.opacity,m.side].join(':');
   let g=obj.geometry.clone();if(g.index){const n=g.toNonIndexed();g.dispose();g=n;}g.applyMatrix4(obj.matrixWorld);for(const a of Object.keys(g.attributes))if(!['position','normal','uv'].includes(a))g.deleteAttribute(a);if(!g.getAttribute('normal'))g.computeVertexNormals();if(!g.getAttribute('uv'))g.setAttribute('uv',new T.BufferAttribute(new Float32Array(g.getAttribute('position').count*2),2));
   if(!buckets.has(key))buckets.set(key,{m,g:[]});buckets.get(key)!.g.push(g);
  });
  const oldGeometries=new Set<T.BufferGeometry>(),oldMaterials=new Set<T.Material>();root.traverse(o=>{if(o instanceof T.Mesh){oldGeometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>oldMaterials.add(m));}});
  root.clear();for(const {m,g} of buckets.values()){const merged=mergeGeometries(g,false);if(merged)this.mesh(merged,m,root);g.forEach(a=>a.dispose());}oldGeometries.forEach(g=>g.dispose());const kept=new Set([...buckets.values()].map(b=>b.m));const keptTextures=new Set<T.Texture>(this.textures);kept.forEach(m=>Object.values(m).forEach(value=>{if(value instanceof T.Texture)keptTextures.add(value);}));oldMaterials.forEach(m=>{if(kept.has(m))return;for(const value of Object.values(m))if(value instanceof T.Texture&&!keptTextures.has(value))value.dispose();m.dispose();});
 }
 dispose(){this.cleanups.forEach(fn=>fn());const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>(),ts=new Set<T.Texture>(this.textures);this.scene.traverse(o=>{const m=o as T.Mesh;if(m.geometry)gs.add(m.geometry);if(m.material)for(const mat of Array.isArray(m.material)?m.material:[m.material]){ms.add(mat);for(const value of Object.values(mat))if(value instanceof T.Texture)ts.add(value);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());this.scene.traverse(o=>{if(o instanceof T.DirectionalLight||o instanceof T.SpotLight||o instanceof T.PointLight){o.shadow.map?.dispose();o.shadow.mapPass?.dispose();}});}
}
function particles(k:Kit){
 const count=180,positions=new Float32Array(count*3),color=new Float32Array(count*3),life=new Float32Array(count),vel=new Float32Array(count*3),base=new T.Color();positions.fill(-1000);let next=0;
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('color',new T.BufferAttribute(color,3));
 const sprite=document.createElement('canvas');sprite.width=sprite.height=32;const ctx=sprite.getContext('2d')!,gradient=ctx.createRadialGradient(16,16,0,16,16,16);gradient.addColorStop(0,'#fff');gradient.addColorStop(.3,'#fff');gradient.addColorStop(1,'#fff0');ctx.fillStyle=gradient;ctx.fillRect(0,0,32,32);const texture=new T.CanvasTexture(sprite);k.textures.push(texture);
 const points=new T.Points(geometry,new T.PointsMaterial({size:.6,map:texture,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));points.frustumCulled=false;k.dynamic.add(points);
 return {burst(x:number,y:number,z:number,tint='#ffd360',amount=14){base.set(tint);for(let j=0;j<amount;j++){const i=next++%count;life[i]=.7+random(next)*.5;positions.set([x,y,z],i*3);color.set([base.r,base.g,base.b],i*3);vel.set([(random(next+4)-.5)*8,2+random(next+7)*7,(random(next+11)-.5)*6],i*3);}},update(dt:number){for(let i=0;i<count;i++){if(life[i]<=0)continue;life[i]-=dt;for(let j=0;j<3;j++)positions[i*3+j]+=vel[i*3+j]*dt;vel[i*3+1]-=10*dt;if(life[i]<=0)positions[i*3+1]=-1000;}(geometry.attributes.position as T.BufferAttribute).needsUpdate=true;(geometry.attributes.color as T.BufferAttribute).needsUpdate=true;}};
}
function roadCenter(d:number){return Math.sin(d/135)*13+Math.sin(d/60)*3;}
function roadSlope(d:number){return Math.cos(d/135)*13/135+Math.cos(d/60)*3/60;}
// Models face +X locally. Increasing race distance moves down world -Z.
// Face the actual road tangent + lateral steering velocity, not a fixed yaw.
function raceHeading(distance:number,speed:number,lateral=0){return Math.atan2(Math.max(.01,speed),roadSlope(distance)*speed+lateral);}
function raceScene(k:Kit,s:State,assets?:RacingAssets,scenery?:SceneryAssets):Step{
 k.sky('#438fcb','#d8e4de');k.scene.fog=new T.Fog('#b2d6d8',95,235);
 const water=k.surface(1800,2400,'#25889e','water',-2.4);water.position.z=-450;
 const strip=(left:number,right:number,color:string,y:number)=>{const pos:number[]=[],uv:number[]=[];for(let d=-60;d<980;d+=4){for(const [z,x] of [[d,left],[d,right],[d+4,left],[d,right],[d+4,right],[d+4,left]]){pos.push(roadCenter(z)+x,y,-z);uv.push(x/25,z/40);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();const m=k.mat(color);m.side=T.DoubleSide;return k.mesh(g,m);};
 strip(-90,24,'#6e9c64',-.08);strip(23,36,'#dfcca0',-.2);const asphalt=strip(-14.5,14.5,'#ffffff',.05);(asphalt.material as T.MeshStandardMaterial).map=k.texture('asphalt','#58616b');
 for(let d=-45;d<940;d+=8){const center=roadCenter(d),slope=-Math.atan(roadSlope(d));for(const x of [-4.8,4.8]){const mark=k.box(.15,.025,3.8,'#f2e7cb',center+x,.085,-d);mark.rotation.y=slope;}for(const x of [-14.7,14.7]){const curb=k.box(.55,.16,8.05,Math.round(d/8)%2?'#f3e3c3':'#df7960',center+x,.07,-d);curb.rotation.y=slope;}}
 for(let d=-40;d<950;d+=16){const center=roadCenter(d);if(assets){const rail=assets.prop('rail');if(rail){rail.scale.x=16/6;rail.rotation.y=Math.PI/2-Math.atan(roadSlope(d));k.add(rail,roadCenter(d+8)+17,0,-d-8);}}else{k.cylinder(.1,.1,1.7,'#708889',center+17,.85,-d);const rail=k.box(.25,.35,16.1,'#d4d9c6',center+17,1.25,-d-8);rail.rotation.y=-Math.atan(roadSlope(d));}k.add(tree('palm',6+random(d)*4),center+24+random(d+4)*5,0,-d);if(d%32<1)k.add(tree('pine',7+random(d+21)*6),center-23-random(d+9)*18,0,-d);}
 for(let i=0;i<23;i++){const d=i*46,x=roadCenter(d);const mountain=k.mesh(new T.ConeGeometry(25+random(i)*20,35+random(i+3)*60,6),k.mat(i%2?'#5f8684':'#8aa39b'),k.fixed,x-77,12,-d);mountain.rotation.y=i;}
 for(let i=0;i<11;i++){const d=i*88+25,x=roadCenter(d)-31,house=scenery?.prop(['house-a','house-h','house-q'][i%3]);if(house){house.rotation.y=Math.PI/2;k.add(house,x,0,-d);const planter=scenery!.prop('planter')!;k.add(planter,x+8,0,-d-7);const cityTree=scenery!.prop('city-tree')!;k.add(cityTree,x-8,0,-d-8);}else{k.box(8,4,7,'#e5d4ad',x,2,-d);const roof=k.mesh(new T.ConeGeometry(6.6,2,4),k.mat(i%2?'#c9765c':'#376f74'),k.fixed,x,5,-d);roof.rotation.y=Math.PI/4;for(const dx of [-2,2])k.box(1.3,1.5,.1,'#386576',x+dx,2.5,-d+3.6);}}
 for(const [d,label] of [[0,'COAST RUN'],[300,'KEEP IT FLOWING'],[600,'THE LAST STRETCH'],[900,'FINISH']] as [number,string][]){const center=roadCenter(d);k.add(sign(label,'#174c54',12),center+23,1,-d);if(d===900){if(!assets){k.box(.8,9,.8,'#16404d',center-16,4.5,-d);k.box(.8,9,.8,'#16404d',center+16,4.5,-d);k.box(33,1.5,1,'#f4e3bf',center,8.8,-d);}for(let x=-16;x<16;x+=2)k.box(1,.02,3,'#f1e9d1',center+x,.12,-d);}}
 if(assets){
  for(let i=0;i<24;i++){const d=i*40,center=roadCenter(d);const lamp=assets.prop('lamp');if(lamp)k.add(lamp,center-17,0,-d);const cone=assets.prop('cone');if(cone)k.add(cone,center+15.7,0,-d-9);}
  for(const d of [-20,300,600,900]){const center=roadCenter(d),gantry=assets.prop('gantry');if(gantry){gantry.scale.set(3.2,1.7,1);k.add(gantry,center,0,-d);}for(const dx of [-18,18]){const flag=assets.prop('flag');if(flag)k.add(flag,center+dx,0,-d-3);}}
  for(const d of [45,350,645,870]){const center=roadCenter(d),stand=assets.prop('grandstand');if(stand){stand.scale.setScalar(1.4);stand.rotation.y=Math.PI/2;k.add(stand,center-28,0,-d);}const board=assets.prop('billboard');if(board)k.add(board,center+26,0,-d-20);}
  for(const d of [140,450,740]){const garage=assets.prop('garage');if(garage){garage.rotation.y=Math.PI/2;k.add(garage,roadCenter(d)-30,0,-d);}}
 }
 const fx=particles(k);const cars=s.players.map((_:any,i:number)=>k.add(assets?.vehicle(colors[i%colors.length],'race')||car(colors[i%colors.length]),0,0,0,k.dynamic));
 const traffic=s.traffic.map((item:any,i:number)=>{let g:T.Group;if(item.kind==='car'){g=assets?.vehicle(['#d8d5c4','#578d94','#e8b46c'][i%3],(['sedan','truck','van'] as const)[i%3])||car(['#d8d5c4','#578d94','#e8b46c'][i%3]);}else if(assets?.propIds.includes('barrier')){g=assets.prop('barrier')!;const size=new T.Box3().setFromObject(g).getSize(new T.Vector3());g.scale.multiplyScalar(4.8/size.x);}else{g=new T.Group();k.box(4.8,1.4,.7,'#f08f54',0,1,0,g);for(const x of [-1.5,0,1.5]){const stripe=k.box(.45,1.45,.72,'#fff0d1',x,1,0,g);stripe.rotation.z=.3;}for(const x of [-1.6,1.6])k.box(.4,.5,2,'#46565d',x,.2,0,g);}return k.add(g,0,0,0,k.dynamic);});
 const pickups=s.pickups.map(()=>k.add(coin(),0,0,0,k.dynamic));
 const flames=cars.map((g:T.Group)=>{const jet=k.mesh(new T.ConeGeometry(.36,2.4,12),new T.MeshBasicMaterial({color:'#9cf3ff'}),g,-3,.65,0);jet.rotation.z=Math.PI/2;return jet;});
 return (state,dt,t)=>{const viewer=state.players[state.viewSeat??0];state.players.forEach((p:any,i:number)=>{const d=p.y/10,g=cars[i];g.position.set(roadCenter(d)+W(p.x),.12,-d);const steering=p.heading/.22,blocked=p.x<=350&&steering<0||p.x>=610&&steering>0;g.rotation.y=raceHeading(d,p.speed,blocked?0:steering*245);g.visible=(p.invulnerable<=0||Math.floor(t*12)%2===0)&&(i===(state.viewSeat??0)||Math.abs(p.y-viewer.y)>40||Math.abs(p.x-viewer.x)>26);for(const wheel of g.userData.wheels||[])wheel.rotation.z-=p.speed*dt*.07;flames[i].visible=p.boosting;flames[i].scale.setScalar(1+Math.sin(t*50)*.13);});traffic.forEach((g:any,i:number)=>{const item=state.traffic[i],d=(item.distance+item.speed*state.elapsed)/10;g.position.set(roadCenter(d)+W(item.x),.1,-d);g.rotation.y=item.kind==='car'?raceHeading(d,Math.max(1,item.speed)):0;g.visible=Math.abs(item.distance+item.speed*state.elapsed-viewer.y)<1800;});pickups.forEach((g:any,i:number)=>{const item=state.pickups[i],d=item.distance/10;const visible=!viewer.collected.includes(item.id)&&Math.abs(item.distance-viewer.y)<1600;if(g.visible&&!visible&&viewer.collected.includes(item.id))fx.burst(g.position.x,g.position.y,g.position.z);g.visible=visible;g.position.set(roadCenter(d)+W(item.x),1.6+Math.sin(t*3+i)*.2,-d);g.rotation.y=t*2;g.scale.setScalar(1.5);});fx.update(dt);(water.material as T.MeshStandardMaterial).map!.offset.y=t*.005;};
}
function platformScene(k:Kit,s:State,assets?:PlatformAssets):Step{
 k.sky('#6094c2','#d2ebdc');k.scene.fog=new T.Fog('#b3d4cf',90,235);const water=k.surface(1100,700,'#278fa4','water',-12);water.position.x=200;
 // The scenery moves with the visible part of the endless shared course.
 const backdrop=new T.Group();k.dynamic.add(backdrop);
 for(let i=0;i<17;i++){const x=-150+i*28,h=18+random(i)*44;const mountain=k.mesh(new T.ConeGeometry(18,h,5),k.mat(i%2?'#6d959a':'#8caaab'),backdrop,x,h/2-8,-85-random(i+6)*35);mountain.rotation.y=i;}
 for(let i=0;i<20;i++){const x=-120+i*22,y=18+random(i)*15,z=-35-random(i+9)*25;for(let j=0;j<4;j++){const puff=k.sphere(2.8+random(j+i)*2,'#f2f2e9',x+j*3,y+random(j)*1.5,z,backdrop);puff.scale.y=.45;}}
 k.batch(backdrop);
 const fx=particles(k);const chunks=new Map<number,T.Group>(),gems=new Map<number,T.Group>(),hazards=new Map<number,T.Group>();
 const retire=(g:T.Group)=>{const owned=new Set<T.Material>(),shared=new Set(k.mats.values());g.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])if(!shared.has(m))owned.add(m);}});for(const m of owned){for(const value of Object.values(m))if(value instanceof T.Texture&&!k.textures.includes(value))value.dispose();m.dispose();}g.removeFromParent();};
 const crew=s.players.map((_:any,i:number)=>{const g=assets?.character(i)||explorer(colors[i%colors.length]);if(!assets)g.scale.setScalar(.85);if(g.userData.disposeAnimations)k.cleanups.push(g.userData.disposeAnimations);return k.add(g,0,0,i*.8,k.dynamic);});
 const markers=s.players.map((_:any,i:number)=>k.ring(1.1,.08,colors[i%colors.length],0,0,0,k.dynamic));
 const storm=new T.Group();for(let j=0;j<13;j++){const cloud=k.sphere(5+random(j)*3,'#596a8b',-random(j)*6,j*3-12,-4+random(j+10)*10,storm);cloud.scale.x=.5;}k.add(storm,0,0,0,k.dynamic);
 const lightning=k.mesh(new T.PlaneGeometry(.3,42),new T.MeshBasicMaterial({color:'#d9a7ff',transparent:true,opacity:.5,side:T.DoubleSide}),storm,1,8,0);
 return (state,dt,t)=>{
  const viewer=state.players[state.viewSeat??0],px=viewer.x/10;backdrop.position.x=px*.8;water.position.x=px;storm.position.x=state.stormX/10;lightning.visible=Math.sin(t*12)>.92;storm.visible=state.stormX>viewer.x-750;
  for(const p of state.platforms){
   if(chunks.has(p.id))continue;
   const g=new T.Group(),x=p.x/10,y=(460-p.y)/10,w=p.w/10,snow=Math.floor(p.id/6)%3===1;
   if(assets){
    for(let offset=0;offset<w;offset+=10){const width=Math.min(10,w-offset),tile=assets.prop(snow?'ground-snow':'ground-grass')!;tile.scale.x=width/10;k.add(tile,x+offset+width/2,y,0,g);}
    // Decoration stays behind the running lane; only server hazards block play.
    for(const f of [.22,.78]){const plant=assets.prop(snow?'tree-snow':p.id%3?'tree':'pine')!;plant.scale.setScalar(.7+random(p.id+f)*.3);k.add(plant,x+w*f,y,-3.2,g);}
    for(let j=0;j<4;j++){const detail=assets.prop(snow?'crate':['flowers','mushrooms','plant','grass'][(p.id+j)%4])!;if(snow)detail.scale.setScalar(.55);k.add(detail,x+4+j*(w-8)/4,y,3.7,g);}
    if(p.id%6===0){const flag=assets.prop('flag')!;k.add(flag,x+3,y,-3.8,g);}
   }else{k.add(island(w,p.id),x+w/2,y,0,g);k.add(tree('broadleaf',7),x+w*.3,y,-3.7,g);}
   if(p.id%6===0)k.add(sign(p.id===0?'RUN  /  JUMP  /  SURVIVE':`${snow?'FROST':'GROVE'}  /  ZONE ${Math.floor(p.id/6)+1}`,'#23594f',8),x+w*.55,y,-4.2,g);
   k.dynamic.add(g);k.batch(g);chunks.set(p.id,g);
  }
  for(const [id,g] of chunks)if(!state.platforms.some((p:any)=>p.id===id)){retire(g);chunks.delete(id);}
  for(const item of state.coins){let g=gems.get(item.id);if(!g){g=assets?.prop('coin')||coin();k.dynamic.add(g);gems.set(item.id,g);}const visible=!item.collectedBy.includes(state.viewSeat??0);if(g.visible&&!visible)fx.burst(g.position.x,g.position.y,g.position.z);g.visible=visible;g.position.set(item.x/10,(460-item.y)/10+Math.sin(t*3+item.id)*.2,1.1);g.rotation.y=t*2.2;}
  for(const [id,g] of gems)if(!state.coins.some((p:any)=>p.id===id)){retire(g);gems.delete(id);}
  for(const h of state.hazards){
   let g=hazards.get(h.id);
   if(!g){g=new T.Group();if(h.kind==='thorns'){
    if(assets){const trap=assets.prop('spikes')!;trap.scale.set(1.6,2.8,1.3);g.add(trap);}else for(let j=0;j<4;j++)k.mesh(new T.ConeGeometry(.55,2.7,5),k.mat('#d9786c'),g,(j-1.5)*.9,1.35,0);
   }else if(assets){g.add(assets.prop('saw')!);k.ring(1.8,.055,'#ffae84',0,0,0,g).rotation.x=0;}else{k.sphere(1.5,'#ac75d6',0,0,0,g);k.ring(2,.12,'#f0adff',0,0,0,g).rotation.x=.8;}
    k.dynamic.add(g);hazards.set(h.id,g);
   }
   g.position.set(h.x/10,h.kind==='orb'?(460-h.y+65-Math.sin(state.elapsed*2+h.phase)*25)/10:(460-h.y)/10,1.1);
   if(h.kind==='orb')g.rotation.z=t*4;
  }
  for(const [id,g] of hazards)if(!state.hazards.some((p:any)=>p.id===id)){retire(g);hazards.delete(id);}
  state.players.forEach((p:any,i:number)=>{const g=crew[i];g.position.set(p.x/10,(435-p.y)/10,i===(state.viewSeat??0)?1.2:-1.5-i*.9);if(p.vx)g.rotation.y=p.vx>0?0:Math.PI;if(g.userData.mixer){g.userData.playAnimation(!p.alive?'die':!p.ground?p.vy<0?'jump':'fall':Math.abs(p.vx)>5?'sprint':'idle');g.userData.mixer.update(dt);}else{animateExplorer(g,p,t);if(!p.alive)g.rotation.z=-1.2;}markers[i].position.copy(g.position);markers[i].position.y+=.08;markers[i].visible=p.alive&&p.ground;});
  fx.update(dt);(water.material as T.MeshStandardMaterial).map!.offset.x=t*.003;
 };
}
function animateExplorer(g:T.Group,p:any,time:number){const moving=Math.abs(p.vx||0)+Math.abs(p.vy||0)>5,run=moving?Math.sin(time*13)*.55:Math.sin(time*2)*.025;const u=g.userData;if(u.leftLeg)u.leftLeg.rotation.z=p.ground===false?-.45:run;if(u.rightLeg)u.rightLeg.rotation.z=p.ground===false?.6:-run;if(u.leftArm)u.leftArm.rotation.z=p.attack>0?-1.5:-run*.65;if(u.rightArm)u.rightArm.rotation.z=p.blocking?-1.5:run*.65;}
function garden(k:Kit){k.sky('#67a4c3','#e2d5ad');k.scene.fog=new T.Fog('#b2cec1',100,240);k.surface(260,260,'#739e73','grass',-1);k.mountains();k.trees(65,[-75,75,-55,45],(x,z)=>Math.abs(x)<51&&Math.abs(z)<31);}
function tableScene(k:Kit,s:State):Step{
 const hockey=s.game==='air-hockey';k.sky('#0d1830','#29394b');k.scene.fog=new T.Fog('#152337',100,230);k.surface(220,200,'#253248','stone',-4);
 k.box(101,3,61,'#172532',0,-1.7,0);k.box(97,.5,57,hockey?'#174e63':'#245c58',0,-.1,0);
 for(const z of [-28.5,28.5]){k.box(99,1,1,'#e0daca',0,.5,z);k.box(99,.12,.15,hockey?'#69edec':'#b9d693',0,1.04,z);}
 for(const x of [-48.5,48.5])for(const z of hockey?[-18.8,18.8]:[0])k.box(1,1,hockey?18:57,'#e0daca',x,.5,z);
 k.box(.15,.03,55,'#8cc4c4',0,.18,0);k.ring(8,.12,'#7abdc6',0,.18,0);
 if(hockey)for(const x of [-47,47]){k.ring(11.5,.12,'#5f9ba7',x,.18,0);k.box(3,.08,19,'#091825',x,.1,0);}
 for(let x=-44;x<45;x+=3)for(let z=-25;z<26;z+=3)if(hockey)k.cylinder(.06,.06,.02,'#4c8390',x,.19,z,undefined,4);
 for(let i=0;i<11;i++){const x=-55+i*11;k.box(1,15,1,'#495970',x,3,-40);k.box(.18,10,.18,i%2?'#fc858f':'#59d7ed',x,6,-39.4);}
 const players=s.players.map((_:any,i:number)=>{const g=new T.Group();if(hockey){k.cylinder(2.8,3,.9,colors[i],0,.5,0,g);k.cylinder(1.3,1.65,1.3,colors[i],0,1.4,0,g);k.ring(2.65,.12,'#faf0dc',0,1,0,g);}else{k.box(2.4,1.5,10.4,colors[i],0,.75,0,g);k.box(2.45,.15,8.5,'#fff4db',0,1.55,0,g);}return k.add(g,0,0,0,k.dynamic);});
 const ball=hockey?k.cylinder(1.2,1.2,.55,'#131823',0,.4,0,k.dynamic):k.sphere(1.2,'#fff0c7',0,1.2,0,k.dynamic);
 return state=>{players.forEach((g:any,i:number)=>g.position.set(W(state.players[i].x),0,Z(state.players[i].y)));ball.position.set(W(state.ball.x),hockey?.5:1.2,Z(state.ball.y));};
}
function fighterScene(k:Kit,s:State,assets?:FighterAssets):Step{
 if(!assets)throw new Error('The Yokai fighter assets could not load.');
 k.scene.background=new T.Color('#190f24');
 const backdrop=assets.backdrop();k.dynamic.add(backdrop);
 const fighters=s.players.map((_:any,i:number)=>{const fighter=assets.character(i,8.5);k.dynamic.add(fighter.root);k.cleanups.push(fighter.dispose);return fighter;});
 const shadows=s.players.map(()=>{const m=new T.MeshBasicMaterial({color:'#080710',transparent:true,opacity:.3,depthWrite:false,toneMapped:false});const shadow=k.mesh(new T.CircleGeometry(1,32),m,k.dynamic);shadow.scale.set(3.2,.38,1);shadow.castShadow=shadow.receiveShadow=false;return shadow;});
 const guards=s.players.map((_:any,i:number)=>{const guard=k.mesh(new T.RingGeometry(3.1,3.2,48,1,-Math.PI/2,Math.PI),new T.MeshBasicMaterial({color:i?'#ffe29a':'#aee6ff',transparent:true,opacity:.75,side:T.DoubleSide,depthWrite:false,toneMapped:false}),k.dynamic);guard.castShadow=guard.receiveShadow=false;return guard;});
 const fx=particles(k);let hp=s.players.map((p:any)=>p.hp),seq=s.players.map(()=>-1),round=s.round;
 return(state,dt)=>{
  const reset=round!==state.round;round=state.round;
  state.players.forEach((p:any,i:number)=>{
   const fighter=fighters[i],g=fighter.root;g.position.set(W(p.x),(410-p.y)/10,0);fighter.face(p.facing);
   const attacking=p.attack>0,changed=seq[i]!==p.attackSeq;seq[i]=p.attackSeq;
   fighter.setAnimation(p.hp<=0?'death':p.stun>0?'hurt':attacking?p.attackKind==='kick'?'kick':'punch':p.blocking?'block':!p.ground?p.vy<0?'jump':'fall':Math.abs(p.vx)>5?'run':'idle',reset||attacking&&changed);
   fighter.update(dt);
   shadows[i].position.set(g.position.x,-.14,-.1);shadows[i].scale.set(3.2/(1+g.position.y*.06),.38,1);
   guards[i].visible=p.blocking&&p.hp>0;guards[i].position.set(g.position.x+p.facing*.6,g.position.y+4.1,.1);guards[i].rotation.y=p.facing<0?Math.PI:0;
   if(p.hp<hp[i])fx.burst(g.position.x,g.position.y+4.7,.5,p.blocking?'#b3e8ff':'#ffe1a0',p.blocking?7:17);hp[i]=p.hp;
  });fx.update(dt);
 };
}
function golfScene(k:Kit,s:State,assets?:SceneryAssets,golf?:GolfAssets):Step{
 garden(k);k.surface(140,90,'#91ad76','grass',-.8);const courses:T.Group[]=[];
 for(const course of golfCourses){const group=new T.Group();k.dynamic.add(group);courses.push(group);
  for(const p of course.cells){const atCup=p.x===course.cup.x&&p.y===course.cup.y,tile=golf?.tile(atCup?'hole-open':'open');if(tile)k.add(tile,W(p.x),0,Z(p.y),group);else k.box(10,.4,10,'#75b485',W(p.x),-.2,Z(p.y),group);}
  for(const wall of course.walls){if(wall.w!==10&&wall.h!==10)continue;const rail=golf?.prop('rail');if(rail){rail.rotation.y=wall.w>wall.h?Math.PI/2:0;k.add(rail,W(wall.x+wall.w/2),0,Z(wall.y+wall.h/2),group);}else k.box(wall.w/10,.83,wall.h/10,'#d8ac75',W(wall.x+wall.w/2),.415,Z(wall.y+wall.h/2),group);}
  for(const obstacle of course.obstacles){const prop=golf?.prop(obstacle.kind);if(prop){prop.scale.setScalar(obstacle.scale);prop.rotation.y=obstacle.rotation||0;k.add(prop,W(obstacle.x),0,Z(obstacle.y),group);}}
  const flag=assets?.prop('flag');if(flag){flag.scale.setScalar(.55);k.add(flag,W(course.cup.x),-.1,Z(course.cup.y),group);}k.ring(.8,.06,'#ffe49d',W(course.tee.x),.025,Z(course.tee.y),group);k.batch(group);group.visible=false;
 }
 const windmill=assets?.prop('windmill');if(windmill){windmill.rotation.y=Math.PI;k.add(windmill,39,0,-34,k.dynamic);}if(assets){k.add(assets.prop('castle')!,-30,0,-33);for(const x of [-52,52]){const fox=assets.prop('fox')!;fox.rotation.y=x<0?Math.PI/2:-Math.PI/2;k.add(fox,x,0,5);}}
 k.add(sign('VERDANT  /  SIX GARDEN HOLES','#254c44',22),0,0,-33);
 for(let x=-48;x<=48;x+=12){k.add(tree('broadleaf',7+random(x)*4),x,0,32);k.sphere(.6,'#e2a18a',x+2,.7,28);}
 const balls=s.players.map((_:any,i:number)=>{const ball=assets?.ball(colors[i])||new T.Group();ball.scale.setScalar(.55);return k.add(ball,0,.55,0,k.dynamic);});
 const current=k.ring(.95,.07,'#fff5c9',0,.04,0,k.dynamic),pointer=k.mesh(new T.ConeGeometry(.45,1,12),new T.MeshBasicMaterial({color:'#fff4bd'}),k.dynamic);pointer.rotation.z=Math.PI;
 return(state,dt)=>{courses.forEach((course,i)=>course.visible=i===Math.min(golfCourses.length-1,state.hole));const blades=windmill?.getObjectByName('blades');if(blades)blades.rotation.z+=dt*.6;
  balls.forEach((b:any,i:number)=>{const p=state.players[i],turn=state.players[state.turn];b.position.set(W(p.x),.55,Z(p.y));b.rotation.x+=(p.vy||0)*dt*.18;b.rotation.z-=(p.vx||0)*dt*.18;b.visible=!p.sunk&&(i===state.turn||Math.hypot(p.x-turn.x,p.y-turn.y)>13);});const p=state.players[state.turn];current.position.set(W(p.x),.03,Z(p.y));current.visible=!state.moving&&!state.finished;pointer.position.set(W(p.x),2.5,Z(p.y));pointer.visible=current.visible;
 };
}
function marbleRunScene(k:Kit,s:State,assets?:ActionAssets,scenery?:SceneryAssets):Step{
 k.sky('#5a98ca','#d9dce7');k.scene.fog=new T.Fog('#bccfdf',80,230);const water=k.surface(1500,1100,'#6a9aa5','water',-55);water.position.x=400;
 for(let i=-3;i<92;i++){if(s.gaps.includes(i*100))continue;const tile=assets?.prop('track-wide');if(tile)k.add(tile,i*10+5,-2.5,0);if(i%3===0){const support=assets?.prop('track-support');if(support)k.add(support,i*10+5,-9.5,0);const island=k.mesh(new T.ConeGeometry(7,25,6),k.mat(i%2?'#7b9f93':'#809fa8'),k.fixed,i*10+5,-22,0);island.rotation.z=Math.PI;}
  if(i%10===0){const gate=assets?.prop('track-gate');if(gate){gate.scale.z=1.8;k.add(gate,i*10,0,0);}k.add(sign(i===90?'FINISH':`${Math.max(0,i*10)} m`,'#355975',5),i*10,7,-11);}
 }
 const fans:T.Object3D[]=[];for(let i=0;i<10;i++){const x=i*95+25;const g=assets?.prop('track-fan');if(g){k.add(g,x,-2.5,-18,k.dynamic);fans.push(g);}k.cylinder(8,5,3,'#b6b2bd',x,-4,-18);k.add(tree('pine',8),x-6,-2.5,-22);for(let j=0;j<3;j++){const cloud=k.sphere(6,'#ecedf3',x+j*8,-10-random(i)*6,18+random(i+2)*15);cloud.scale.y=.4;}}
 for(const b of s.bumpers||[]){k.box(1.8,2.5,3.6,'#d5776c',b.x/10,1.25,b.y/10);for(const z of [-1,0,1])k.box(1.84,.3,.3,'#fff0bc',b.x/10,1.9,b.y/10+z);}
 const balls=s.players.map((_:any,i:number)=>{const g=scenery?.ball(colors[i])||new T.Group();g.scale.setScalar(.47);return k.add(g,0,.9,0,k.dynamic);});const coins=s.pickups.map(()=>k.add(coin(),0,0,0,k.dynamic)),fx=particles(k);let oldCoins=s.players.map(()=>0);
 const surface=(z:number)=>Math.abs(z)<=2?0:Math.abs(z)<=5.75?(Math.abs(z)-2)/6:.625+(Math.abs(z)-5.75)*1.5;
 return(state,dt,t)=>{const p=state.players[state.viewSeat??0];balls.forEach((g:any,i:number)=>{const q=state.players[i];g.position.set(q.x/10,.9+surface(q.y/10)+q.height/10,q.y/10);g.rotation.z-=(q.vx||0)*dt*.12;g.rotation.x+=(q.vy||0)*dt*.12;g.visible=q.alive&&q.respawn<=0&&(i===(state.viewSeat??0)||Math.abs(q.x-p.x)>18||Math.abs(q.y-p.y)>14);if(q.coins>oldCoins[i])fx.burst(g.position.x,g.position.y,g.position.z);oldCoins[i]=q.coins;});coins.forEach((g:any,i:number)=>{const item=state.pickups[i];g.visible=!p.collected.includes(item.id)&&Math.abs(item.x-p.x)<1400;g.position.set(item.x/10,1.6+surface(item.y/10)+Math.sin(t*3+i)*.15,item.y/10);g.rotation.y=t*2;});for(const f of fans){const blade=f.getObjectByName('fan');if(blade)blade.rotation.z+=dt*2;}fx.update(dt);};
}
function tankScene(k:Kit,s:State,assets?:ActionAssets):Step{
 k.sky('#8bb6c7','#ece0b9');k.scene.fog=new T.Fog('#c1cabb',100,220);k.surface(240,200,'#8da177','grass',-1);k.box(98,1.5,58,'#789589',0,-.8,0);
 for(let x=-45;x<=45;x+=10)for(let z=-25;z<=25;z+=10)k.box(9.9,.06,9.9,(x+z)%20?'#bcb99d':'#cfcaad',x,.02,z);
 for(const z of [-27,27])k.box(94,1.7,.8,'#577c73',0,.8,z);for(const x of [-47,47])k.box(.8,1.7,54,'#577c73',x,.8,0);
 for(const w of s.walls){const x=W(w.x+w.w/2),z=Z(w.y+w.h/2);k.box(w.w/10,3.6,w.h/10,'#688f86',x,1.8,z);k.box(w.w/10+.2,.25,w.h/10+.2,'#d3c8a3',x,3.7,z);for(const dx of [-1,1])for(const dz of [-1,1]){const column=assets?.prop('arena-column');if(column){column.scale.set(.28,.33,.28);k.add(column,x+dx*(w.w/20-.5),0,z+dz*(w.h/20-.5));}}}
 for(const [index,w] of s.walls.entries()){const machine=assets?.prop(index===1?'screen':'machine');if(machine){machine.scale.setScalar(index===1?1:.75);k.add(machine,W(w.x+w.w/2),3.85,Z(w.y+w.h/2));}}
 for(const x of [-53,53]){k.add(tree('broadleaf',10),x,0,-22);const machine=assets?.prop('machine');if(machine)k.add(machine,x,0,4);const screen=assets?.prop('screen');if(screen)k.add(screen,x,0,-10);}
 for(const x of [-35,35]){const beacon=assets?.prop('beacon');if(beacon)k.add(beacon,x,0,-32);}k.add(sign('TOY TANK ARENA  /  FIRST TO FIVE','#31584f',20),0,0,-33);
 const crates=s.crates.map((c:any)=>{const g=assets?.prop('crate')||new T.Group();return k.add(g,W(c.x),0,Z(c.y),k.dynamic);});
 const tanks=s.players.map((_:any,i:number)=>k.add(assets?.tank(colors[i])||car(colors[i]),0,0,0,k.dynamic)),markers=s.players.map((_:any,i:number)=>k.ring(2.6,.08,colors[i],0,.06,0,k.dynamic));const shots:T.Mesh[]=[],fx=particles(k);let hp=s.players.map((p:any)=>p.hp),nextShot=0;
 return(state,dt,t)=>{state.players.forEach((p:any,i:number)=>{const g=tanks[i];g.position.set(W(p.x),.08,Z(p.y));g.rotation.y=-p.heading;g.visible=p.respawn<=0&&(state.finished||p.invulnerable<=0||Math.floor(t*12)%3!==0);if(g.userData.turret)g.userData.turret.rotation.y=p.heading-p.aim;if(p.hp<hp[i])fx.burst(g.position.x,1.5,g.position.z,p.hp===0?'#ffce7b':colors[i],p.hp===0?35:12);hp[i]=p.hp;markers[i].position.set(W(p.x),.06,Z(p.y));markers[i].visible=p.respawn<=0;});crates.forEach((g:any,i:number)=>{if(g.visible&&state.crates[i].hp<=0)fx.burst(g.position.x,1,g.position.z,'#d9b47e',22);g.visible=state.crates[i].hp>0;});shots.forEach(o=>o.visible=false);state.shots.forEach((p:any,i:number)=>{if(!shots[i])shots[i]=k.sphere(.35,'#ffe1a1',0,0,0,k.dynamic);const o=shots[i];o.position.set(W(p.x),1.7,Z(p.y));o.visible=true;if(p.id>=nextShot)fx.burst(o.position.x,1.7,o.position.z,'#fff0b5',4);});nextShot=state.nextShot;fx.update(dt);};
}

function gridScene(k:Kit,s:State):Step{
 const snake=s.game==='snake-arena',n=snake?25:13,size=50/n;garden(k);k.box(54,2.5,54,'#617966',0,-1.5,0);
 for(let x=0;x<n;x++)for(let y=0;y<n;y++){k.box(size-.06,.3,size-.06,(x+y)%2?'#c3d0a5':'#d8dfb9',(x+.5)*size-25,0,(y+.5)*size-25);if(!snake&&(x===0||y===0||x===12||y===12||x%2===0&&y%2===0)){k.box(size-.15,3.2,size-.15,'#6a8880',(x+.5)*size-25,1.7,(y+.5)*size-25);k.box(size, .3,size,'#a4bca0',(x+.5)*size-25,3.4,(y+.5)*size-25);}}
 const pool=new Map<string,T.Object3D>();
 function use(key:string,create:()=>T.Object3D,x:number,y:number,z:number){let m=pool.get(key);if(!m){m=create();k.dynamic.add(m);pool.set(key,m);}m.visible=true;m.position.set(x,y,z);return m;}
 return (state,dt,t)=>{pool.forEach(o=>o.visible=false);state.players.forEach((p:any,i:number)=>{if(!p.alive)return;if(snake)p.body.forEach((cell:any,j:number)=>{use(`snake${i}-${j}`,()=>{const g=new T.Group();const body=k.sphere(size*.49,colors[i],0,0,0,g);body.scale.y=.75;if(j===0)for(const x of [-.35,.35]){k.sphere(.23,'#fff9e3',x,.45,-.5,g);k.sphere(.12,'#163742',x,.5,-.68,g);}return g;},(cell.x+.5)*size-25,.85,(cell.y+.5)*size-25);});else{const m=use('player'+i,()=>{const g=explorer(colors[i]);g.scale.setScalar(.65);return g;},(p.x+.5)*size-25,.25,(p.y+.5)*size-25);m.rotation.y=Math.sin(t*.7)*.15;}});
 if(snake)state.food.forEach((f:any,i:number)=>{const m=use('food'+i,()=>crystal('#ffb378'),(f.x+.5)*size-25,1+Math.sin(t*3+i)*.2,(f.y+.5)*size-25);m.rotation.y=t;});
 else{state.blocks.forEach((b:string)=>{const [x,y]=b.split(',').map(Number);use('block'+b,()=>{const g=new T.Group();k.box(3,2.7,3,'#ba9068',0,1.4,0,g);for(const a of [-1,1]){k.box(3.05,.25,.25,'#e1bd87',0,a*.8+1.4,1.51);k.box(.25,2.7,.25,'#e1bd87',a*1.2,1.4,1.51);}return g;},(x+.5)*size-25,0,(y+.5)*size-25);});state.bombs.forEach((b:any,i:number)=>{const m=use('bomb'+i,()=>{const g=new T.Group();k.sphere(1.2,'#9877bf',0,1.2,0,g);k.cylinder(.1,.1,.6,'#ffe59e',0,2.6,0,g);return g;},(b.x+.5)*size-25,0,(b.y+.5)*size-25);m.scale.setScalar(1+Math.sin(t*15)*.06);});state.blasts.forEach((b:any,i:number)=>{const m=use('blast'+i,()=>k.sphere(1.8,'#ffeec2',0,0,0,new T.Group()),(b.x+.5)*size-25,1,(b.y+.5)*size-25);m.scale.setScalar(1+Math.sin(t*20)*.2);});}
 };
}
function marbleScene(k:Kit,s:State,assets?:SceneryAssets):Step{
 k.sky('#676aa7','#dac5d0');k.scene.fog=new T.Fog('#b9bfd3',120,300);k.mountains(-180,200,-100);
 for(let i=0;i<22;i++){const a=i*2.4,r=55+random(i)*50;const island=k.mesh(new T.ConeGeometry(8,24,6),k.mat('#778d9b'),k.fixed,Math.cos(a)*r,-15+random(i)*10,Math.sin(a)*r);island.rotation.z=Math.PI;}
 const arena=new T.Group();k.cylinder(24.5,23,2,'#9c99a9',0,-1,0,arena);k.cylinder(24.3,24.3,.2,'#e7cd9a',0,.1,0,arena);for(const radius of [8,16,23.5])k.ring(radius,.1,'#c4a77e',0,.22,0,arena);k.add(arena,0,0,0,k.dynamic);
 const fans:T.Object3D[]=[];if(assets){for(const x of [-35,35]){k.cylinder(8,4,6,'#87919d',x,-3,-5);for(const z of [-10,1])k.add(assets.prop(z<0?'tree-tall':'tree')!,x+3,0,z);const fan=assets.prop('fan')!;fan.rotation.y=x<0?-Math.PI/2:Math.PI/2;k.add(fan,x,0,-5,k.dynamic);fans.push(fan);k.add(assets.prop('fox')!,x,0,2);}k.add(assets.prop('banner')!,0,0,-28);}
 const balls=s.players.map((_:any,i:number)=>{const model=assets?.ball(colors[i]);if(model){k.ring(1.92,.055,'#fff1cd',0,0,0,model).rotation.x=.4;return k.add(model,0,0,0,k.dynamic);}const g=new T.Group();k.mesh(new T.SphereGeometry(1.9,24,16),k.mat(colors[i],.15,.45),g,0,0,0);k.ring(1.91,.09,'#fff1cd',0,0,0,g).rotation.x=.4;return k.add(g,0,0,0,k.dynamic);});
 return (state,dt)=>{fans.forEach(f=>{const blade=f.getObjectByName('fan');if(blade)blade.rotation.z+=dt*2;});arena.scale.set(state.radius/245,1,state.radius/245);balls.forEach((g:any,i:number)=>{const p=state.players[i];g.visible=p.alive;g.position.set(W(p.x),2.1,Z(p.y));g.rotation.x+=(p.vy||0)*dt*.025;g.rotation.z-=(p.vx||0)*dt*.025;});};
}
function paintScene(k:Kit,s:State):Step{
 garden(k);k.surface(96,56,'#d8c59e','stone',.02);for(const z of [-29,29])k.box(98,2,1,'#6c9287',0,1,z);for(const x of [-49,49])k.box(1,2,58,'#6c9287',x,1,0);
 for(const w of s.walls){const x=W(w.x+w.w/2),z=Z(w.y+w.h/2);k.box(w.w/10,4.5,w.h/10,'#2e7771',x,2.25,z);k.box(w.w/10+.2,.35,w.h/10+.2,'#8bbfa1',x,4.6,z);for(let i=0;i<4;i++)k.sphere(.7,colors[i],x+3.1,2+i*.4,z-5+i*3);}
 for(let i=0;i<10;i++){const x=-42+i*9;k.add(tree('palm',7+random(i)*3),x,0,-34);}
 k.add(sign('COLOUR  /  CLASH','#1b4f50',18),0,0,-34);
 const people=s.players.map((_:any,i:number)=>{const g=explorer(colors[i]);g.scale.setScalar(.8);k.box(2,.6,.65,'#344d54',1.8,2.5,0,g);return k.add(g,0,0,0,k.dynamic);});
 const shots:T.Mesh[]=[];
 return (state,dt,t)=>{people.forEach((g:any,i:number)=>{const p=state.players[i];g.position.set(W(p.x),0,Z(p.y));g.rotation.y=-p.aim;g.visible=true;animateExplorer(g,{vx:100},t);});shots.forEach(p=>p.visible=false);state.shots.forEach((p:any,i:number)=>{if(!shots[i])shots[i]=k.sphere(.7,colors[p.owner],0,0,0,k.dynamic);const shot=shots[i];(shot.material as T.MeshStandardMaterial).color.set(colors[p.owner]);shot.visible=true;shot.position.set(W(p.x),2.2,Z(p.y));});};
}
function kitchenScene(k:Kit,s:State,assets?:SceneryAssets):Step{
 k.sky('#80c4ce','#e8dab5');k.surface(150,130,'#8ba17a','grass',-2);k.box(102,2,62,'#be9e77',0,-1,0);
 for(let x=0;x<16;x++)for(let z=0;z<10;z++)k.box(5.9,.15,5.9,(x+z)%2?'#e6d8b5':'#a8bfad',-45+x*6,.03,-27+z*6);
 k.box(100,11,1,'#f1c9a2',0,5.5,-30);for(const x of [-32,0,32]){k.box(16,6,.3,'#6aa3a3',x,6,-29.3);k.box(.3,6,.4,'#fff2d7',x,6,-29);k.box(16,.3,.4,'#fff2d7',x,6,-29);}
 const food=(id:string)=>assets?.prop(id)||crystal(id==='tomato'?'#ff8669':'#b3d68b');
 const display=()=>{const root=new T.Group();const variants=new Map<string,T.Object3D>();for(const [value,id] of [['tomato','tomato'],['lettuce','cabbage'],['chopped tomato','tomato'],['salad','salad'],['soup','soup']]){const model=food(id);if(value==='chopped tomato')model.scale.y=.4;root.add(model);model.visible=false;variants.set(value,model);}return {root,show(value:string|null){variants.forEach((model,key)=>{model.visible=key===value;});}};};
 const items:ReturnType<typeof display>[]=[],steam:T.Group[]=[];
 for(const st of s.stations){
  const x=W(st.x),z=Z(st.y);k.box(12,3.5,10,'#668a84',x,1.75,z);k.box(12.5,.7,10.5,'#ece3cc',x,3.7,z);k.add(sign(st.kind.toUpperCase(),'#30534f',8),x,3,z-5);
  const puff=new T.Group();for(let j=0;j<3;j++){const cloud=k.sphere(.35,'#fff3dc',Math.sin(j)*.55,j*.6,0,puff);cloud.scale.y=1.6;}k.add(puff,x+2,7,z,k.dynamic);steam.push(puff);
  if(st.kind==='cook'){for(const dx of [-2.5,2.5])k.cylinder(1.7,1.7,.2,'#344b4c',x+dx,4.1,z);k.add(food('pot'),x+2.2,4.2,z);k.add(food('pan'),x-2.2,4.2,z);}
  else if(['tomato','lettuce'].includes(st.kind)){k.box(9,.8,6,'#b08c62',x,4.3,z);for(let j=0;j<4;j++)k.add(food(st.kind==='lettuce'?'cabbage':'tomato'),x-3+(j%2)*5,4.7,z+(j<2?-1.7:1.5));}
  else if(st.kind==='chop')k.add(food('cutting-board'),x,4.1,z);
  else k.add(food('plate'),x,4.1,z);
  const item=display();k.add(item.root,x,4.8,z,k.dynamic);items.push(item);
 }
 if(assets){for(let i=0;i<3;i++){k.box(12,.5,4,'#805f46',-16+i*15,6,-27);k.add(food(['cheese','loaf','burger'][i]),-16+i*15,6.3,-27);}}
 const carried:ReturnType<typeof display>[]=[];
 const crew=s.players.map((_:any,i:number)=>{const g=explorer(colors[i]);k.cylinder(1,1,.6,'#fff4de',0,5.2,0,g);k.sphere(1.1,'#fff4de',0,5.7,0,g);const tray=display();k.add(tray.root,1.6,2.8,0,g);carried.push(tray);g.scale.setScalar(1.1);return k.add(g,0,0,0,k.dynamic);});
 return (state,dt,t)=>{crew.forEach((g:any,i:number)=>{const p=state.players[i],x=W(p.x),z=Z(p.y),dx=x-g.position.x,dz=z-g.position.z;g.position.set(x,.2,z);if(Math.hypot(dx,dz)>.005)g.rotation.y=-Math.atan2(dz,dx);animateExplorer(g,{vx:Math.hypot(dx,dz)/Math.max(dt,.001)},t);carried[i].show(p.carrying);});items.forEach((item,i)=>{item.show(state.stations[i].item);steam[i].visible=state.stations[i].kind==='cook'&&Boolean(state.stations[i].item);steam[i].position.y=7+Math.sin(t*2)*.3;});};
}
function spaceScene(k:Kit,s:State,assets?:SceneryAssets):Step{
 k.sky('#030818','#13223a');const stars:number[]=[];for(let i=0;i<1500;i++)stars.push((random(i+1)-.5)*500,(random(i+22)-.4)*200,(random(i+4)-.5)*500);const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(stars,3));k.dynamic.add(new T.Points(geo,new T.PointsMaterial({color:'#d7eeff',size:.35,sizeAttenuation:true})));
 const planet=k.sphere(37,'#316d8f',-48,-46,-70);planet.rotation.z=.4;k.ring(48,1.3,'#a2bec6',-48,-46,-70).rotation.x=.4;k.sphere(11,'#bb9f92',65,14,-80);
 const crane=assets?.prop('crane');if(assets){const station=new T.Group();k.dynamic.add(station);station.scale.setScalar(.55);station.position.set(-20,-3,-2);k.box(40,2,25,'#414f60',-28,-2,-42,station);for(const [id,x,z] of [['pipe',-40,-43],['machine',-24,-42],['screen',-14,-35],['robot-arm',-16,-47]] as [string,number,number][])k.add(assets.prop(id)!,x,-1,z,station);if(crane)k.add(crane,-32,-1,-45,station);for(const x of [-54,-1]){k.box(20,.25,16,'#355a89',x,-1,-42,station);for(let j=0;j<5;j++)k.box(.15,.03,15.5,'#6c99ba',x-8+j*4,-.85,-42,station);}}
 const ship=new T.Group();k.box(4.5,1.1,2,'#dfe5de',0,0,0,ship);k.sphere(1.1,'#70becb',.7,.7,0,ship);const nose=k.mesh(new T.ConeGeometry(1,2,4),k.mat('#ece7cf'),ship,3,0,0);nose.rotation.z=-Math.PI/2;for(const z of [-2,2]){const wing=k.box(3,.25,2.5,'#c58566',-1,0,z,ship);wing.rotation.y=z*.2;}k.add(ship,0,1,0,k.dynamic);
 const flame=k.mesh(new T.ConeGeometry(.65,3,10),new T.MeshBasicMaterial({color:'#a4edff'}),ship,-3.6,0,0);flame.rotation.z=Math.PI/2;
 const probes=s.probes.map((p:any)=>{const g=new T.Group();k.sphere(1.4,'#e9cca1',0,0,0,g);for(const x of [-3,3]){k.box(2.8,.2,3,'#5672b9',x,0,0,g);k.box(.12,.05,3.1,'#9eadd2',x,.2,0,g);}k.ring(5.4,.12,'#8dced6',0,-1.2,0,g);return k.add(g,W(p.x),1,Z(p.y),k.dynamic);});
 return (state,dt,t)=>{const arm=crane?.getObjectByName('arm');if(arm)arm.rotation.y=Math.sin(t*.18)*.3;ship.position.set(W(state.ship.x),1,Z(state.ship.y));ship.rotation.y=-state.ship.heading;flame.scale.y=.5+Math.min(1,Math.hypot(state.ship.vx,state.ship.vy)/100)+Math.sin(t*30)*.1;probes.forEach((g:any,i:number)=>{g.visible=!state.probes[i].rescued;g.rotation.y=t*.15;g.position.y=1+Math.sin(t+i)*.35;});};
}

export type WorldMetrics={fps:number;drawCalls:number;triangles:number;quality:string};
export class WorldRenderer {
 private k=new Kit();private environment:T.WebGLRenderTarget;private renderer:T.WebGLRenderer;private camera=new T.PerspectiveCamera(42,1,.1,1000);private fighterCamera:T.OrthographicCamera|null=null;private step:Step;
 private aim=0;private power=.65;private guide:T.Line|null=null;private frame=0;private last=0;private samples=0;private sampleAt=0;private elapsed=0;private look=new T.Vector3();private cameraReady=false;private snapshots:{s:State;at:number}[]=[];private resize:ResizeObserver;
 private mode='follow';private seat:number|null;private game:string;private sun:T.DirectionalLight;private visible=true;private observer:IntersectionObserver;private ratio=1;private framesLow=0;private disposed=false;
 constructor(private host:HTMLElement,state:State,seat:number|null,private metrics:(m:WorldMetrics)=>void,assets:WorldAssets={}){
  this.seat=seat;this.game=state.game;this.host.dataset.assetPack=state.game==='stick-rivals'?'craftpix-yokai':state.game==='cat-defense'?'craftpix-cat-defense':Object.keys(assets).length?'kenney':'original';if(['stick-rivals','cat-defense','bridge-builders','pocket-soccer'].includes(state.game))this.fighterCamera=new T.OrthographicCamera(-35,35,20,-20,.1,200);this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});const environment=new RoomEnvironment(),pmrem=new T.PMREMGenerator(this.renderer);this.environment=pmrem.fromScene(environment,.04);this.k.scene.environment=this.environment.texture;this.k.scene.environmentIntensity=['air-hockey','paddle-duel','orbit-rescue'].includes(state.game)?.55:.3;environment.dispose();pmrem.dispose();this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.95;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;this.ratio=Math.min(devicePixelRatio,1.6);this.renderer.setPixelRatio(this.ratio);host.appendChild(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label',state.game==='stick-rivals'?'Animated Yokai fighting arena':state.game==='cat-defense'?'Cat Defense street battle':state.game==='pocket-soccer'?'3D soccer stadium':state.game==='bridge-builders'?'3D bridge ravine':'3D game environment');this.sun=this.k.light(['pocket-soccer','air-hockey','paddle-duel','orbit-rescue'].includes(this.game));
  const scenes:Record<string,(k:Kit,s:State)=>Step>={'bridge-builders':bridgeScene,'pocket-soccer':(kit,state)=>soccerScene(kit,state,assets.soccer!),'cat-defense':(kit,state)=>catsScene(kit,state,assets.cats!),'pocket-racers':(kit,state)=>raceScene(kit,state,assets.racing,assets.scenery),'platform-relay':(kit,state)=>platformScene(kit,state,assets.platform),'stick-rivals':(kit,state)=>fighterScene(kit,state,assets.fighters),'tank-arena':(kit,state)=>tankScene(kit,state,assets.action),'marble-run':(kit,state)=>marbleRunScene(kit,state,assets.action,assets.scenery),'paddle-duel':tableScene,'air-hockey':tableScene,'snake-arena':gridScene,'bomb-maze':gridScene,'mini-golf':(kit,state)=>golfScene(kit,state,assets.scenery,assets.golf),'marble-knockout':(kit,state)=>marbleScene(kit,state,assets.scenery),'paint-tag':paintScene,'kitchen-rush':(kit,state)=>kitchenScene(kit,state,assets.scenery),'orbit-rescue':(kit,state)=>spaceScene(kit,state,assets.scenery)};
  this.step=scenes[this.game](this.k,state);this.k.batch();if(this.game==='mini-golf'){const geometry=new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]);this.guide=new T.Line(geometry,new T.LineDashedMaterial({color:'#fff2c4',dashSize:.6,gapSize:.4}));this.k.dynamic.add(this.guide);}this.push(state,seat);
  this.resize=new ResizeObserver(()=>this.size());this.resize.observe(host);this.size();this.observer=new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;});this.observer.observe(host);
  this.frame=requestAnimationFrame(this.draw);
 }
 static async prepare(game:string):Promise<WorldAssets>{
  const assets:WorldAssets={};
  await Promise.all([
   game==='pocket-soccer'?import('./soccer-assets').then(m=>m.loadSoccerAssets()).then(a=>{assets.soccer=a;}):undefined,
   game==='cat-defense'?import('./cat-assets').then(m=>m.loadCatAssets()).then(a=>{assets.cats=a;}):undefined,
   game==='pocket-racers'?import('./racing-assets').then(m=>m.loadRacingAssets()).then(a=>{assets.racing=a;}):undefined,
   game==='platform-relay'?import('./platform-assets').then(m=>m.loadPlatformAssets()).then(a=>{assets.platform=a;}):undefined,
   ['pocket-racers','mini-golf','marble-knockout','marble-run','kitchen-rush','orbit-rescue'].includes(game)?import('./scenery-assets').then(m=>m.loadSceneryAssets(game==='marble-run'?'marble-knockout':game)).then(a=>{assets.scenery=a;}):undefined,
   ['marble-run','tank-arena'].includes(game)?import('./action-assets').then(m=>m.loadActionAssets(game)).then(a=>{assets.action=a;}):undefined,
   game==='stick-rivals'?import('./fighter-assets').then(m=>m.loadFighterAssets()).then(a=>{assets.fighters=a;}):undefined,
   game==='mini-golf'?import('./golf-assets').then(m=>m.loadGolfAssets()).then(a=>{assets.golf=a;}):undefined,
  ]);return assets;
 }
 aimAt(clientX:number,clientY:number){if(this.game!=='mini-golf')return null;const rect=this.host.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2),this.camera);const point=ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-.55),new T.Vector3());if(!point)return null;const s=this.snapshots.at(-1)!.s,p=s.players[this.seat??0],dx=(point.x-W(p.x))*10,dy=(point.z-Z(p.y))*10;return {angle:Math.atan2(dy,dx),power:clamp(Math.hypot(dx,dy)*1.15/420,.05,1)};}
 setAim(angle:number,power:number){this.aim=angle;this.power=power;}
 setCamera(mode:string){this.mode=mode;this.cameraReady=false;}
 private size(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
 push(s:State,seat:number|null){this.seat=seat;const old=this.snapshots.at(-1);if(old?.s===s||old&&old.s.tick===s.tick&&old.s.finished===s.finished)return;this.snapshots.push({s,at:performance.now()});if(this.snapshots.length>8)this.snapshots.shift();}
 private state(now:number){
  const latest=this.snapshots.at(-1)!;if(latest.s.finished||this.snapshots.length<2)return latest.s;
  const tick=latest.s.tick+Math.min(1.5,(now-latest.at)/50)-1;let a=this.snapshots[0],b=latest;for(let i=1;i<this.snapshots.length;i++)if(this.snapshots[i].s.tick>=tick){a=this.snapshots[i-1];b=this.snapshots[i];break;}
  const f=clamp((tick-a.s.tick)/Math.max(1,b.s.tick-a.s.tick),0,1),blend=(p:any,q:any)=>{if(!p||!q||!Number.isFinite(q.x)||!Number.isFinite(p.x)||Math.hypot(p.x-q.x,p.y-q.y)>130)return q;return {...q,x:T.MathUtils.lerp(p.x,q.x,f),y:T.MathUtils.lerp(p.y,q.y,f),...(Number.isFinite(q.height)?{height:T.MathUtils.lerp(p.height??q.height,q.height,f)}:{}),...(Number.isFinite(q.heading)?{heading:p.heading+Math.atan2(Math.sin(q.heading-p.heading),Math.cos(q.heading-p.heading))*f}:{}),...(this.game==='bridge-builders'?{length:q.length>=p.length?T.MathUtils.lerp(p.length,q.length,f):q.length,rotation:q.rotation>=p.rotation?T.MathUtils.lerp(p.rotation,q.rotation,f):q.rotation}:{})};};
  return {...latest.s,players:b.s.players.map((p:any,i:number)=>blend(a.s.players[i],p)),...(b.s.ball?{ball:blend(a.s.ball,b.s.ball)}:{}),...(b.s.ship?{ship:blend(a.s.ship,b.s.ship)}:{}),...(this.game==='cat-defense'?{enemies:b.s.enemies.map((e:any)=>blend(a.s.enemies.find((p:any)=>p.id===e.id),e)),shots:b.s.shots.map((e:any)=>blend(a.s.shots.find((p:any)=>p.id===e.id),e))}:{})};
 }
 private draw=(now:number)=>{
  if(this.disposed)return;this.frame=requestAnimationFrame(this.draw);const dt=Math.min(.05,(now-(this.last||now))/1000);this.last=now;if(document.hidden||!this.visible){this.sampleAt=now;this.samples=0;return;}this.elapsed+=dt;
  const s=this.state(now),p=s.players[this.seat??0],target=new T.Vector3(),eye=new T.Vector3();this.step({...s,viewSeat:this.seat??0},dt,this.elapsed);
  if(this.game==='pocket-racers'){const d=p.y/10,x=roadCenter(d)+W(p.x),z=-d;target.set(roadCenter(d+8)+W(p.x)*.85,1,z-6);eye.set(this.mode==='follow'?x:roadCenter(d)+30,this.mode==='follow'?(this.camera.aspect<1?9:6.5):42,z+(this.mode==='follow'?(this.camera.aspect<1?14:9.5):25));this.camera.fov=T.MathUtils.lerp(this.camera.fov,p.boosting?58:49,Math.min(1,dt*3));this.sun.position.set(roadCenter(d)-35,65,z+30);this.sun.target.position.set(roadCenter(d),0,z-15);}
  else if(this.game==='marble-run'){const x=p.x/10;target.set(x+10,1,0);eye.set(x-17,this.camera.aspect<1?17:12,this.camera.aspect<1?24:18);this.camera.fov=48;this.sun.position.set(x-30,65,35);this.sun.target.position.set(x+20,0,0);}
  else if(this.game==='platform-relay'){const x=Math.max(22,p.x/10+10),y=clamp((435-p.y)/10,0,15);target.set(x,y+3,0);eye.set(x+2,y+12,this.camera.aspect<1?65:46);this.camera.fov=43;this.sun.position.set(x-25,65,30);this.sun.target.position.set(x,0,0);}

  else if(this.game==='cat-defense'||this.game==='bridge-builders'||this.game==='pocket-soccer'){
   const fc=this.fighterCamera!,aspect=this.camera.aspect;
   const bridge=this.game==='bridge-builders',soccer=this.game==='pocket-soccer';
   const height=bridge?Math.max(36,((s.to.x+s.to.w-s.from.x)/10+13)/aspect):soccer?Math.max(67,108/aspect):Math.max(47.6,96/aspect),width=height*aspect;
   const x=bridge?(s.from.x+s.to.x+s.to.w)/20:0,y=bridge?9:0;
   const desired=new T.Vector3(x,soccer?85:y,soccer?48:85);fc.position.lerp(desired,this.cameraReady?1-Math.exp(-dt*5):1);fc.lookAt(soccer?0:fc.position.x,soccer?0:fc.position.y-(bridge?6:0),0);if(bridge){this.sun.position.set(x-35,65,30);this.sun.target.position.set(x,0,0);}
   fc.left=-width/2;fc.right=width/2;fc.top=height/2;fc.bottom=-height/2;fc.far=400;fc.updateProjectionMatrix();target.set(x,y,0);eye.copy(desired);
  }
  else if(this.game==='mini-golf'){const course=golfCourses[Math.min(s.hole,golfCourses.length-1)],xs=course.cells.map(c=>W(c.x)),zs=course.cells.map(c=>Z(c.y)),width=Math.max(...xs)-Math.min(...xs)+12,depth=Math.max(...zs)-Math.min(...zs)+14,rotate=this.camera.aspect<.8,distance=Math.max(35,(rotate?depth:width)/(2*Math.tan(T.MathUtils.degToRad(21.5))*this.camera.aspect)*1.12,(rotate?width:depth)*1.35);target.set((Math.min(...xs)+Math.max(...xs))/2,0,(Math.min(...zs)+Math.max(...zs))/2);eye.set(target.x+(rotate?distance*.55:0),distance*.84,target.z+(rotate?0:distance*.55));this.camera.fov=43;}
  else if(this.game==='stick-rivals'){
   const a=s.players[0],b=s.players[1],mid=W((a.x+b.x)/2),gap=Math.abs(a.x-b.x)/10,aspect=this.camera.aspect;
   const height=Math.max(24,(gap+23)/aspect),width=height*aspect,fc=this.fighterCamera!;
   const backdrop=this.k.scene.getObjectByName('craftpix-vampire-terrace');if(backdrop){const scale=Math.max(width/160,height/90)*1.08;backdrop.scale.setScalar(scale);backdrop.position.set(mid,90*(777.5/1080-.5)*scale,-20);}
   const desired=new T.Vector3(mid,height*.29,80);fc.position.lerp(desired,this.cameraReady?1-Math.exp(-dt*4):1);fc.lookAt(fc.position.x,fc.position.y,0);
   fc.left=-width/2;fc.right=width/2;fc.top=height/2;fc.bottom=-height/2;fc.updateProjectionMatrix();
   target.set(mid,7,0);eye.set(mid,7,80);
  }
  else{const grid=['snake-arena','bomb-maze','marble-knockout'].includes(this.game);target.set(0,0,0);eye.set(this.game==='pocket-racers'?16:0,grid?55:64,grid?36:47);this.camera.fov=43;if(this.camera.aspect<1.45)eye.multiplyScalar(1.45/this.camera.aspect);}
  const follow=this.cameraReady?1-Math.exp(-dt*(this.game==='pocket-racers'?9:5)):1;this.camera.position.lerp(eye,follow);this.look.lerp(target,follow);this.camera.lookAt(this.look);this.camera.updateProjectionMatrix();this.cameraReady=true;if(!['pocket-racers','platform-relay','marble-run'].includes(this.game)&&this.k.scene.fog instanceof T.Fog){this.k.scene.fog.near=Math.max(100,this.camera.position.distanceTo(this.look)+35);this.k.scene.fog.far=this.k.scene.fog.near+150;}this.k.skyDome?.position.copy(this.camera.position);
  if(this.guide){this.guide.visible=!s.moving&&s.turn===this.seat&&!s.finished;const pos=this.guide.geometry.getAttribute('position') as T.BufferAttribute;pos.setXYZ(0,W(p.x),.65,Z(p.y));pos.setXYZ(1,W(p.x)+Math.cos(this.aim)*this.power*24,.65,Z(p.y)+Math.sin(this.aim)*this.power*24);pos.needsUpdate=true;this.guide.computeLineDistances();}
  this.renderer.render(this.k.scene,this.fighterCamera||this.camera);this.samples++;if(now-this.sampleAt>1100){const fps=Math.round(this.samples*1000/(now-this.sampleAt));if(this.sampleAt>0){this.metrics({fps,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,quality:this.ratio<1.3?'Performance':'High'});this.host.dataset.fps=String(fps);this.host.dataset.drawCalls=String(this.renderer.info.render.calls);if(fps<43)this.framesLow++;else this.framesLow=0;if(this.framesLow>=3&&this.ratio>1){this.ratio=Math.max(1,this.ratio-.25);this.renderer.setPixelRatio(this.ratio);this.framesLow=0;}}this.samples=0;this.sampleAt=now;}
 };
 dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.resize.disconnect();this.observer.disconnect();this.k.dispose();this.environment.dispose();this.renderer.dispose();this.renderer.domElement.remove();}
}
