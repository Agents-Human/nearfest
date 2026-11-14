import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

export type Pilot={x:number;y:number;vy:number;alive:boolean;score:number;gates:number;stars:number;lastStar:number;deathReason:string|null};
export type FlightState={game:string;tick:number;elapsed:number;finished:boolean;waiting:boolean;scroll:number;speed:number;players:Pilot[];gates:{id:number;x:number;width:number;center:number;gap:number}[]};
const colors=['#ed6956','#4c9fd6','#73ae68','#f2c65b'];
const clamp=T.MathUtils.clamp;
const random=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
// These profiles follow the authoritative canyon collision outlines. Depth is
// decoration: the playable plane stays in the same side-on flight corridor.
const upper=[[.025,0],[.975,0],[.80,.48],[.66,.99],[.60,.99],[.35,.48]];
const lower=[[.59,.015],[.66,.015],[.76,.43],[.80,.44],[.87,.76],[.97,1],[.03,1],[.20,.69],[.27,.55],[.35,.53]];
type FlightPlane={root:T.Group;propeller:T.Group;trail:T.Mesh[]};

/** All scenery and aircraft are geometry. No enlarged sprites, blur passes or
 * image textures sit between the scene and the device-resolution WebGL canvas. */
export class TappyRenderer {
 private renderer:T.WebGLRenderer;
 private scene=new T.Scene();
 private camera=new T.OrthographicCamera(-40,40,24,-24,1,350);
 private geometries=new Map<string,T.BufferGeometry>();
 private materials=new Map<string,T.MeshStandardMaterial>();
 private extraMaterials:T.Material[]=[];
 private environment:T.WebGLRenderTarget;
 private planes:FlightPlane[]=[];
 private gates=new Map<number,T.Group>();
 private scenery:{object:T.Object3D;x:number;speed:number;span:number}[]=[];
 private sky:T.Mesh;
 private sun:T.DirectionalLight;
 private resize:ResizeObserver;
 private frame=0;
 private previous:FlightState;
 private latest:FlightState;
 private received=performance.now();
 private seat:number|null;
 private active=false;
 private disposed=false;
 private width=1;
 private height=1;
 private handleContextLost:(event:Event)=>void;

 constructor(private canvas:HTMLCanvasElement,state:FlightState,seat:number|null,onError:(message:string)=>void){
  this.previous=this.latest=state;this.seat=seat;
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  this.renderer.outputColorSpace=T.SRGBColorSpace;
  this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.95;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;
  const room=new RoomEnvironment(),pmrem=new T.PMREMGenerator(this.renderer);
  this.environment=pmrem.fromScene(room,.02);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.28;
  room.dispose();pmrem.dispose();
  this.scene.add(new T.HemisphereLight('#d9f6ff','#667d5a',.85));
  this.sun=new T.DirectionalLight('#fff0cd',2.8);this.sun.position.set(-24,65,55);this.sun.castShadow=true;
  this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-70,right:70,top:50,bottom:-28,near:1,far:200});this.sun.shadow.bias=-.0002;this.sun.shadow.normalBias=.04;
  this.scene.add(this.sun,this.sun.target);
  const rim=new T.DirectionalLight('#b9e9ff',.55);rim.position.set(35,25,-20);this.scene.add(rim);
  const skyMaterial=new T.ShaderMaterial({depthWrite:false,uniforms:{pixelHeight:{value:1}},vertexShader:'varying vec2 v; void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float pixelHeight; varying vec2 v; void main(){vec3 top=vec3(.055,.28,.50);vec3 horizon=vec3(.62,.82,.68);gl_FragColor=vec4(mix(horizon,top,smoothstep(0.,1.,gl_FragCoord.y/pixelHeight)),1.);\n#include <colorspace_fragment>\n}'});
  this.extraMaterials.push(skyMaterial);this.sky=this.mesh(this.geometry('sky',()=>new T.PlaneGeometry(500,180)),skyMaterial,this.scene,0,30,-140);this.sky.castShadow=this.sky.receiveShadow=false;
  this.buildScenery();
  state.players.forEach((_,i)=>this.planes.push(this.aircraft(i)));
  this.handleContextLost=event=>{event.preventDefault();cancelAnimationFrame(this.frame);onError('The flight view paused. Reload the scene to continue.');};
  canvas.addEventListener('webglcontextlost',this.handleContextLost);
  this.resize=new ResizeObserver(()=>this.measure());this.resize.observe(canvas);this.measure();
  canvas.dataset.renderer='three-geometry';
  const render=(now:number)=>{if(this.disposed)return;this.draw(now);this.frame=requestAnimationFrame(render);};this.frame=requestAnimationFrame(render);
 }
 private geometry(key:string,create:()=>T.BufferGeometry){let geometry=this.geometries.get(key);if(!geometry){geometry=create();this.geometries.set(key,geometry);}return geometry;}
 private material(color:string,metalness=0,roughness=.7,opacity=1){const key=[color,metalness,roughness,opacity].join(':');let mat=this.materials.get(key);if(!mat){mat=new T.MeshStandardMaterial({color,metalness,roughness,flatShading:false,transparent:opacity<1,opacity,depthWrite:opacity===1});this.materials.set(key,mat);}return mat;}
 private mesh(geometry:T.BufferGeometry,material:T.Material|T.Material[],parent:T.Object3D,x=0,y=0,z=0){const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 private box(parent:T.Object3D,color:string,x:number,y:number,z:number,w:number,h:number,d:number,round=false){const geometry=this.geometry(round?'round-box':'box',()=>round?new RoundedBoxGeometry(1,1,1,2,.13):new T.BoxGeometry(1,1,1));const mesh=this.mesh(geometry,this.material(color),parent,x,y,z);mesh.scale.set(w,h,d);return mesh;}
 private sphere(parent:T.Object3D,color:string,x:number,y:number,z:number,sx:number,sy=sx,sz=sx){const mesh=this.mesh(this.geometry('sphere',()=>new T.SphereGeometry(1,20,12)),this.material(color),parent,x,y,z);mesh.scale.set(sx,sy,sz);return mesh;}
 private rod(parent:T.Object3D,color:string,a:T.Vector3,b:T.Vector3,r=.07){const mesh=this.mesh(this.geometry('rod',()=>new T.CylinderGeometry(1,1,1,8)),this.material(color),parent);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.set(r,a.distanceTo(b),r);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());return mesh;}
 private aircraft(index:number):FlightPlane{
  const root=new T.Group(),body=new T.Group();root.add(body);this.scene.add(root);body.rotation.set(.28,-.48,.035);const paint=colors[index%4],cream='#fff1cf',steel='#465a60';
  const fuselage=this.mesh(this.geometry('fuselage',()=>new T.CylinderGeometry(.62,.24,4.6,16)),this.material(paint,.16,.42),body,-.15,0,0);fuselage.rotation.z=-Math.PI/2;
  this.sphere(body,paint,2.08,0,0,.64,.61,.61);
  this.box(body,cream,1.1,.05,0,.30,1.16,1.18,true);
  this.sphere(body,steel,-.65,.52,0,.75,.20,.47);
  const glass=this.sphere(body,'#69c9d6',-.18,.70,0,.36,.42,.46);(glass.material as T.MeshStandardMaterial).metalness=.45;(glass.material as T.MeshStandardMaterial).roughness=.19;
  this.sphere(body,'#785640',-.75,.75,0,.24,.27,.24);
  this.sphere(body,'#f5ce92',-.68,.86,.10,.16,.13,.17);
  for(const y of [-.48,1.18]){
   this.box(body,paint,-.05,y,0,1.5,.17,6.0,true);
   this.box(body,cream,.02,y+.015,2.55,1.42,.19,.38,true);
   this.box(body,cream,.02,y+.015,-2.55,1.42,.19,.38,true);
  }
  for(const z of [-2.15,2.15])for(const x of [-.55,.50])this.rod(body,steel,new T.Vector3(x,-.4,z),new T.Vector3(x,1.12,z));
  this.box(body,paint,-2.1,.24,0,1.1,.15,2.4,true);
  const tail=this.box(body,paint,-2.05,.68,0,.9,1.25,.17,true);tail.rotation.z=.18;
  this.box(body,cream,-2.22,.85,.02,.20,.80,.18,true);
  this.rod(body,steel,new T.Vector3(.45,-.38,0),new T.Vector3(.55,-1.16,1.03),.10);
  this.rod(body,steel,new T.Vector3(.45,-.38,0),new T.Vector3(.55,-1.16,-1.03),.10);
  for(const z of [-1.03,1.03]){
   const tire=this.mesh(this.geometry('wheel',()=>new T.CylinderGeometry(.37,.37,.25,16)),this.material('#263d46',0,.95),body,.55,-1.18,z);tire.rotation.x=Math.PI/2;
   const hub=this.mesh(this.geometry('hub',()=>new T.CylinderGeometry(.15,.15,.27,12)),this.material('#b9ced0',.6,.3),body,.55,-1.18,z);hub.rotation.x=Math.PI/2;
  }
  const propeller=new T.Group();propeller.position.x=2.76;body.add(propeller);
  this.box(propeller,'#f3e6c9',0,0,0,.15,2.45,.16,true);this.box(propeller,'#d9e8e5',0,0,0,.16,.16,2.45,true);
  this.sphere(body,steel,2.80,0,0,.20,.20,.20);
  const trail=Array.from({length:5},()=>{const mesh=this.sphere(this.scene,'#f4f6e6',0,0,0,.1);mesh.castShadow=mesh.receiveShadow=false;return mesh;});
  root.scale.setScalar(1.35);
  return {root,propeller,trail};
 }
 private buildScenery(){
  const ground=this.box(this.scene,'#a78150',0,-6,0,450,12,35);ground.receiveShadow=true;
  this.box(this.scene,'#6f9f52',0,-.22,0,450,.44,35);
  this.box(this.scene,'#aac764',0,-.02,14,450,.12,6);
  const sun=this.mesh(this.geometry('sun',()=>new T.CircleGeometry(5.2,48)),new T.MeshBasicMaterial({color:'#fff5cd'}),this.scene,45,35,-115);this.extraMaterials.push(sun.material as T.Material);sun.castShadow=sun.receiveShadow=false;
  this.scenery.push({object:sun,x:45,speed:.015,span:180});
  for(let i=0;i<24;i++){
   const h=10+random(i+7)*22,r=12+random(i+5)*12,z=i%2?-65:-90;
   const mountain=this.mesh(this.geometry('mountain',()=>new T.ConeGeometry(1,1,5)),this.material(i%2?'#477d86':'#78a4a0'),this.scene);
   mountain.scale.set(r,h,r*.65);mountain.rotation.y=i*.7;mountain.position.set(-100+i*13,h/2-4,z);mountain.castShadow=false;
   this.scenery.push({object:mountain,x:mountain.position.x,speed:i%2?.12:.065,span:312});
  }
  for(let i=0;i<13;i++){
   const cloud=new T.Group();cloud.position.set(-90+i*20,28+random(i+30)*13,-35-random(i+40)*50);this.scene.add(cloud);
   for(let j=0;j<4;j++){const puff=this.sphere(cloud,j%2?'#f6f6e9':'#e8f0e4',j*2.5,random(i+j)*1.2,0,2.6+random(i+j),1.1+random(i+j)*.4,1.4);puff.castShadow=puff.receiveShadow=false;}
   this.scenery.push({object:cloud,x:cloud.position.x,speed:.04,span:260});
  }
  for(let i=0;i<26;i++){
   const group=new T.Group();group.position.set(-90+i*10,0,-12-random(i+5)*5);this.scene.add(group);
   const h=3.2+random(i+14)*4.6;
   this.box(group,'#7d6c45',0,h*.25,0,.35,h*.5,.35);
   for(let j=0;j<3;j++){const crown=this.mesh(this.geometry('pine',()=>new T.ConeGeometry(1,1,7)),this.material(j%2?'#4b825e':'#659653'),group,0,h*(.4+j*.23),0);crown.scale.set(h*(.36-j*.06),h*.55,h*(.36-j*.06));}
   this.scenery.push({object:group,x:group.position.x,speed:.8,span:260});
  }
  for(let i=0;i<27;i++){
   const stone=this.mesh(this.geometry('stone',()=>new T.DodecahedronGeometry(1,0)),this.material(i%2?'#a6aa78':'#80966a'),this.scene,-90+i*9,.23,-3-random(i)*8);stone.scale.set(.8+random(i),.35+random(i)*.6,.7);stone.rotation.y=i;
   this.scenery.push({object:stone,x:stone.position.x,speed:1,span:243});
  }
 }
 private rock(profile:number[][],key:string,parent:T.Group){
  const shape=new T.Shape();profile.forEach(([x,y],i)=>i?shape.lineTo(x-.5,1-y):shape.moveTo(x-.5,1-y));shape.closePath();
  const base=this.mesh(this.geometry('rock-'+key,()=>new T.ExtrudeGeometry(shape,{depth:7,bevelEnabled:false})),[this.material('#b68d56'),this.material('#735d3f')],parent,0,0,-3.5);
  const facets=this.geometry('facets-'+key,()=>{
   const vertices:number[]=[],tints:number[]=[],palette=['#b88852','#c99861','#a77946','#bb8c53','#a07040'];
   const center=key==='upper'?[.56,.43]:[.55,.72];
   for(let i=0;i<profile.length;i++){const color=new T.Color(palette[i%palette.length]);for(const [x,y] of [center,profile[i],profile[(i+1)%profile.length]]){vertices.push(x-.5,1-y,3.55);tints.push(color.r,color.g,color.b);}}
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new T.Float32BufferAttribute(tints,3));geometry.computeVertexNormals();return geometry;
  });
  const mat=this.material('#ffffff');mat.vertexColors=true;mat.side=T.DoubleSide;const face=this.mesh(facets,mat,parent);face.castShadow=face.receiveShadow=false;base.receiveShadow=false;
  const edge=key==='upper'?[[.025,0],[.13,0],[.40,.48],[.35,.48]]:[[.59,.015],[.66,.015],[.70,.20],[.61,.16],[.47,.48],[.41,.5]];
  const grass=new T.Shape();edge.forEach(([x,y],i)=>i?grass.lineTo(x-.5,1-y):grass.moveTo(x-.5,1-y));grass.closePath();
  const grassFace=this.mesh(this.geometry('grass-'+key,()=>new T.ShapeGeometry(grass)),this.material('#76a84e'),parent,0,0,3.58);grassFace.castShadow=grassFace.receiveShadow=false;
  return base;
 }
 private gate(id:number){
  const group=new T.Group(),top=new T.Group(),bottom=new T.Group();group.add(top,bottom);this.rock(upper,'upper',top);this.rock(lower,'lower',bottom);
  const starShape=new T.Shape();for(let i=0;i<10;i++){const angle=Math.PI/2+i*Math.PI/5,r=i%2?.60:1.3,x=Math.cos(angle)*r,y=Math.sin(angle)*r;i?starShape.lineTo(x,y):starShape.moveTo(x,y);}starShape.closePath();
  const star=this.mesh(this.geometry('star',()=>new T.ExtrudeGeometry(starShape,{depth:.36,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.10,bevelThickness:.10})),this.material('#ffc244',.32,.32),group,0,0,5);
  group.userData={top,bottom,star};this.scene.add(group);this.gates.set(id,group);return group;
 }
 private measure(){
  const rect=this.canvas.getBoundingClientRect();this.width=Math.max(1,rect.width);this.height=Math.max(1,rect.height);
  const ratio=Math.min(devicePixelRatio||1,3,Math.sqrt(5_000_000/(this.width*this.height)));
  this.renderer.setPixelRatio(ratio);this.renderer.setSize(this.width,this.height,false);
  (this.sky.material as T.ShaderMaterial).uniforms.pixelHeight.value=this.canvas.height;
  const worldWidth=48*this.width/this.height;this.camera.left=-worldWidth/2;this.camera.right=worldWidth/2;this.camera.updateProjectionMatrix();
  const center=17+worldWidth*.24;this.camera.position.set(center,24,100);this.camera.lookAt(center,19,0);
  this.sky.position.x=center;this.sun.target.position.set(center,12,0);this.sun.position.x=center-30;
  this.canvas.dataset.renderScale=ratio.toFixed(2);
 }
 push(state:FlightState,seat:number|null,active:boolean){
  if(state.tick>this.latest.tick){this.previous=this.latest;this.latest=state;this.received=performance.now();}else if(state.finished||state.waiting!==this.latest.waiting)this.previous=this.latest=state;
  this.seat=seat;this.active=active;
 }
 private draw(now:number){
  const latest=this.latest,old=this.previous;
  const blend=latest.finished||latest.waiting||!this.active?1:clamp((now-this.received)/Math.max(50,Math.min(150,(latest.tick-old.tick)*50)),0,1);
  const scroll=T.MathUtils.lerp(old.scroll,latest.scroll,blend)/10,time=now/1000;
  for(const item of this.scenery)item.object.position.x=((item.x-scroll*item.speed+110)%item.span+item.span)%item.span-110;
  const ids=new Set(latest.gates.map(g=>g.id));
  for(const gate of latest.gates){const group=this.gates.get(gate.id)||this.gate(gate.id);group.position.x=gate.x/10-scroll;
   const topHeight=(gate.center-gate.gap/2)/10,bottomHeight=(430-gate.center-gate.gap/2)/10;
   group.userData.top.position.y=43-topHeight;group.userData.top.scale.set(gate.width/10,topHeight,1);
   group.userData.bottom.scale.set(gate.width/10,bottomHeight,1);
   const star=group.userData.star as T.Mesh;star.position.y=(430-gate.center)/10;star.rotation.set(.05,Math.sin(time*1.8+gate.id)*.35,.04*Math.sin(time*2));star.visible=(latest.players[this.seat??0]?.lastStar??-1)<gate.id;
  }
  for(const [id,group] of this.gates)if(!ids.has(id)){group.removeFromParent();this.gates.delete(id);}
  this.planes.forEach((plane,i)=>{
   const pilot=latest.players[i],previous=old.players[i]??pilot,y=T.MathUtils.lerp(previous.y,pilot.y,blend),vy=T.MathUtils.lerp(previous.vy,pilot.vy,blend),isYou=i===(this.seat??0);
   plane.root.position.set(pilot.x/10,(430-y)/10,isYou?6:2-i*.7);plane.root.rotation.z=pilot.alive?-clamp(vy/670,-.38,.65):-.65;
   plane.root.visible=pilot.alive||isYou;plane.propeller.rotation.x=pilot.alive?time*35:1.2;
   plane.trail.forEach((p,j)=>{const progress=(time*1.7+j/5)%1;p.visible=pilot.alive&&(!latest.waiting||isYou);p.position.set(plane.root.position.x-3-progress*4,plane.root.position.y+.1+Math.sin(j+time)*.12,plane.root.position.z-.2);p.scale.setScalar(.10+progress*.24);});
  });
  this.renderer.render(this.scene,this.camera);
 }
 dispose(){
  this.disposed=true;cancelAnimationFrame(this.frame);this.resize.disconnect();this.canvas.removeEventListener('webglcontextlost',this.handleContextLost);
  for(const geometry of this.geometries.values())geometry.dispose();for(const material of this.materials.values())material.dispose();for(const material of this.extraMaterials)material.dispose();
  this.sun.shadow.dispose();this.environment.dispose();this.scene.clear();this.renderer.dispose();this.renderer.forceContextLoss();
 }
}
