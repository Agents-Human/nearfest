import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {chessPiece,checker,reversiDisc,seed,bowl} from './table-models';
import type {BoardState} from '../../server/skill/engines.mjs';
export type TableState=Omit<BoardState,'history'>;
export type TablePoint={id:number;x:number;y:number;size:number};
const ivory='#f4e6c8',ink='#253f50',gold='#d7af65',coral='#dd8063',lilac='#9b83bb';
const morris=Array.from({length:3},(_,r)=>[[r,r],[3,r],[6-r,r],[6-r,3],[6-r,6-r],[3,6-r],[r,6-r],[r,3]]).flat();
function disposeObject(root:T.Object3D){const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>(),ts=new Set<T.Texture>();root.traverse(o=>{if(!(o instanceof T.Mesh))return;gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){ms.add(m);for(const value of Object.values(m))if(value instanceof T.Texture)ts.add(value);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());}
export class TableRenderer{
 private renderer:T.WebGLRenderer;private scene=new T.Scene();private camera=new T.PerspectiveCamera(38,1,.1,160);private board=new T.Group();private pieces=new T.Group();private accents=new T.Group();private environment:T.WebGLRenderTarget;private resize:ResizeObserver;private frame=0;private last=0;private mode='perspective';private rotation=0;private state:TableState;private side:number|null;private ray=new T.Raycaster();private picks:T.Mesh[]=[];private cells=new Map<number,T.Vector3>();private active:number[]=[];private selected:number|null=null;private animations:{object:T.Object3D;from:T.Vector3;to:T.Vector3;start:number;flip?:boolean}[]=[];private objects=new Map<number,{value:number;object:T.Group}>();private reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;private dirty=true;private elapsed=0;private onPick:(id:number)=>void;private project:(p:TablePoint[])=>void;
 constructor(private host:HTMLElement,state:TableState,side:number|null,pick:(id:number)=>void,project:(p:TablePoint[])=>void){
  this.state=state;this.side=side;this.onPick=pick;this.project=project;this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.93;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;host.appendChild(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','Interactive 3D game table');this.renderer.domElement.addEventListener('pointerup',this.pointer);
  this.scene.background=new T.Color('#b1b7a2');this.scene.fog=new T.Fog('#b1b7a2',28,65);const pmrem=new T.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.environment=pmrem.fromScene(room,.04);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.45;pmrem.dispose();room.dispose();
  this.scene.add(new T.HemisphereLight('#dff1ff','#7b664e',1.2));const sun=new T.DirectionalLight('#ffe3b5',2.4);sun.position.set(-10,18,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-13,right:13,top:13,bottom:-13,near:1,far:55});sun.shadow.normalBias=.025;sun.shadow.bias=-.00015;this.scene.add(sun);const rim=new T.DirectionalLight('#c3e2ef',1);rim.position.set(10,6,-8);this.scene.add(rim);
  this.scene.add(this.board,this.pieces,this.accents);this.room();this.build();this.update(state,[],null);this.resize=new ResizeObserver(()=>this.size());this.resize.observe(host);this.size();this.frame=requestAnimationFrame(this.draw);host.dataset.renderer='three-dimensional';
 }
 private material(color:string,metalness=0,roughness=.45){return new T.MeshStandardMaterial({color,metalness,roughness});}
 private mesh(g:T.BufferGeometry,m:T.Material,x=0,y=0,z=0,parent:T.Object3D=this.board){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
 private box(w:number,h:number,d:number,color:string,x=0,y=0,z=0,parent:T.Object3D=this.board,r=.04){return this.mesh(new RoundedBoxGeometry(w,h,d,2,r),this.material(color),x,y,z,parent);}
 private wood(color:string){const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d')!;ctx.fillStyle=color;ctx.fillRect(0,0,256,256);for(let i=0;i<140;i++){ctx.strokeStyle=i%2?'#36201118':'#f5cf8d20';ctx.lineWidth=.5+(i%4)*.3;ctx.beginPath();for(let x=0;x<=256;x+=8){const y=i*2+Math.sin(x/70+i*.8)*2; x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(3,2);map.anisotropy=4;return new T.MeshStandardMaterial({map,roughness:.4});}
 private label(text:string,x:number,y:number,z:number,size=.4,color='#685039',rotate=-Math.PI/2){const c=document.createElement('canvas');c.width=256;c.height=64;const ctx=c.getContext('2d')!;ctx.fillStyle=color;ctx.font='500 42px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,128,32);const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;const m=new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,side:T.DoubleSide});const o=this.mesh(new T.PlaneGeometry(size*4,size),m,x,y,z);o.rotation.x=rotate;o.castShadow=false;return o;}
 private room(){
  const tabletop=this.mesh(new RoundedBoxGeometry(29,.7,23,3,.35),this.wood('#826045'),0,-1.1,0,this.scene);tabletop.receiveShadow=true;
  this.box(80,.3,80,'#7a8572',0,-5,0,this.scene);this.box(50,18,.5,'#9ca88e',0,3,-16,this.scene);this.box(.5,18,40,'#c6c5aa',-21,3,0,this.scene);
  for(const x of [-15,-6,3,12]){this.box(7.5,10,.1,'#c6d9c1',x,5,-15.65,this.scene);for(const dx of [-3.9,0,3.9])this.box(.17,10.4,.3,'#e5ddbd',x+dx,5,-15.5,this.scene);this.box(8,.17,.3,'#e5ddbd',x,5,-15.4,this.scene);this.box(8.6,.3,1,'#e1d0aa',x,-.1,-15.4,this.scene);}
  // Objects around the table give a clear sense of scale and light.
  for(const x of [-11.4,11.4]){this.mesh(new T.CylinderGeometry(.8,.55,1.4,24),this.material('#b4a37f'),x,-.05,-7,this.scene);for(let i=0;i<9;i++){const angle=i*2.4,leaf=this.mesh(new T.SphereGeometry(.55,10,8),this.material(i%2?'#496e50':'#65845c'),x+Math.sin(angle)*.65,.7+i*.14,-7+Math.cos(angle)*.65,this.scene);leaf.scale.set(.5,1.5,1);leaf.rotation.z=Math.sin(angle)*.7;}}
  for(let i=0;i<3;i++){const book=this.box(2.7,.24,2,'#314d55',10,-.57+i*.27,5,this.scene);book.rotation.y=.12*i;this.box(2.5,.15,1.8,ivory,10,-.56+i*.27,5,this.scene);}
  this.mesh(new T.CylinderGeometry(.55,.48,.9,24),this.material(ivory),-10,-.3,5,this.scene);this.mesh(new T.CylinderGeometry(.47,.47,.02,24),this.material('#483021'),-10,.16,5,this.scene);
 }
 private point(id:number,x:number,y:number,z:number,w=1,h=.1,d=1){this.cells.set(id,new T.Vector3(x,y,z));const proxy=this.mesh(new T.BoxGeometry(w,h,d),new T.MeshBasicMaterial({visible:false}),x,y+h/2,z,this.board);proxy.userData.id=id;this.picks.push(proxy);}
 private build(){
  const game=this.state.game;
  if(['chess-online','checkers','reversi'].includes(game)){
   this.mesh(new RoundedBoxGeometry(11.2,.65,11.2,3,.18),this.wood('#68432d'),0,-.35,0);this.box(10.5,.07,10.5,gold,0,-.015,0);
   for(let i=0;i<64;i++){const x=(i%8-3.5)*1.2,z=(Math.floor(i/8)-3.5)*1.2;this.box(1.19,.08,1.19,game==='reversi'?'#38685b':(i+Math.floor(i/8))%2?'#386058':'#eadabd',x,.025,z);this.point(i,x,.08,z,1.2,.1,1.2);}
   for(let i=0;i<8;i++){this.label('abcdefgh'[i],(i-3.5)*1.2,.03,5.15,.22);this.label(String(8-i),-5.15,.03,(i-3.5)*1.2,.22);this.label('abcdefgh'[7-i],(i-3.5)*1.2,.03,-5.15,.22).rotation.z=Math.PI;}
  }else if(game==='oware'){
   const shape=new T.Shape();shape.moveTo(-8.5,-3);shape.lineTo(8.5,-3);shape.quadraticCurveTo(9,-3,9,-2.5);shape.lineTo(9,2.5);shape.quadraticCurveTo(9,3,8.5,3);shape.lineTo(-8.5,3);shape.quadraticCurveTo(-9,3,-9,2.5);shape.lineTo(-9,-2.5);shape.quadraticCurveTo(-9,-3,-8.5,-3);
   for(let i=0;i<14;i++){const x=i<12?((i<6?i:11-i)-2.5)*2.12:i===12?-7.65:7.65,z=i<6?1.5:i<12?-1.5:0,r=i<12?.81:.91;const hole=new T.Path();hole.absarc(x,-z,r,0,Math.PI*2,false);shape.holes.push(hole);const cup=bowl(r,.66);cup.position.set(x,.04,z);this.board.add(cup);if(i<12){this.point(i,x,.08,z,1.75,.05,1.75);this.label('ABCDEF'[i%6],x,.09,z+(i<6?1.04:-1.04),.21);}else this.cells.set(i,new T.Vector3(x,0,z));}
   const g=new T.ExtrudeGeometry(shape,{depth:.7,bevelEnabled:true,bevelThickness:.055,bevelSize:.055,bevelSegments:2,curveSegments:24});const uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,(uv.getX(i)+9)/18,(uv.getY(i)+3)/6);g.rotateX(-Math.PI/2);this.mesh(g,this.wood('#92603b'),0,-.7,0);this.label('O W A R E',0,.09,0,.36);
  }else if(game==='connect-four'){
   const shape=new T.Shape();shape.moveTo(-4.1,.15);shape.lineTo(4.1,.15);shape.lineTo(4.1,7.3);shape.lineTo(-4.1,7.3);shape.closePath();
   for(let i=0;i<42;i++){const x=(i%7-3)*1.05,y=6.5-Math.floor(i/7)*1.05,hole=new T.Path();hole.absarc(x,y,.46,0,Math.PI*2,false);shape.holes.push(hole);this.cells.set(i,new T.Vector3(x,y,.05));}
   const g=new T.ExtrudeGeometry(shape,{depth:.38,bevelEnabled:true,bevelSize:.055,bevelThickness:.055,bevelSegments:2,curveSegments:24});this.mesh(g,this.material('#366477',.18,.3),0,0,-.19);for(const x of [-4.35,4.35]){this.box(.35,7.65,.65,gold,x,3.6,0);this.box(1.3,.3,3.5,'#284752',x,0,0);}
   for(let column=0;column<7;column++){const proxy=this.mesh(new T.BoxGeometry(1,7.8,.25),new T.MeshBasicMaterial({visible:false}),(column-3)*1.05,3.7,.45);proxy.userData.id=column;this.picks.push(proxy);}
  }else if(game==='hex'){
   this.mesh(new RoundedBoxGeometry(13,.55,10,3,.2),this.wood('#68432d'),0,-.3,0);
   for(let i=0;i<121;i++){const col=i%11,row=Math.floor(i/11),x=(col-5)*.74+(row-5)*.37,z=(row-5)*.65;this.mesh(new T.CylinderGeometry(.414,.414,.12,6),this.material('#e6d6b4'),x,0,z);this.point(i,x,.08,z,.7,.1,.65);}
   for(let i=0;i<11;i++){for(const row of [0,10]){const x=(i-5)*.74+(row-5)*.37;this.box(.7,.05,.1,coral,x,.09,(row-5)*.65+(row===0?-.47:.47));}for(const col of [0,10])this.box(.1,.05,.6,lilac,(col-5)*.74+(i-5)*.37+(col===0?-.47:.47),.09,(i-5)*.65);}
  }else if(game==='dots-boxes'){
   this.mesh(new RoundedBoxGeometry(10,.5,10,3,.22),this.wood('#a17a4f'),0,-.3,0);this.box(9.3,.05,9.3,'#dfd3af',0,-.02,0);
   for(let y=0;y<5;y++)for(let x=0;x<5;x++)this.mesh(new T.SphereGeometry(.14,14,10),this.material(gold,.65,.25),(x-2)*2,.15,(y-2)*2);
   for(let i=0;i<40;i++){const horizontal=i<20,j=horizontal?i:i-20,x=horizontal?(j%4-1.5)*2:(j%5-2)*2,z=horizontal?(Math.floor(j/4)-2)*2:(Math.floor(j/5)-1.5)*2;this.point(i,x,.07,z,horizontal?1.7:.45,.15,horizontal?.45:1.7);}
  }else{
   this.mesh(new RoundedBoxGeometry(10.5,.6,10.5,3,.2),this.wood('#956b42'),0,-.35,0);
   for(let r=0;r<3;r++){const a=(3-r)*1.5;for(const z of [-a,a])this.box(a*2,.025,.035,gold,0,.01,z);for(const x of [-a,a])this.box(.035,.025,a*2,gold,x,.01,0);}
   for(const z of [-3,3])this.box(.035,.025,3,gold,0,.01,z);for(const x of [-3,3])this.box(3,.025,.035,gold,x,.01,0);
   morris.forEach(([x,z],i)=>{const px=(x-3)*1.5,pz=(z-3)*1.5;this.mesh(new T.CylinderGeometry(.14,.14,.035,20),this.material('#513c2d'),px,.02,pz);this.point(i,px,.05,pz,1,.1,1);});
  }
 }
 update(state:TableState,active:number[],selected:number|null){
  const before=this.state;this.state=state;this.active=active;this.selected=selected;
  if(state.game==='oware'){disposeObject(this.pieces);this.pieces.clear();const counts=[...state.board,...(state.scores||[0,0])];counts.forEach((count,i)=>{const center=this.cells.get(i)!;for(let j=0;j<Math.min(count,36);j++){const s=seed(j%3?'#bfa077':'#dbc297'),a=j*2.39996,r=Math.min(.55,.14+Math.sqrt(j)*.07);s.position.set(center.x+Math.cos(a)*r,-.35+Math.floor(j/9)*.1,center.z+Math.sin(a)*r);s.scale.setScalar(1.4);s.rotation.set(j*.7,j*.9,j*.3);this.pieces.add(s);}});
  }else if(state.game==='dots-boxes'){
   disposeObject(this.pieces);this.pieces.clear();state.edges?.forEach((owner,i)=>{const p=this.cells.get(i)!;this.box(i<20?1.8:.11,.11,i<20?.11:1.8,owner?owner>0?coral:lilac:'#b7a381',p.x,.09,p.z,this.pieces);});state.board.forEach((owner,i)=>{if(owner)this.box(1.63,.055,1.63,owner>0?coral:lilac,(i%4-1.5)*2,.025,(Math.floor(i/4)-1.5)*2,this.pieces);});
  }else{
   const last=state.last,from=last?.from,to=last?.to;
   if(state.moves!==before.moves&&from!==undefined&&to!==undefined&&this.objects.has(from)&&!state.board[from]){const moving=this.objects.get(from)!;const captured=this.objects.get(to);if(captured){disposeObject(captured.object);captured.object.removeFromParent();this.objects.delete(to);}this.objects.delete(from);this.objects.set(to,moving);}
   for(const [i,item] of this.objects)if(!state.board[i]||(item.value!==state.board[i]&&state.game!=='reversi')){disposeObject(item.object);item.object.removeFromParent();this.objects.delete(i);}
   state.board.forEach((value,i)=>{if(!value)return;const pos=this.cells.get(i);if(!pos)return;let item=this.objects.get(i);if(!item){let object:T.Group;
    if(state.game==='chess-online'){object=chessPiece(value);if(Math.abs(value)===2)object.rotation.y=value>0?0:Math.PI;}
    else if(state.game==='reversi')object=reversiDisc(value);
    else if(state.game==='connect-four'){object=new T.Group();const m=this.mesh(new T.CylinderGeometry(.43,.43,.24,36),this.material(value>0?coral:lilac,.15,.3),0,0,0,object);m.rotation.x=Math.PI/2;const ring=this.mesh(new T.TorusGeometry(.32,.022,8,36),this.material(gold,.5,.3),0,0,.132,object);ring.castShadow=false;}
    else if(state.game==='hex'){object=new T.Group();this.mesh(new T.SphereGeometry(.28,20,12),this.material(value===1?coral:lilac,.15,.25),0,.11,0,object).scale.y=.45;}
    else object=checker(value);
    item={value,object};this.objects.set(i,item);this.pieces.add(object);object.position.copy(pos);if(state.game==='connect-four'&&state.moves>before.moves&&last?.to===i&&!this.reduced){object.position.y=8.5;this.animations.push({object,from:object.position.clone(),to:pos.clone(),start:performance.now()});}
   }
   const changed=state.game==='reversi'&&item.value!==value;if(changed){item.value=value;const pivot=item.object.userData.flipPivot as T.Group;if(this.reduced)pivot.rotation.x=value>0?0:Math.PI;else this.animations.push({object:pivot,from:new T.Vector3(pivot.rotation.x,0,0),to:new T.Vector3(value>0?0:Math.PI,0,0),start:performance.now(),flip:true});}
   if(item.object.position.distanceTo(pos)>.01&&!this.animations.some(a=>a.object===item!.object)){if(this.reduced)item.object.position.copy(pos);else this.animations.push({object:item.object,from:item.object.position.clone(),to:pos.clone(),start:performance.now()});}
  });}
  this.highlight();this.dirty=true;
 }
 private highlight(){disposeObject(this.accents);this.accents.clear();const game=this.state.game;if(game==='connect-four'){for(const id of this.active){const g=this.mesh(new T.ConeGeometry(.2,.28,12),this.material(gold), (id-3)*1.05,7.8,0,this.accents);g.rotation.z=Math.PI;}return;}
  const markActive=game==='hex'||game==='dots-boxes'||game==='nine-mens-morris'&&this.selected===null&&!this.state.capture?[]:this.active;
  for(const id of new Set([...markActive,...(this.selected===null?[]:[this.selected]),...(this.state.last?.to===undefined?[]:[this.state.last.to])])){const p=this.cells.get(id);if(!p)continue;const selected=id===this.selected,legal=this.active.includes(id),radius=game==='oware'?.88:game==='hex'?.35:.47;const ring=this.mesh(new T.TorusGeometry(radius,selected?.04:.025,8,40),new T.MeshBasicMaterial({color:selected?'#ffdb78':legal?'#afe4c8':'#d8be87',transparent:true,opacity:legal||selected?1:.65}),p.x,.13,p.z,this.accents);ring.rotation.x=-Math.PI/2;ring.castShadow=false;}
 }
 setView(mode:string,rotation:number,side:number|null){this.mode=mode;this.rotation=rotation;this.side=side;this.size();}
 private size(){const width=this.host.clientWidth,height=this.host.clientHeight;if(!width||!height)return;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;const game=this.state.game,oware=game==='oware',four=game==='connect-four',wide=oware?18:game==='hex'?14:12;const angle=(this.side===1?Math.PI:0)+this.rotation*Math.PI/2+(this.mode==='overhead'?0:Math.PI/14);
  const target=new T.Vector3(0,four?3.5:0,0),distance=Math.max(oware?18:four?16:17,wide/(2*Math.tan(T.MathUtils.degToRad(this.camera.fov/2))*this.camera.aspect)*(this.camera.aspect<1.1?1.32:1.13));
  if(four)this.camera.position.set(Math.sin(this.rotation*.35)*distance*.35,8,distance);else if(this.mode==='overhead')this.camera.position.set(Math.sin(angle)*.01,distance,Math.cos(angle)*.01);else this.camera.position.set(Math.sin(angle)*distance*.48,distance*.68,Math.cos(angle)*distance*.73);
  this.camera.lookAt(target);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();this.projectPoints();this.dirty=true;
 }
 private projectPoints(){const points:TablePoint[]=[];const w=this.host.clientWidth,h=this.host.clientHeight,game=this.state.game;
  const ids=game==='connect-four'?Array.from({length:7},(_,i)=>i):[...this.cells.keys()].filter(i=>game!=='oware'||i<12);
  for(const id of ids){const pos=game==='connect-four'?new T.Vector3((id-3)*1.05,7.75,0):this.cells.get(id)!.clone();const center=pos.clone().project(this.camera),edge=pos.clone().add(new T.Vector3(game==='oware'?.7:.4,0,0)).project(this.camera);points.push({id,x:(center.x+1)*w/2,y:(1-center.y)*h/2,size:Math.max(19,Math.min(52,Math.abs(edge.x-center.x)*w*1.5))});}this.project(points);
 }
 private pointer=(event:PointerEvent)=>{const r=this.host.getBoundingClientRect();this.ray.setFromCamera(new T.Vector2((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2),this.camera);const hits=this.ray.intersectObjects([...this.picks,...this.pieces.children],true);for(const hit of hits){let object:T.Object3D|null=hit.object;while(object&&object.parent!==this.pieces&&object.userData.id===undefined)object=object.parent;let id=object?.userData.id;if(id===undefined&&object)id=[...this.objects].find(([,item])=>item.object===object)?.[0];if(id!==undefined){this.onPick(id);break;}}};
 private draw=(now:number)=>{this.frame=requestAnimationFrame(this.draw);if(document.hidden||now-this.last<16)return;this.last=now;for(const a of this.animations){const t=Math.min(1,(now-a.start)/350),e=1-Math.pow(1-t,3);if(a.flip)a.object.rotation.x=T.MathUtils.lerp(a.from.x,a.to.x,e);else{a.object.position.lerpVectors(a.from,a.to,e);if(this.state.game!=='connect-four')a.object.position.y+=Math.sin(t*Math.PI)*.3;}}this.animations=this.animations.filter(a=>now-a.start<350);if(this.dirty||this.animations.length){this.renderer.render(this.scene,this.camera);this.dirty=this.animations.length>0;this.host.dataset.drawCalls=String(this.renderer.info.render.calls);this.elapsed++;}};
 dispose(){cancelAnimationFrame(this.frame);this.resize.disconnect();this.renderer.domElement.removeEventListener('pointerup',this.pointer);disposeObject(this.scene);this.scene.traverse(o=>{if(o instanceof T.DirectionalLight){o.shadow.map?.dispose();o.shadow.mapPass?.dispose();}});this.environment.dispose();this.renderer.dispose();this.renderer.domElement.remove();}
}
