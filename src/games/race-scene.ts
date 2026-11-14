import * as T from 'three';
import {raceStructures} from './race-structures';
import {raceNitro} from './race-nitro';
import type {RaceSceneryAssets} from './race-scenery';
import {Kit,particles} from './world-kit';
import {car,coin} from './world-models';
import type {RacingAssets,RacingVehicle} from './racing-assets';
import {RACE_BIOMES,raceBiome,roadCenter,roadSlope,roadHeight,roadGrade,raceWaterSections,raceWeather,raceTarget,raceTerrainHeight,raceSceneryAllowed,raceRampGrade,raceTrafficX} from '../../server/arcade/race-course.mjs';

const W=(x:number)=>(x-480)/10;
const COLORS=['#ff6157','#56c7ff','#8de6ae','#ffd45e'];
const SPAN=64, SLOTS=9;
const heading=(d:number)=>Math.atan2(1,roadSlope(d));
const noise=(n:number)=>{const x=Math.sin(n*127.1+26.3)*43758.5453;return x-Math.floor(x);};
type Step=(state:any,dt:number,time:number)=>void;

function ribbon(k:Kit,root:T.Group,segments=16){
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(new Float32Array((segments+1)*6),3));
 const indices:number[]=[];for(let i=0;i<segments;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}geometry.setIndex(indices);
 const mesh=new T.Mesh<T.BufferGeometry,T.Material>(geometry,k.mat('#ffffff'));geometry.setAttribute('uv',new T.BufferAttribute(new Float32Array((segments+1)*4),2));mesh.receiveShadow=true;root.add(mesh);
 return {mesh,write(start:number,left:number,right:number,lift:number,mat:T.Material,length=SPAN,heightAt:(d:number,x:number)=>number=roadHeight){const uv=geometry.getAttribute('uv') as T.BufferAttribute;const p=geometry.attributes.position as T.BufferAttribute;for(let i=0;i<=segments;i++){const d=start+i*length/segments,c=roadCenter(d),h=heightAt(d,left)+lift;p.setXYZ(i*2,c+left,h,-d);p.setXYZ(i*2+1,c+right,heightAt(d,right)+lift,-d);uv.setXY(i*2,0,d);uv.setXY(i*2+1,1,d);}uv.needsUpdate=true;p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();mesh.material=mat;}};
}

export function raceScene(k:Kit,s:any,assets?:RacingAssets,scenery?:RaceSceneryAssets):Step{
 const initialBiome=raceBiome((s.players[s.viewSeat??0]?.y||0)/10);
 const sky=k.sky(initialBiome.sky,initialBiome.haze);
 const fog=new T.Fog(initialBiome.haze,135,300);k.scene.fog=fog;
 const sea=k.surface(1400,1200,'#209eae','water',-5);sea.castShadow=false;k.dynamic.attach(sea);
 const templates=scenery?.templates()||{};
 const houses=['houseA','houseB','houseC','houseD','houseE','houseH','houseJ','houseL','houseN','houseQ','houseT'],shops=['shopA','shopB','shopC','shopD','shopE','shopF','shopG','shopH','shopI','shopK','shopM','shopN'],towers=['towerA','towerB','towerC','towerD','towerE'];
 const biomeProps=[['palm','palmTall',...houses],['spire','rock','cactus','cactusSmall'],['pine','pineTall','snowTree','oak',...houses.slice(3,7)],[...shops,...towers]];
 // Keep the templates attached but hidden so Kit owns and disposes every resource.
 const library=new T.Group();library.visible=false;Object.values(templates).forEach(t=>library.add(t));k.dynamic.add(library);
 const bands=RACE_BIOMES.map(b=>({road:k.mat(b.road),land:k.mat(b.ground),shoulder:k.mat(b.shoulder),accent:k.mat(b.accent),white:k.mat('#f9f2db')}));
 const structures=raceStructures(k);
 const sections=Array.from({length:SLOTS},()=>{
  const root=new T.Group();k.dynamic.add(root);
  const road=ribbon(k,root),leftLand=ribbon(k,root,32),rightLand=ribbon(k,root,32),leftShoulder=ribbon(k,root),rightShoulder=ribbon(k,root);
  const props=new T.Group();root.add(props);
  const scenery=Array.from({length:16},()=>{const g=new T.Group();props.add(g);return g;});
  const foundations=new T.InstancedMesh(new T.BoxGeometry(1,1,1),k.mat('#b8b6a2'),16);foundations.castShadow=true;foundations.receiveShadow=true;root.add(foundations);
  const markers=new T.Group();root.add(markers);
  for(let i=0;i<8;i++)for(const side of [-1,1]){
   const post=k.box(.18,1.1,.2,'#f0eee0',0,0,0,markers);post.userData={index:i,side};
  }
  const curbs=new T.Group();root.add(curbs);
  for(let i=0;i<16;i++)for(const side of [-1,1]){const curb=k.box(.8,.11,4.08,'#fff3dc',0,0,0,curbs);curb.userData={index:i,side};}
  const lines=new T.Group();root.add(lines);
  for(let i=0;i<8;i++)for(const side of [-1,1]){const line=k.box(.13,.015,3.3,'#e8ecdf',0,0,0,lines);line.userData={index:i,side};line.castShadow=false;}
  // Repeated geometry uses instances, so road markings cost three draws per section.
  function instanceGroup(group:T.Group){const first=group.children[0] as T.Mesh;const inst=new T.InstancedMesh(first.geometry,first.material,group.children.length);inst.receiveShadow=true;const data=group.children.map(o=>o.userData);for(const o of group.children.slice(1))(o as T.Mesh).geometry.dispose();group.clear();group.add(inst);return {inst,data};}
  const posts=instanceGroup(markers),stripes=instanceGroup(curbs),dashes=instanceGroup(lines);
  const matrix=new T.Matrix4(),q=new T.Quaternion(),position=new T.Vector3(),scale=new T.Vector3(1,1,1);
  let id=NaN;
  return {root,set(next:number){if(next===id)return;id=next;const start=next*SPAN,b=raceBiome(start+SPAN/2),bi=RACE_BIOMES.indexOf(b),mat=bands[bi];
   road.write(start,-14,14,0,mat.road);leftShoulder.write(start,-17,-14,-.035,mat.shoulder);rightShoulder.write(start,14,17,-.035,mat.shoulder);
   leftLand.write(start,-220,-17,0,mat.land,SPAN,raceTerrainHeight);rightLand.write(start,17,bi===0?42:220,0,mat.land,SPAN,raceTerrainHeight);
   for(const {inst,data} of [posts,stripes,dashes]){data.forEach((u,j)=>{const isCurb=inst===stripes.inst,isDash=inst===dashes.inst,d=start+u.index*(isCurb?4:8)+2,offset=u.side*(isCurb?14.45:isDash?4.5:16.5);position.set(roadCenter(d)+offset,roadHeight(d)+(isCurb?.04:isDash?.04:.55),-d);q.setFromEuler(new T.Euler(isCurb||isDash?Math.atan(roadGrade(d)):0,-Math.atan(roadSlope(d)),0));scale.z=isCurb?Math.hypot(1,roadSlope(d)):1;matrix.compose(position,q,scale);inst.setMatrixAt(j,matrix);if(isCurb)inst.setColorAt(j,new T.Color(u.index%2?b.accent:'#f9f2db'));});inst.instanceMatrix.needsUpdate=true;if(inst.instanceColor)inst.instanceColor.needsUpdate=true;inst.computeBoundingSphere();}
   scenery.forEach((holder,j)=>{
    holder.clear();matrix.makeScale(0,0,0);foundations.setMatrixAt(j,matrix);const side=j%2?1:-1,outer=j>=6,distant=j>=12,local=7+Math.floor((j%6)/2)*22,d=start+local,seed=next*19+j+(s.raceSeed||0)*7;
    if(!raceSceneryAllowed(d,distant?45:16))return;
    const choices=biomeProps[bi];let id=choices[Math.floor(noise(seed+4)*choices.length)];
    if(bi===0&&side>0)id=outer?'parasol':(j%3?'palm':'palmTall');
    if(bi===1&&outer)id=j%2?'spire':'rock';
    if(bi===3&&outer)id=towers[Math.floor(noise(seed+8)*towers.length)];
    if(bi===1&&!outer&&noise(seed+5)>.7)id=houses[Math.floor(noise(seed+6)*houses.length)];
    if(bi===3&&!outer&&j%3===0)id='lamp';
    if(distant)id=bi===3?towers[Math.floor(noise(seed+5)*towers.length)]:bi===1?'mesa':'mountain';
    if(distant&&bi===0&&side>0)return;
    const building=/^(house|shop|tower)/.test(id),variant=Math.floor(noise(seed+17)*5);
    const template=templates[building?id+'-v'+variant:id];if(!template)return;
    holder.add(template.clone(true));const size=.85+noise(seed)*.3;holder.scale.set(size,building?size*(.85+noise(seed+18)*.3):size,size);
    const halfWidth=(template.userData.width||8)*size/2;
    const offset=distant?Math.max(95,55+halfWidth)+noise(seed+2)*30:outer?(bi===0&&side>0?34:48+noise(seed+1)*15):18+halfWidth+noise(seed+3)*3;
    let ground=raceTerrainHeight(d,side*offset)-.03;
    if(building){const width=halfWidth*2,front=raceTerrainHeight(d-halfWidth,side*offset),back=raceTerrainHeight(d+halfWidth,side*offset),top=Math.max(front,back,ground)+.08,bottom=Math.min(front,back,ground)-.4;ground=top;matrix.compose(new T.Vector3(roadCenter(d)+side*offset,(top+bottom)/2,-d),new T.Quaternion(),new T.Vector3(width,top-bottom,width));foundations.setMatrixAt(j,matrix);}
    holder.position.set(roadCenter(d)+side*offset,ground,-d);
    holder.rotation.y=['spire','rock','cactus','cactusSmall','palm','palmTall','pine','pineTall','snowTree','oak','parasol'].includes(id)?noise(seed+10)*6:side<0?Math.PI/2:-Math.PI/2;
   });foundations.instanceMatrix.needsUpdate=true;foundations.computeBoundingSphere();
  }};
 });
 // Clouds drift with the distant horizon, beyond the playable strip.
 const clouds=new T.Group();k.dynamic.add(clouds);
 for(let i=0;i<9;i++){const cloud=new T.Group();for(let j=0;j<3;j++){const p=k.sphere(4+j%2*2,'#f9f5e8',j*5,0,0,cloud);p.scale.set(1,.42,.7);p.castShadow=false;}cloud.position.set((i%2?1:-1)*(55+i*9),26+noise(i)*24,-i*48);clouds.add(cloud);}
 const fx=particles(k,{size:.25,maxScreenSize:12}),spray=particles(k,{size:.2,maxScreenSize:9}),reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const cars=s.players.map((p:any,i:number)=>{
  const g=assets?.vehicle(COLORS[i%4],p.kart as RacingVehicle)||car(COLORS[i%4]);g.scale.setScalar(.95);k.dynamic.add(g);return g;
 });
 const shields=cars.map((g:T.Group)=>{const mat=new T.MeshBasicMaterial({color:'#8ce7ff',transparent:true,opacity:.12,wireframe:true,depthWrite:false});const bubble=k.mesh(new T.SphereGeometry(2.65,12,8),mat,g,0,1,0);bubble.scale.set(1,.7,.65);return bubble;});
 const targetRing=k.mesh(new T.TorusGeometry(2.1,.065,6,32),new T.MeshBasicMaterial({color:'#ffd377',depthWrite:false}),k.dynamic);targetRing.rotation.x=Math.PI/2;
 const bolts=Array.from({length:24},()=>{const g=new T.Group();k.dynamic.add(g);k.mesh(new T.SphereGeometry(.22,8,6),new T.MeshBasicMaterial({color:'#f6ffdf'}),g);const trail=k.mesh(new T.ConeGeometry(.18,2.7,8),new T.MeshBasicMaterial({color:'#74eaff',transparent:true,opacity:.85}),g,0,0,1.2);trail.rotation.x=-Math.PI/2;return g;});
 const nitro=cars.map((g:T.Group,i:number)=>raceNitro(g,i));
 // Fixed-size GPU pools: generated segments never create new cars, coins or boost meshes.
 const traffic=Array.from({length:48},(_,i)=>{const g=assets?.vehicle(['#e4d4a8','#91b2bb','#d8a1ac','#abc2a1'][i%4],(['sedan','hatchback-sports','taxi','suv'] as RacingVehicle[])[i%4])||car('#d4c3a0');g.scale.setScalar(.82);g.userData.trafficModel=['sedan','hatchback-sports','taxi','suv'][i%4];g.userData.trafficId=null;k.dynamic.add(g);return g;});
 const coins=Array.from({length:32},()=>{const g=coin();g.scale.setScalar(.7);k.dynamic.add(g);return g;});
 const labelCanvas=document.createElement('canvas');labelCanvas.width=labelCanvas.height=64;
 const labelContext=labelCanvas.getContext('2d')!;labelContext.fillStyle='#eaffd6';labelContext.font='bold 52px sans-serif';labelContext.textAlign='center';labelContext.textBaseline='middle';labelContext.fillText('N',32,35);
 const fuelLabel=new T.CanvasTexture(labelCanvas);fuelLabel.colorSpace=T.SRGBColorSpace;k.textures.push(fuelLabel);
 const pads=Array.from({length:6},()=>{
  const root=new T.Group();k.dynamic.add(root);
  k.mesh(new T.CylinderGeometry(1.45,1.45,.06,24),new T.MeshBasicMaterial({color:'#7fffd8',transparent:true,opacity:.32,depthWrite:false}),root,0,.08,0);
  k.box(1.55,1.9,.72,'#1c9f91',0,1.6,0,root);k.box(1.68,.22,.8,'#173b49',0,.7,0,root);
  for(const x of [-.4,.25])k.box(.16,.45,.2,'#173b49',x,2.7,0,root);
  k.box(.8,.16,.2,'#173b49',-.08,2.9,0,root);k.box(.35,.22,.45,'#ffd56d',.55,2.65,0,root);
  for(const side of [-1,1]){const label=k.mesh(new T.PlaneGeometry(1.15,1.15),new T.MeshBasicMaterial({map:fuelLabel,transparent:true,depthWrite:false}),root,0,1.6,side*.37);if(side<0)label.rotation.y=Math.PI;}
  return root;
 });
 const streakPositions=new Float32Array(32*6),streakGeo=new T.BufferGeometry();streakGeo.setAttribute('position',new T.BufferAttribute(streakPositions,3));
 const streakMat=new T.LineBasicMaterial({color:'#d6faff',transparent:true,opacity:0,depthWrite:false});const streaks=new T.LineSegments(streakGeo,streakMat);streaks.frustumCulled=false;k.dynamic.add(streaks);
 // Rivers have a fixed water level below elevated bridges, with clear, sculpted banks.
 const waterTexture=k.texture('water','#2b9dae');waterTexture.repeat.set(28,.08);
 const waterMat=new T.MeshStandardMaterial({map:waterTexture,roughness:.3,metalness:.22});
 const waterRoot=new T.Group();k.dynamic.add(waterRoot);
 const crossings=Array.from({length:2},()=>ribbon(k,waterRoot,24));
 const rainPositions=new Float32Array(600*6),rainGeo=new T.BufferGeometry();rainGeo.setAttribute('position',new T.BufferAttribute(rainPositions,3));
 const rainMat=new T.LineBasicMaterial({color:'#c2e7ef',transparent:true,opacity:0,depthWrite:false,fog:true}),rain=new T.LineSegments(rainGeo,rainMat);rain.frustumCulled=false;k.dynamic.add(rain);
 const oldCoins=s.players.map((p:any)=>p.coins),oldHits=s.players.map((p:any)=>p.crashes),oldShots=s.players.map((p:any)=>p.shotsFired||0),oldDamage=s.players.map((p:any)=>p.hitTimer||0),oldLandings=s.players.map((p:any)=>p.landings||0),oldFuel=s.players.map((p:any)=>p.nitroPickups||0);let sprayTime=0;
 const top=new T.Color(),bottom=new T.Color();
 const sun=k.scene.children.find(o=>o instanceof T.DirectionalLight) as T.DirectionalLight|undefined;
 return (state,dt,time)=>{
  const view=state.players[state.viewSeat??0],distance=view.y/10,base=Math.floor(distance/SPAN)-1,b=raceBiome(distance),weather=raceWeather(state.elapsed,state.raceSeed);
  sections.forEach((section,i)=>{section.set(base+i);section.root.visible=(base+i)*SPAN<distance+300;});
  structures(distance);sea.visible=b.id==='coast'||raceBiome(distance+220).id==='coast';
  sea.position.set(roadCenter(distance),-5,-distance-150);clouds.position.z=-distance+30;clouds.position.y=35+roadHeight(distance)*.2;clouds.visible=b.id!=='city';
  const skyMat=sky.material as T.ShaderMaterial;top.set(b.sky).lerp(new T.Color('#394b65'),weather.rain*.72);bottom.set(b.haze).lerp(new T.Color('#8aabb4'),weather.rain*.58);const mix=1-Math.exp(-dt*.7);
  skyMat.uniforms.top.value.lerp(top,mix);skyMat.uniforms.bottom.value.lerp(bottom,mix);fog.color.lerp(bottom,mix);if(sun)sun.intensity=T.MathUtils.lerp(sun.intensity,(b.id==='city'?1.1:2.8)*(1-weather.rain*.55),mix);
  bands.forEach(mat=>{mat.road.roughness=1-weather.wet*.75;mat.road.metalness=weather.wet*.25;});
  fog.near=135-weather.rain*35;
  cars.forEach((g:T.Group,i:number)=>{
   const p=state.players[i],d=p.y/10,h=p.elevation??roadHeight(d),hit=p.crashTimer||0;
   g.position.set(roadCenter(d)+W(p.x),h+.1+Math.sin(time*40)*.015,-d);
   const pitch=p.airborne?Math.atan2(p.verticalSpeed||0,Math.max(22,p.speed/10))*.7:Math.atan(roadGrade(d)+raceRampGrade(d,W(p.x)));
   g.rotation.set(0,heading(d)-(p.heading||0)+(hit?(p.spin||1)*Math.sin(hit*Math.PI/.85)*.85:0)+(p.hitTimer?Math.sin(p.hitTimer*30)*.12:0),0);g.rotateZ(pitch);g.rotateX(-(p.steer||0)*(p.airborne?.08:.035));
   if(p.landingTimer>0)g.position.y+=Math.sin(p.landingTimer*22)*.04*p.landingTimer;
   // Four competitors stay alive as render objects; distance fog handles visibility.
   g.visible=true;
   shields[i].visible=p.shield>0;shields[i].material.opacity=.08+Math.sin(time*10)*.035;
   for(const wheel of g.userData.wheels||[])wheel.rotation.z-=p.speed*dt*.055;
   for(const wheel of g.userData.frontWheels||[])wheel.rotation.y=-(p.steer||0)*.3;
   nitro[i](Boolean(p.boosting&&!state.finished),time,p.speed);
   if(p.coins>oldCoins[i]){fx.burst(g.position.x,h+.9,-d,'#ffdf79',6);oldCoins[i]=p.coins;}
   if((p.nitroPickups||0)>oldFuel[i]){fx.burst(g.position.x,h+1,-d,'#8affdf',10);oldFuel[i]=p.nitroPickups;}
   if(p.crashes>oldHits[i]){fx.burst(g.position.x,h+.5,-d,'#ffb16d',14);oldHits[i]=p.crashes;}
   if((p.shotsFired||0)>oldShots[i]){fx.burst(roadCenter(d+2.5)+W(p.x),h+.8,-d-2.5,'#a3faff',5);oldShots[i]=p.shotsFired;}
   if((p.hitTimer||0)>oldDamage[i])fx.burst(g.position.x,h+.9,-d,'#9eefff',18);oldDamage[i]=p.hitTimer||0;
   if((p.landings||0)>oldLandings[i]){fx.burst(g.position.x,h+.15,-d,'#ffe2a5',14);oldLandings[i]=p.landings;}
   if(p.drifting&&!p.airborne&&!p.water&&Math.floor(time*30)%2===0)fx.burst(g.position.x,h+.2,-d+1.3,p.driftCharge>.65?'#7effe2':'#ffc579',1);
  });
  const nearby=(items:any[],position:(a:any)=>number,max:number)=>items.filter(a=>position(a)>view.y-700&&position(a)<view.y+3600).sort((a,b)=>Math.abs(position(a)-view.y)-Math.abs(position(b)-view.y)).slice(0,max);
  const vehicles=nearby(state.traffic,(v)=>v.distance+v.speed*state.elapsed,traffic.length);
  const visibleIds=new Set(vehicles.map(v=>v.id));
  traffic.forEach(g=>{if(!visibleIds.has(g.userData.trafficId)){g.userData.trafficId=null;g.visible=false;}});
  for(const item of vehicles){
   const g=traffic.find(g=>g.userData.trafficId===item.id)||traffic.find(g=>g.userData.trafficId===null&&g.userData.trafficModel===item.model)||traffic.find(g=>g.userData.trafficId===null);if(!g)continue;
   g.userData.trafficId=item.id;g.visible=true;const d=(item.distance+item.speed*state.elapsed)/10,hit=Math.max(0,(item.hitUntil||0)-state.elapsed);
   g.position.set(roadCenter(d)+W(raceTrafficX(item,d))+(hit?Math.sin(hit*7)*item.hitDir*.45:0),roadHeight(d)+.06,-d);g.rotation.set(0,heading(d)+(hit?item.hitDir*hit*.2:0),0);g.rotateZ(Math.atan(roadGrade(d)));for(const w of g.userData.wheels||[])w.rotation.z-=item.speed*dt*.055;
  }
  const rewards=nearby(state.pickups.filter((item:any)=>!view.collected.includes(item.id)),i=>i.distance,coins.length);
  coins.forEach((g,i)=>{const item=rewards[i];g.visible=!!item;if(!item)return;const d=item.distance/10;g.position.set(roadCenter(d)+W(item.x),roadHeight(d)+1.05+Math.sin(time*3+i)*.12,-d);g.rotation.y=time*2.5;});
  const strips=nearby(state.boostPads,i=>i.distance,pads.length);
  pads.forEach((g,i)=>{const item=strips[i];g.visible=!!item;if(!item)return;const d=item.distance/10;g.position.set(roadCenter(d)+W(item.x),roadHeight(d)+.12+Math.sin(time*2+i)*.12,-d);g.rotation.y=time*.6;});
  const target=raceTarget(state.players,state.viewSeat??0);targetRing.visible=target>=0&&!state.finished;
  if(target>=0){const p=state.players[target],d=p.y/10;targetRing.position.set(roadCenter(d)+W(p.x),roadHeight(d)+.15,-d);targetRing.scale.setScalar(1+Math.sin(time*4)*.05);}
  bolts.forEach((g,i)=>{const shot=state.shots?.[i];g.visible=!!shot;if(!shot)return;const d=shot.y/10;g.position.set(roadCenter(d)+W(shot.x),roadHeight(d)+(shot.height||0)+.85,-d);g.rotation.y=-Math.atan(roadSlope(d)+shot.vx/shot.speed);});
  waterTexture.offset.x=time*.012;
  const water=raceWaterSections(distance-80,distance+360);
  crossings.forEach((r,i)=>{const w=water[i];r.mesh.visible=!!w;if(w)r.write(w.start,w.left,w.right,0,waterMat,w.end-w.start,()=>w.level);});
  sprayTime+=dt;
  if(sprayTime>.045){sprayTime=0;state.players.forEach((p:any)=>{if(p.airborne||(!p.water&&weather.wet<.2)||p.speed<30||Math.abs(p.y-view.y)>1500)return;const d=p.y/10,h=roadHeight(d);for(const side of [-1,1])spray.burst(roadCenter(d)+W(p.x)+side*.9,h+.14,-d+1.6,'#b7efff',p.water?4:1);});}
  rainMat.opacity=weather.rain*(reduceMotion?.15:.48);rain.visible=weather.rain>.01;
  if(rain.visible){for(let i=0;i<600;i++){const d=distance-10+noise(i+9)*100,x=roadCenter(d)+(noise(i+44)-.5)*65,y=roadHeight(d)+((noise(i+3)*33-time*(reduceMotion?8:30))%33+33)%33;rainPositions.set([x,y,-d,x+.32,y+1.6,-d+.5],i*6);}rainGeo.attributes.position.needsUpdate=true;}
  streakMat.opacity=T.MathUtils.lerp(streakMat.opacity,view.boosting&&!reduceMotion?.2:0,Math.min(1,dt*6));
  for(let i=0;i<32;i++){const d=distance+((i*7+time*90)%110)-12,x=roadCenter(d)+(i%2?1:-1)*(15+noise(i)*7),y=roadHeight(d)+1+noise(i+9)*4;streakPositions.set([x,y,-d,x,y,-d+3+noise(i)*5],i*6);}streakGeo.attributes.position.needsUpdate=true;
  fx.update(dt);spray.update(dt);
 };
}
