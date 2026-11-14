import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {tree} from './world-models';

function noise(n:number){return Math.sin(n*127.1+311.7)*43758.5453%1;}
export function random(n:number){return Math.abs(noise(n));}

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
  root.updateMatrixWorld(true);const buckets=new Map<string,{m:T.Material,g:T.BufferGeometry[],cast:boolean,receive:boolean}>();
  root.traverse(obj=>{if(!(obj instanceof T.Mesh)||Array.isArray(obj.material))return;const m=obj.material as T.MeshStandardMaterial;const key=[m.type,m.color?.getHex(),m.roughness,m.metalness,m.emissive?.getHex(),m.emissiveIntensity,m.map?.source.uuid,m.map?.colorSpace,m.map?.flipY,m.map?.repeat.toArray(),m.map?.offset.toArray(),m.transparent,m.opacity,m.side,m.alphaTest,m.alphaToCoverage,m.depthWrite,m.depthTest,m.blending,m.toneMapped,obj.castShadow,obj.receiveShadow].join(':');
   let g=obj.geometry.clone();if(g.index){const n=g.toNonIndexed();g.dispose();g=n;}g.applyMatrix4(obj.matrixWorld);for(const a of Object.keys(g.attributes))if(!['position','normal','uv'].includes(a))g.deleteAttribute(a);if(!g.getAttribute('normal'))g.computeVertexNormals();if(!g.getAttribute('uv'))g.setAttribute('uv',new T.BufferAttribute(new Float32Array(g.getAttribute('position').count*2),2));
   if(!buckets.has(key))buckets.set(key,{m,g:[],cast:obj.castShadow,receive:obj.receiveShadow});buckets.get(key)!.g.push(g);
  });
  const oldGeometries=new Set<T.BufferGeometry>(),oldMaterials=new Set<T.Material>();root.traverse(o=>{if(o instanceof T.Mesh){oldGeometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>oldMaterials.add(m));}});
  root.clear();for(const {m,g,cast,receive} of buckets.values()){const merged=mergeGeometries(g,false);if(merged){const mesh=this.mesh(merged,m,root);mesh.castShadow=cast;mesh.receiveShadow=receive;}g.forEach(a=>a.dispose());}oldGeometries.forEach(g=>g.dispose());const kept=new Set([...buckets.values()].map(b=>b.m));const keptTextures=new Set<T.Texture>(this.textures);kept.forEach(m=>Object.values(m).forEach(value=>{if(value instanceof T.Texture)keptTextures.add(value);}));const keptSources=new Set([...keptTextures].map(t=>t.source));oldMaterials.forEach(m=>{if(kept.has(m))return;for(const value of Object.values(m))if(value instanceof T.Texture&&!keptTextures.has(value)&&!keptSources.has(value.source))value.dispose();m.dispose();});
 }
 dispose(){this.cleanups.forEach(fn=>fn());const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>(),ts=new Set<T.Texture>(this.textures);this.scene.traverse(o=>{const m=o as T.Mesh;if(m.geometry)gs.add(m.geometry);if(m.material)for(const mat of Array.isArray(m.material)?m.material:[m.material]){ms.add(mat);for(const value of Object.values(mat))if(value instanceof T.Texture)ts.add(value);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());this.scene.traverse(o=>{if(o instanceof T.DirectionalLight||o instanceof T.SpotLight||o instanceof T.PointLight){o.shadow.map?.dispose();o.shadow.mapPass?.dispose();}});}
}
export function particles(k:Kit,options:{size?:number;maxScreenSize?:number}={}){
 const count=180,positions=new Float32Array(count*3),color=new Float32Array(count*3),life=new Float32Array(count),vel=new Float32Array(count*3),base=new T.Color();positions.fill(-1000);let next=0;
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('color',new T.BufferAttribute(color,3));
 const sprite=document.createElement('canvas');sprite.width=sprite.height=32;const ctx=sprite.getContext('2d')!,gradient=ctx.createRadialGradient(16,16,0,16,16,16);gradient.addColorStop(0,'#fff');gradient.addColorStop(.3,'#fff');gradient.addColorStop(1,'#fff0');ctx.fillStyle=gradient;ctx.fillRect(0,0,32,32);const texture=new T.CanvasTexture(sprite);k.textures.push(texture);
 const material=new T.PointsMaterial({size:options.size??.6,map:texture,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending});
 if(options.maxScreenSize){const limit=options.maxScreenSize.toFixed(1);material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <fog_vertex>',`gl_PointSize=min(gl_PointSize,${limit});\n#include <fog_vertex>`);};material.customProgramCacheKey=()=>`particle-cap-${limit}`;}
 const points=new T.Points(geometry,material);points.frustumCulled=false;k.dynamic.add(points);
 return {burst(x:number,y:number,z:number,tint='#ffd360',amount=14){base.set(tint);for(let j=0;j<amount;j++){const i=next++%count;life[i]=.7+random(next)*.5;positions.set([x,y,z],i*3);color.set([base.r,base.g,base.b],i*3);vel.set([(random(next+4)-.5)*8,2+random(next+7)*7,(random(next+11)-.5)*6],i*3);}},update(dt:number){for(let i=0;i<count;i++){if(life[i]<=0)continue;life[i]-=dt;for(let j=0;j<3;j++)positions[i*3+j]+=vel[i*3+j]*dt;vel[i*3+1]-=10*dt;if(life[i]<=0)positions[i*3+1]=-1000;}(geometry.attributes.position as T.BufferAttribute).needsUpdate=true;(geometry.attributes.color as T.BufferAttribute).needsUpdate=true;}};
}

export function animateExplorer(g:T.Group,p:any,time:number){const moving=Math.abs(p.vx||0)+Math.abs(p.vy||0)>5,run=moving?Math.sin(time*13)*.55:Math.sin(time*2)*.025;const u=g.userData;if(u.leftLeg)u.leftLeg.rotation.z=p.ground===false?-.45:run;if(u.rightLeg)u.rightLeg.rotation.z=p.ground===false?.6:-run;if(u.leftArm)u.leftArm.rotation.z=p.attack>0?-1.5:-run*.65;if(u.rightArm)u.rightArm.rotation.z=p.blocking?-1.5:run*.65;}
