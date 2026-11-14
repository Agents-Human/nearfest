import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {chessPiece,checker,reversiDisc,seed,morrisStone} from './table-models';
import {woodMaterial,fabricMaterial} from './table-materials';
import {mancalaBoard,mancalaPits,pitFloor} from './mancala-model';
import type {BoardState} from '../../server/skill/engines.mjs';
export type TableState=Omit<BoardState,'history'>;
export type TablePoint={id:number;x:number;y:number;size:number;labelX?:number;labelY?:number};
const ivory='#f4e6c8',ink='#253f50',gold='#d7af65',coral='#dd8063',lilac='#9b83bb';
const morris=Array.from({length:3},(_,r)=>[[r,r],[3,r],[6-r,r],[6-r,3],[6-r,6-r],[3,6-r],[r,6-r],[r,3]]).flat();
function disposeObject(root:T.Object3D){const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>(),ts=new Set<T.Texture>();root.traverse(o=>{if(!(o instanceof T.Mesh))return;gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){ms.add(m);for(const value of Object.values(m))if(value instanceof T.Texture)ts.add(value);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());}
export class TableRenderer{
 private renderer:T.WebGLRenderer;private scene=new T.Scene();private camera=new T.OrthographicCamera(-8,8,8,-8,.1,160);private board=new T.Group();private pieces=new T.Group();private accents=new T.Group();private environment:T.WebGLRenderTarget;private resize:ResizeObserver;private frame=0;private last=0;private mode='perspective';private rotation=0;private state:TableState;private side:number|null;private ray=new T.Raycaster();private picks:T.Mesh[]=[];private cells=new Map<number,T.Vector3>();private active:number[]=[];private selected:number|null=null;private animations:{object:T.Object3D;from:T.Vector3;to:T.Vector3;start:number;flip?:boolean}[]=[];private objects=new Map<number,{value:number;object:T.Group}>();private reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;private dirty=true;private elapsed=0;private onPick:(id:number)=>void;private project:(p:TablePoint[])=>void;
 constructor(private host:HTMLElement,state:TableState,side:number|null,pick:(id:number)=>void,project:(p:TablePoint[])=>void){
  this.state=state;this.side=side;this.onPick=pick;this.project=project;this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.95;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;host.appendChild(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','Interactive 3D game table');this.renderer.domElement.addEventListener('pointerup',this.pointer);
  this.scene.background=new T.Color('#26382e');const pmrem=new T.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.environment=pmrem.fromScene(room,.04);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.5;pmrem.dispose();room.dispose();
  this.scene.add(new T.HemisphereLight('#f2f5ff','#453a2e',.85));const sun=new T.DirectionalLight('#fff2df',2.1);sun.position.set(-10,18,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-13,right:13,top:13,bottom:-13,near:1,far:55});sun.shadow.normalBias=.025;sun.shadow.bias=-.00015;this.scene.add(sun);const rim=new T.DirectionalLight('#c3d9ef',.65);rim.position.set(10,6,-8);this.scene.add(rim);
  this.scene.add(this.board,this.pieces,this.accents);this.room();this.build();this.update(state,[],null);this.resize=new ResizeObserver(()=>this.size());this.resize.observe(host);this.size();this.frame=requestAnimationFrame(this.draw);host.dataset.renderer='three-dimensional';
 }
 private material(color:string,metalness=0,roughness=.45){return new T.MeshStandardMaterial({color,metalness,roughness});}
 private mesh(g:T.BufferGeometry,m:T.Material,x=0,y=0,z=0,parent:T.Object3D=this.board){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
 private box(w:number,h:number,d:number,color:string,x=0,y=0,z=0,parent:T.Object3D=this.board,r=.04){return this.mesh(new RoundedBoxGeometry(w,h,d,2,r),this.material(color),x,y,z,parent);}
 private wood(color:string){return woodMaterial(color);}
 private label(text:string,x:number,y:number,z:number,size=.4,color='#685039',rotate=-Math.PI/2){const c=document.createElement('canvas');c.width=256;c.height=64;const ctx=c.getContext('2d')!;ctx.fillStyle=color;ctx.font='500 42px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,128,32);const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;const m=new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,side:T.DoubleSide});const o=this.mesh(new T.PlaneGeometry(size*4,size),m,x,y,z);o.rotation.x=rotate;o.castShadow=false;return o;}
 private room(){
  const game=this.state.game;
  const fabrics:Record<string,string>={'chess-online':'#283e35',checkers:'#24313e',reversi:'#183c34',oware:'#b7a17f','connect-four':'#d1e2e7','dots-boxes':'#5b6a72',hex:'#35424d','nine-mens-morris':'#423d37'};
  this.scene.background=new T.Color(fabrics[game]||'#313d38');
  const ground=this.mesh(new T.PlaneGeometry(160,160),fabricMaterial(fabrics[game]||'#313d38'),0,-.82,0,this.scene);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
  // Each game has a quiet surface so the actual board, pieces and moves remain the focus.
  if(game==='oware'){
   for(const z of [-4.15,4.15]){
    this.box(22,.015,.48,'#71432e',0,-.8,z,this.scene,.002);
    this.box(22,.016,.09,'#e0c18c',0,-.79,z,this.scene,.002);
    for(let x=-10.5;x<=10.5;x+=.75){const stitch=this.box(.24,.018,.24,x%1.5===0?'#3c3930':'#c08b44',x,-.78,z,this.scene,.002);stitch.rotation.y=Math.PI/4;}
   }
  }
 }
 private point(id:number,x:number,y:number,z:number,w=1,h=.1,d=1){this.cells.set(id,new T.Vector3(x,y,z));const proxy=this.mesh(new T.BoxGeometry(w,h,d),new T.MeshBasicMaterial({visible:false}),x,y+h/2,z,this.board);proxy.userData.id=id;this.picks.push(proxy);}
 private build(){
  const game=this.state.game;
  if(['chess-online','checkers','reversi'].includes(game)){
   const chess=game==='chess-online',draughts=game==='checkers';
   const frame=chess?this.wood('#4f2e1b'):this.material(draughts?'#18232f':'#102f24',.05,.4);
   this.mesh(new RoundedBoxGeometry(11.05,.62,11.05,4,.15),frame,0,-.38,0);
   this.box(10.65,.045,10.65,chess?'#c6a570':draughts?'#73818d':'#215f46',0,-.048,0);
   const squares=chess?[this.wood('#dfc79d'),this.wood('#75462c')]:[this.material(draughts?'#cbd2d7':'#246b4a',0,.65),this.material(draughts?'#697582':'#246b4a',0,.65)];
   for(let i=0;i<64;i++){
    const x=(i%8-3.5)*1.2,z=(Math.floor(i/8)-3.5)*1.2,dark=(i+Math.floor(i/8))%2;
    const material=squares[dark];
    this.mesh(new T.BoxGeometry(game==='reversi'?1.18:1.2,.055,game==='reversi'?1.18:1.2),material,x,0,z);
    this.point(i,x,.03,z,1.2,.1,1.2);
   }
   const labelColor=chess?'#503420':draughts?'#29333f':'#a7c6a6';
   for(let i=0;i<8;i++){
    this.label('abcdefgh'[i],(i-3.5)*1.2,-.015,5.08,.22,labelColor);
    this.label(String(8-i),-5.08,-.015,(i-3.5)*1.2,.22,labelColor);
    this.label('abcdefgh'[i],(i-3.5)*1.2,-.015,-5.08,.22,labelColor).rotation.z=Math.PI;
   }
   if(game==='reversi')for(const x of [-2.4,2.4])for(const z of [-2.4,2.4])this.mesh(new T.CylinderGeometry(.06,.06,.012,12),this.material('#102e22'),x,.04,z);
  }else if(game==='oware'){
   this.board.add(mancalaBoard());
   mancalaPits.forEach((pit,i)=>{if(i<12)this.point(i,pit.x,.15,pit.z,1.95,.08,2.1);else this.cells.set(i,new T.Vector3(pit.x,.15,pit.z));});
   this.label('O W A R E',0,.135,0,.22,'#e8bd7d');
   for(let i=0;i<12;i++){const p=mancalaPits[i];this.label('ABCDEF'[i%6],p.x,.14,p.z+(i<6?1.28:-1.28),.17,'#e8c794');}
  }else if(game==='connect-four'){
   const shape=new T.Shape();shape.moveTo(-4.1,.15);shape.lineTo(4.1,.15);shape.lineTo(4.1,7.3);shape.lineTo(-4.1,7.3);shape.closePath();
   for(let i=0;i<42;i++){const x=(i%7-3)*1.05,y=6.5-Math.floor(i/7)*1.05,hole=new T.Path();hole.absarc(x,y,.46,0,Math.PI*2,false);shape.holes.push(hole);this.cells.set(i,new T.Vector3(x,y,.05));}
   const g=new T.ExtrudeGeometry(shape,{depth:.38,bevelEnabled:true,bevelSize:.055,bevelThickness:.055,bevelSegments:2,curveSegments:24});this.mesh(g,this.material('#234dba',.05,.32),0,0,-.19);for(const x of [-4.35,4.35]){this.box(.35,7.65,.65,'#1a3585',x,3.6,0);this.box(1.3,.3,3.5,'#1a3585',x,0,0);}
   for(let column=0;column<7;column++){const proxy=this.mesh(new T.BoxGeometry(1,7.8,.25),new T.MeshBasicMaterial({visible:false}),(column-3)*1.05,3.7,.45);proxy.userData.id=column;this.picks.push(proxy);}
  }else if(game==='hex'){
   this.mesh(new RoundedBoxGeometry(13,.55,10,3,.2),this.material('#26343d'),0,-.3,0);
   for(let i=0;i<121;i++){const col=i%11,row=Math.floor(i/11),x=(col-5)*.74+(row-5)*.37,z=(row-5)*.65;this.mesh(new T.CylinderGeometry(.414,.414,.12,6),this.material('#d9e3e4'),x,0,z);this.point(i,x,.08,z,.7,.1,.65);}
   for(let i=0;i<11;i++){for(const row of [0,10]){const x=(i-5)*.74+(row-5)*.37;this.box(.7,.05,.1,coral,x,.09,(row-5)*.65+(row===0?-.47:.47));}for(const col of [0,10])this.box(.1,.05,.6,lilac,(col-5)*.74+(i-5)*.37+(col===0?-.47:.47),.09,(i-5)*.65);}
  }else if(game==='dots-boxes'){
   this.mesh(new RoundedBoxGeometry(10,.5,10,3,.22),this.material('#d2d3c7'),0,-.3,0);this.box(9.3,.05,9.3,'#f3f0e4',0,-.02,0);
   for(let y=0;y<5;y++)for(let x=0;x<5;x++)this.mesh(new T.SphereGeometry(.14,14,10),this.material(gold,.65,.25),(x-2)*2,.15,(y-2)*2);
   for(let i=0;i<40;i++){const horizontal=i<20,j=horizontal?i:i-20,x=horizontal?(j%4-1.5)*2:(j%5-2)*2,z=horizontal?(Math.floor(j/4)-2)*2:(Math.floor(j/5)-1.5)*2;this.point(i,x,.07,z,horizontal?1.7:.45,.15,horizontal?.45:1.7);}
  }else{
   this.mesh(new RoundedBoxGeometry(10.5,.6,10.5,3,.2),this.wood('#b18a56'),0,-.35,0);
   for(let r=0;r<3;r++){const a=(3-r)*1.5;for(const z of [-a,a])this.box(a*2,.025,.035,gold,0,.01,z);for(const x of [-a,a])this.box(.035,.025,a*2,gold,x,.01,0);}
   for(const z of [-3,3])this.box(.035,.025,3,gold,0,.01,z);for(const x of [-3,3])this.box(3,.025,.035,gold,x,.01,0);
   morris.forEach(([x,z],i)=>{const px=(x-3)*1.5,pz=(z-3)*1.5;this.mesh(new T.CylinderGeometry(.14,.14,.035,20),this.material('#513c2d'),px,.02,pz);this.point(i,px,.05,pz,1,.1,1);});
  }
 }
 update(state:TableState,active:number[],selected:number|null){
  const before=this.state;this.state=state;this.active=active;this.selected=selected;
  if(state.game==='oware'){
   disposeObject(this.pieces);this.pieces.clear();
   [...state.board,...(state.scores||[0,0])].forEach((count,i)=>{
    const pit=mancalaPits[i];
    for(let j=0;j<count;j++){
     const store=i>=12,perLayer=store?16:7,level=Math.floor(j/perLayer),slot=j%perLayer;
     const angle=slot*2.39996+level*.7,r=store?Math.sqrt((slot+.5)/perLayer)*.74:count<=4?.33:slot===0?0:.43;
     const a=!store&&count<=4?slot*Math.PI/2+Math.PI/4:angle;const x=pit.x+Math.cos(a)*r*pit.rx,z=pit.z+Math.sin(a)*r*pit.rz;
     const stone=seed(['#a77c43','#876038','#b18a53','#926b3e'][j%4]);stone.scale.set(1.9,1.6,1.9);stone.rotation.y=j*1.7;
     stone.position.set(x,pitFloor(pit,x,z)+.025+level*.22,z);this.pieces.add(stone);
    }
   });
  }else if(state.game==='dots-boxes'){
   disposeObject(this.pieces);this.pieces.clear();state.edges?.forEach((owner,i)=>{const p=this.cells.get(i)!;this.box(i<20?1.8:.11,.11,i<20?.11:1.8,owner?owner>0?coral:lilac:'#b7a381',p.x,.09,p.z,this.pieces);});state.board.forEach((owner,i)=>{if(owner)this.box(1.63,.055,1.63,owner>0?coral:lilac,(i%4-1.5)*2,.025,(Math.floor(i/4)-1.5)*2,this.pieces);});
  }else{
   const last=state.last,from=last?.from,to=last?.to;
   if(state.moves!==before.moves&&from!==undefined&&to!==undefined&&this.objects.has(from)&&!state.board[from]){const moving=this.objects.get(from)!;const captured=this.objects.get(to);if(captured){disposeObject(captured.object);captured.object.removeFromParent();this.objects.delete(to);}this.objects.delete(from);this.objects.set(to,moving);}
   for(const [i,item] of this.objects)if(!state.board[i]||(item.value!==state.board[i]&&state.game!=='reversi')){disposeObject(item.object);item.object.removeFromParent();this.objects.delete(i);}
   state.board.forEach((value,i)=>{if(!value)return;const pos=this.cells.get(i);if(!pos)return;let item=this.objects.get(i);if(!item){let object:T.Group;
    if(state.game==='chess-online'){object=chessPiece(value);if(Math.abs(value)===2)object.rotation.y=value>0?0:Math.PI;}
    else if(state.game==='reversi')object=reversiDisc(value);
    else if(state.game==='connect-four'){object=new T.Group();const m=this.mesh(new T.CylinderGeometry(.43,.43,.24,36),this.material(value>0?'#e64332':'#f7c839',.02,.32),0,0,0,object);m.rotation.x=Math.PI/2;const ring=this.mesh(new T.TorusGeometry(.32,.022,8,36),this.material(value>0?'#b72924':'#d5a11b',.02,.4),0,0,.132,object);ring.castShadow=false;}
    else if(state.game==='hex'){object=new T.Group();this.mesh(new T.SphereGeometry(.28,20,12),this.material(value===1?coral:lilac,.15,.25),0,.11,0,object).scale.y=.45;}
    else object=state.game==='nine-mens-morris'?morrisStone(value):checker(value);
    item={value,object};this.objects.set(i,item);this.pieces.add(object);object.position.copy(pos);if(state.game==='connect-four'&&state.moves>before.moves&&last?.to===i&&!this.reduced){object.position.y=8.5;this.animations.push({object,from:object.position.clone(),to:pos.clone(),start:performance.now()});}
   }
   const changed=state.game==='reversi'&&item.value!==value;if(changed){item.value=value;const pivot=item.object.userData.flipPivot as T.Group;if(this.reduced)pivot.rotation.x=value>0?0:Math.PI;else this.animations.push({object:pivot,from:new T.Vector3(pivot.rotation.x,0,0),to:new T.Vector3(value>0?0:Math.PI,0,0),start:performance.now(),flip:true});}
   if(item.object.position.distanceTo(pos)>.01&&!this.animations.some(a=>a.object===item!.object)){if(this.reduced)item.object.position.copy(pos);else this.animations.push({object:item.object,from:item.object.position.clone(),to:pos.clone(),start:performance.now()});}
  });}
  this.highlight();this.dirty=true;
 }
 private highlight(){disposeObject(this.accents);this.accents.clear();const game=this.state.game;if(game==='connect-four'){for(const id of this.active){const g=this.mesh(new T.ConeGeometry(.2,.28,12),this.material(gold), (id-3)*1.05,7.8,0,this.accents);g.rotation.z=Math.PI;}return;}
  const markActive=game==='hex'||game==='dots-boxes'||((game==='chess-online'||game==='checkers'||game==='nine-mens-morris')&&this.selected===null&&!this.state.capture)?[]:this.active;
  for(const id of new Set([...markActive,...(this.selected===null?[]:[this.selected]),...(this.state.last?.to===undefined?[]:[this.state.last.to])])){const p=this.cells.get(id);if(!p)continue;const selected=id===this.selected,legal=this.active.includes(id),radius=game==='oware'?1.015:game==='hex'?.35:.47;const ring=this.mesh(new T.TorusGeometry(radius,selected?.04:.025,8,40),new T.MeshBasicMaterial({color:selected?'#ffce4d':legal?(game==='oware'?'#e2bd72':'#f6d06a'):'#e8ce88',transparent:true,opacity:legal||selected?1:.65}),p.x,.13,p.z,this.accents);ring.rotation.x=-Math.PI/2;if(game==='oware')ring.scale.y=1.08;ring.castShadow=false;}
 }
 setView(mode:string,rotation:number,side:number|null){this.mode=mode;this.rotation=rotation;this.side=side;this.size();}
 private size(){
  const width=this.host.clientWidth,height=this.host.clientHeight;if(!width||!height)return;
  this.renderer.setSize(width,height,false);const aspect=width/height;
  const game=this.state.game,oware=game==='oware',four=game==='connect-four';
  const angle=(this.side===1&&!four?Math.PI:0)+this.rotation*Math.PI/2;
  const target=new T.Vector3(0,four?3.7:0,0);
  const direction=four?new T.Vector3(Math.sin(this.rotation*.28)*.24,.12,1):this.mode==='overhead'?new T.Vector3(Math.sin(angle)*.001,1,Math.cos(angle)*.001):new T.Vector3(Math.sin(angle)*.52,.85,Math.cos(angle)*.52);direction.normalize();
  this.camera.position.copy(target).addScaledVector(direction,35);this.camera.lookAt(target);this.camera.updateMatrixWorld();
  const halfX=oware?10.3:four?5.2:game==='hex'?6.8:5.6,halfZ=oware?3.5:four?2.0:5.6,top=four?8.1:game==='chess-online'?1.85:.5;
  const bounds=new T.Box3();for(const x of [-halfX,halfX])for(const y of [-.8,top])for(const z of [-halfZ,halfZ])bounds.expandByPoint(new T.Vector3(x,y,z).applyMatrix4(this.camera.matrixWorldInverse));
  const center=bounds.getCenter(new T.Vector3());center.z=0;center.applyQuaternion(this.camera.quaternion);this.camera.position.add(center);target.add(center);this.camera.lookAt(target);
  const extent=Math.max((bounds.max.y-bounds.min.y)/2,(bounds.max.x-bounds.min.x)/2/aspect)*1.055;
  this.camera.left=-extent*aspect;this.camera.right=extent*aspect;this.camera.top=extent;this.camera.bottom=-extent;this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
  this.projectPoints();this.dirty=true;
 }
 private projectPoints(){const points:TablePoint[]=[];const w=this.host.clientWidth,h=this.host.clientHeight,game=this.state.game;
  const ids=game==='connect-four'?Array.from({length:7},(_,i)=>i):[...this.cells.keys()].filter(i=>game!=='oware'||i<12);
  for(const id of ids){
   const pos=game==='connect-four'?new T.Vector3((id-3)*1.05,7.75,0):this.cells.get(id)!.clone();
   const center=pos.clone().project(this.camera),edge=pos.clone().add(new T.Vector3(game==='oware'?.75:.4,0,0)).project(this.camera);
   const point:TablePoint={id,x:(center.x+1)*w/2,y:(1-center.y)*h/2,size:Math.max(22,Math.min(game==='oware'?90:58,Math.abs(edge.x-center.x)*w*1.6))};
   if(game==='oware'){const label=pos.clone();label.z+=id<6?1.15:-1.15;label.y=.18;label.project(this.camera);point.labelX=(label.x+1)*w/2;point.labelY=(1-label.y)*h/2;}
   points.push(point);
  }this.project(points);
 }
 private pointer=(event:PointerEvent)=>{const r=this.host.getBoundingClientRect();this.ray.setFromCamera(new T.Vector2((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2),this.camera);const hits=this.ray.intersectObjects([...this.picks,...this.pieces.children],true);for(const hit of hits){let object:T.Object3D|null=hit.object;while(object&&object.parent!==this.pieces&&object.userData.id===undefined)object=object.parent;let id=object?.userData.id;if(id===undefined&&object)id=[...this.objects].find(([,item])=>item.object===object)?.[0];if(id!==undefined){this.onPick(id);break;}}};
 private draw=(now:number)=>{this.frame=requestAnimationFrame(this.draw);if(document.hidden||now-this.last<16)return;this.last=now;for(const a of this.animations){const t=Math.min(1,(now-a.start)/350),e=1-Math.pow(1-t,3);if(a.flip)a.object.rotation.x=T.MathUtils.lerp(a.from.x,a.to.x,e);else{a.object.position.lerpVectors(a.from,a.to,e);if(this.state.game!=='connect-four')a.object.position.y+=Math.sin(t*Math.PI)*.3;}}this.animations=this.animations.filter(a=>now-a.start<350);if(this.dirty||this.animations.length){this.renderer.render(this.scene,this.camera);this.dirty=this.animations.length>0;this.host.dataset.drawCalls=String(this.renderer.info.render.calls);this.elapsed++;}};
 dispose(){cancelAnimationFrame(this.frame);this.resize.disconnect();this.renderer.domElement.removeEventListener('pointerup',this.pointer);disposeObject(this.scene);this.scene.traverse(o=>{if(o instanceof T.DirectionalLight){o.shadow.map?.dispose();o.shadow.mapPass?.dispose();}});this.environment.dispose();this.renderer.dispose();this.renderer.domElement.remove();}
}
