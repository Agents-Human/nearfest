import * as THREE from 'three';
import {GLTFLoader, type GLTF} from 'three/addons/loaders/GLTFLoader.js';

type Point = {x:number;z:number};
type Person = Point & {target?:Point|null;job?:unknown;ready?:boolean;mood?:number;reaction?:{emotion:string;until:number}|null;name?:string;moving?:boolean;facing?:number};
export type SimSceneState = {game:string;day:number;totalDays:number;dayElapsed:number;daySeconds:number;elapsed:number;finished:boolean;metrics:Record<string,number>;players:Person[];npcs:Person[];locations:(Point&{id:string;label:string})[]};
type Asset = {url:string;kind:string;dimensions:{x:number;y:number;z:number};bounds:{min:number[];max:number[]}};
type Actor = {root:THREE.Group;body:THREE.Group;mixer:THREE.AnimationMixer;clips:Map<string,THREE.AnimationAction>;current:string};
export type SimMarker = {id:string;kind:'location'|'npc'|'player';index:number;x:number;y:number};
const colors = ['#eb8264','#9d83cd','#59a98c','#e9b84e'];

export class SimulationRenderer {
 private scene = new THREE.Scene();
 private camera = new THREE.PerspectiveCamera(52,1,.2,350);
 private focus:number|null=null;
 private look=new THREE.Vector3();
 private renderer:THREE.WebGLRenderer;
 private observer:ResizeObserver;
 private assets:Record<string,Asset>={};
 private templates=new Map<string,GLTF>();
 private people:Actor[]=[];
 private sun=new THREE.DirectionalLight('#fff0cf',3.2);
 private water:THREE.Mesh;
 private radio:THREE.Group|null=null;
 private festival:THREE.Group|null=null;
 private disposed=false;
 private frame=0;
 private last=0;
 private marked=0;
 private state:SimSceneState;
 private seat:number|null;
 private ready=false;
 constructor(private host:HTMLElement,s:SimSceneState,seat:number|null,private markers:(v:SimMarker[])=>void) {
  this.state=s;this.seat=seat;
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.shadowMap.enabled=true;
  this.renderer.shadowMap.type=THREE.PCFShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
  this.renderer.domElement.setAttribute('aria-label',s.game==='town-council'?'Shared town map':'Shared survivor island');
  this.host.appendChild(this.renderer.domElement);
  this.scene.background=new THREE.Color(s.game==='town-council'?'#c3dbca':'#74bec9');
  this.scene.fog=new THREE.Fog(s.game==='town-council'?'#c3dbca':'#a0ced1',95,220);
  this.scene.add(new THREE.HemisphereLight('#edf7ff','#9b8b67',2.5));
  this.sun.position.set(-35,85,30);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);
  Object.assign(this.sun.shadow.camera,{left:-80,right:80,top:80,bottom:-80,near:1,far:180});
  this.sun.shadow.normalBias=.1;this.scene.add(this.sun);
  this.water=this.box(200,.3,140,'#69bbc7',0,-1,0);this.scene.add(this.water);
  this.base();const start=s.players[seat??0];this.look.set(start.x-50,3,start.z-35);this.camera.position.copy(this.look).add(new THREE.Vector3(14,12,14));this.camera.lookAt(this.look);this.resize();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);
  this.frame=requestAnimationFrame(t=>this.animate(t));
 }
 private box(x:number,y:number,z:number,color:string,px=0,py=0,pz=0) {
  const m=new THREE.Mesh(new THREE.BoxGeometry(x,y,z),new THREE.MeshStandardMaterial({color,roughness:.9}));
  m.position.set(px,py,pz);m.receiveShadow=true;m.castShadow=true;return m;
 }
 private base(){
  const isTown=this.state.game==='town-council';
  if(isTown){
   this.scene.add(this.box(110,2,78,'#a8bb81',0,-1,0));
   this.scene.add(this.box(8,.1,65,'#eadcba',0,.02,0),this.box(80,.1,6,'#eadcba',0,.03,3));
   for(const l of this.state.locations){
    const tile=this.box(13,.15,11,l.id==='square'?'#e5b38d':'#e9ddc0',l.x-50,.09,l.z-35);this.scene.add(tile);
    const dx=l.x-50,dz=l.z-35;this.scene.add(this.box(Math.abs(dx)+2,.09,3,'#eadcba',dx/2,.03,dz));
   }
  }else{
   const sand=new THREE.Mesh(new THREE.CylinderGeometry(1,1.03,2,64),new THREE.MeshStandardMaterial({color:'#ecd8a4'}));sand.scale.set(58,1,41);sand.position.y=-1;sand.receiveShadow=true;this.scene.add(sand);
   const grass=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1.3,48),new THREE.MeshStandardMaterial({color:'#91ad76'}));grass.scale.set(46,1,29);grass.position.set(-3,0,-1);grass.receiveShadow=true;this.scene.add(grass);
   for(const l of this.state.locations){const spot=new THREE.Mesh(new THREE.CircleGeometry(7,28),new THREE.MeshStandardMaterial({color:'#d9ca98'}));spot.rotation.x=-Math.PI/2;spot.position.set(l.x-50,.7,l.z-35);spot.receiveShadow=true;this.scene.add(spot);}
  }
  for(let i=0;i<7;i++){const wave=this.box(11,.025,.13,'#c3e9df',-63+i*21,-.77,47+(i%2)*2);this.scene.add(wave);}
 }
 async load(){
  const res=await fetch('/models/simulation/manifest.json');if(!res.ok)throw Error('Scene assets could not be loaded.');
  this.assets=(await res.json()).assets;
  const town=this.state.game==='town-council';
  const ids=[...this.state.players.map((_,i)=>`player-${i}`),...this.state.npcs.map((_,i)=>`npc-${i}`),...(town?['town-hall','shop','shop-alt','house','house-alt','parasol','tree','tree-alt','flowers','bush','workbench']:['palm','palm-small','rock','tent','tent-canvas','shelter','shelter-canvas','shelter-roof','workbench','wood','planks','stone','campfire','canoe','crate','barrel','fish','bedroll'])];
  const loader=new GLTFLoader();
  await Promise.all(ids.map(async id=>{const g=await loader.loadAsync(this.assets[id].url);if(this.disposed){this.disposeObject(g.scene);return;}this.templates.set(id,g);}));
  if(this.disposed)return;
  if(town)this.townProps();else this.islandProps();
  this.people=[...this.state.players.map((p,i)=>this.actor(`player-${i}`,p,colors[i],i===this.seat)),...this.state.npcs.map((p,i)=>this.actor(`npc-${i}`,p,'#f8ebcb',false))];
  this.ready=true;this.publishMarkers();
 }
 private prop(id:string,x:number,z:number,size:number,axis:'x'|'y'|'z'='y',rotation=0){
  const template=this.templates.get(id);if(!template)return new THREE.Group();
  const root=new THREE.Group(),copy=template.scene.clone(true),a=this.assets[id],scale=size/a.dimensions[axis];
  copy.position.set(-(a.bounds.min[0]+a.bounds.max[0])/2,-a.bounds.min[1],-(a.bounds.min[2]+a.bounds.max[2])/2);
  const base=new THREE.Group();base.add(copy);base.scale.setScalar(scale);root.add(base);root.position.set(x-50,.7,z-35);root.rotation.y=rotation;
  copy.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});this.scene.add(root);return root;
 }
 private assembly(ids:string[],x:number,z:number,width:number){
  const group=new THREE.Group();for(const id of ids){const g=this.templates.get(id);if(g){const copy=g.scene.clone(true);copy.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});group.add(copy);}}
  const bounds=new THREE.Box3().setFromObject(group),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  group.position.set(-center.x,-bounds.min.y,-center.z);const root=new THREE.Group();root.add(group);root.scale.setScalar(width/size.x);root.position.set(x-50,.7,z-35);this.scene.add(root);return root;
 }
 private townProps(){
  this.prop('town-hall',49,3,17,'x');this.prop('shop',15,13,15,'x');this.prop('shop-alt',30,10,12,'x');
  this.prop('house',86,40,13,'x');this.prop('house-alt',87,59,13,'x');this.prop('workbench',19,58,5,'x');
  this.prop('parasol',19,29,6);this.prop('parasol',28,29,6);
  for(const [x,z] of [[6,9],[8,35],[7,61],[39,62],[63,63],[93,12],[76,10]])this.prop('tree',x,z,10+(x%3));
  for(const [x,z] of [[69,23],[83,18],[85,29]])this.prop('tree-alt',x,z,8);
  for(const [x,z] of [[68,30],[81,34],[40,9],[57,9]])this.prop('flowers',x,z,1.8);
  const stage=new THREE.Group();stage.add(this.box(13,1.2,7,'#af7956',0,.7,0));
  for(const x of [-6,6])stage.add(this.box(.3,7,.3,'#f0dfb9',x,3.6,0));
  for(let i=0;i<7;i++){const flag=new THREE.Mesh(new THREE.ConeGeometry(.7,1.4,3),new THREE.MeshStandardMaterial({color:colors[i%4],side:THREE.DoubleSide}));flag.position.set(-5+i*1.65,6.2,0);flag.rotation.z=Math.PI;stage.add(flag);}
  stage.position.set(2,.5,-23);this.scene.add(stage);this.festival=stage;
 }
 private islandProps(){
  for(const [x,z] of [[9,22],[14,8],[30,5],[40,7],[88,9],[92,36],[68,66],[16,59]])this.prop('palm',x,z,10+x%4,'y',x);
  for(const [x,z] of [[34,21],[9,38],[86,62],[22,12]])this.prop('palm-small',x,z,7,'y',z);
  for(const [x,z] of [[61,7],[70,10],[91,23],[7,49],[40,62]])this.prop('rock',x,z,4.5,'x',x);
  this.assembly(['tent','tent-canvas'],40,45,9);
  this.assembly(['shelter','shelter-roof','shelter-canvas'],23,58,14);
  this.prop('workbench',57,20,5,'x');this.prop('campfire',52,43,3,'x');
  this.prop('wood',21,27,4,'x');this.prop('planks',35,54,4,'x');this.prop('bedroll',43,49,3,'z');
  this.prop('crate',80,17,4,'x');this.prop('barrel',82,25,3);this.prop('stone',28,19,3,'x');
  this.prop('canoe',87,53,12,'z',-.4);this.prop('fish',75,57,2.5,'z');
  const radio=new THREE.Group();radio.add(this.box(3,2,2,'#e5aa69',0,1,0),this.box(.12,8,.12,'#e5e5c9',0,5,0));
  for(let i=0;i<3;i++)radio.add(this.box(4-i,.15,.15,'#e5e5c9',0,7+i,0));
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(.3,12,8),new THREE.MeshStandardMaterial({color:'#ffbe69',emissive:'#ff953f',emissiveIntensity:1.5}));lamp.position.set(1,2,1);radio.add(lamp);
  radio.position.set(3,.8,-23);this.scene.add(radio);this.radio=radio;
 }
 private actor(id:string,p:Person,color:string,you:boolean):Actor{
  const root=new THREE.Group(),body=this.templates.get(id)!.scene.clone(true);body.scale.setScalar(4.5/this.assets[id].dimensions.y);
  body.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});root.add(body);
  const ring=new THREE.Mesh(new THREE.RingGeometry(1.4,you?2.1:1.8,32),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.05;root.add(ring);
  root.position.set(p.x-50,.75,p.z-35);this.scene.add(root);
  const mixer=new THREE.AnimationMixer(body),clips=new Map(this.templates.get(id)!.animations.map(c=>[c.name,mixer.clipAction(c)]));clips.get('idle')?.play();
  return {root,body,mixer,clips,current:'idle'};
 }
 update(s:SimSceneState,seat:number|null){this.state=s;this.seat=seat;}
 focusPerson(index:number|null){this.focus=index;}
 private resize(){
  const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;
  this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.publishMarkers();
 }
 private publishMarkers(){
  const project=(p:Point,height:number)=>{const v=new THREE.Vector3(p.x-50,height,p.z-35).project(this.camera);return {x:(v.x+1)/2,y:(1-v.y)/2};};
  this.markers([...this.state.locations.map((l,i)=>({id:l.id,kind:'location' as const,index:i,...project(l,.8)})),...this.state.npcs.map((p,i)=>({id:`npc-${i}`,kind:'npc' as const,index:i,...project(p,6.3)})),...this.state.players.map((p,i)=>({id:`player-${i}`,kind:'player' as const,index:i,...project(p,6.3)}))]);
 }
 private animate(time:number){
  if(this.disposed)return;const dt=Math.min(.1,(time-(this.last||time))/1000);this.last=time;
  const all=[...this.state.players,...this.state.npcs];
  this.people.forEach((a,i)=>{const p=all[i],desired=new THREE.Vector3(p.x-50,.75,p.z-35),delta=desired.clone().sub(a.root.position),moving=delta.length()>.12;
   if(moving)a.body.rotation.y=Math.atan2(delta.x,delta.z);else if(i<this.state.players.length&&typeof p.facing==='number')a.body.rotation.y=p.facing;else if(p.reaction&&p.reaction.until>this.state.elapsed&&typeof p.facing==='number'){const who=this.state.players[p.facing];if(who)a.body.rotation.y=Math.atan2(who.x-p.x,who.z-p.z);}a.root.position.lerp(desired,Math.min(1,dt*13));
   const reaction=p.reaction&&p.reaction.until>this.state.elapsed;
   const clip=(moving||p.moving)?'walk':p.job?'interact-right':p.ready?'sit':reaction?(p.reaction!.emotion==='angry'||p.reaction!.emotion==='sad'?'emote-no':'emote-yes'):(p.mood??0)<-10?'emote-no':'idle';
   if(clip!==a.current){a.clips.get(a.current)?.fadeOut(.18);a.clips.get(clip)?.reset().fadeIn(.18).play();a.current=clip;}a.mixer.update(dt);
  });
  const player=this.state.players[this.seat??0],actor=this.people[this.seat??0],position=actor?.root.position||new THREE.Vector3(player.x-50,.75,player.z-35);
  let look=position.clone().add(new THREE.Vector3(0,2.5,0)),offset=new THREE.Vector3(14,12,14);
  if(this.focus!==null&&this.state.npcs[this.focus]){const npc=this.state.npcs[this.focus];look=new THREE.Vector3(npc.x-50,3.3,npc.z-35);offset=new THREE.Vector3(8,5,8);}
  this.look.lerp(look,Math.min(1,dt*5));this.camera.position.lerp(this.look.clone().add(offset),Math.min(1,dt*5));this.camera.lookAt(this.look);
  const dusk=this.state.dayElapsed/this.state.daySeconds;this.sun.intensity=3.2-Math.max(0,dusk-.65)*2;
  if(this.radio)this.radio.rotation.y=Math.sin(time*.001)*.03;
  if(this.festival)this.festival.scale.y=.75+this.state.metrics.festival/400;
  this.water.position.y=-1+Math.sin(time*.0007)*.08;
  this.renderer.render(this.scene,this.camera);
  if(time-this.marked>150){this.marked=time;this.publishMarkers();}this.frame=requestAnimationFrame(t=>this.animate(t));
 }
 private disposeObject(object:THREE.Object3D){object.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const v of Object.values(m))if(v instanceof THREE.Texture)v.dispose();m.dispose();}}});}
 dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.observer.disconnect();this.people.forEach(p=>{p.mixer.stopAllAction();p.mixer.uncacheRoot(p.body);});this.disposeObject(this.scene);this.templates.forEach(g=>this.disposeObject(g.scene));this.renderer.dispose();this.renderer.domElement.remove();}
}
