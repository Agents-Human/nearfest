import * as T from 'three';
import {bridgeScene,soccerScene,catsScene} from './social-scenes';
import type {SoccerAssets} from './soccer-assets';
import type {CatAssets} from './cat-assets';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {Kit,particles,random,animateExplorer} from './world-kit';
import {platformScene} from './platform-scene';
import {WorldSnapshots} from './world-snapshots.mjs';
export {Kit} from './world-kit';
import type {RacingAssets,RacingVehicle,RacingDebris} from './racing-assets';
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

function roadCenter(_d:number){return 0;}
function roadSlope(_d:number){return 0;}
// Models face +X locally. Increasing race distance moves down world -Z.
function raceHeading(distance:number,speed:number,lateral=0){return Math.atan2(Math.max(.01,speed),roadSlope(distance)*speed+lateral);}
function raceScene(k:Kit,s:State,assets?:RacingAssets,scenery?:SceneryAssets):Step{
 k.sky('#1e88e5','#bbdefb');k.scene.fog=new T.Fog('#cfe8fc',135,340);
 const water=k.surface(2200,2600,'#1976d2','water',-2.2);water.position.z=-450;

 // Build the entire 960m course using actual 3D road & track tiles from kenney_city-kit-roads and kenney_racing-kit
 for(let d=-32;d<=960;d+=32){
  const isStart=d<=0;
  const isSuburbs=d>0&&d<320;
  const isDowntown=d>=320&&d<640;
  const isBridge=d===416||d===448||d===480;
  const isCrossroad=(isSuburbs&&(d===96||d===224))||(isDowntown&&(d===352||d===544));

  // Primary 3D highway / race track tile
  let roadTile:T.Group|null=null;
  let rotateRoad=false;
  if(isStart){
   roadTile=assets?.prop('road-start')||scenery?.prop('road-straight')||null;
   rotateRoad=!assets?.prop('road-start');
  }else if(isSuburbs){
   const subId=isCrossroad?'road-crossroad':d%64===0?'road-driveway-double':d===160?'road-crossing':'road-straight';
   roadTile=scenery?.prop(subId)||assets?.prop('road-race')||null;
   rotateRoad=Boolean(scenery?.prop(subId));
  }else if(isDowntown){
   const cityId=isBridge?'road-bridge':isCrossroad?'road-crossroad':'road-straight-barrier';
   roadTile=scenery?.prop(cityId)||assets?.prop('road-race-bridge')||null;
   rotateRoad=Boolean(scenery?.prop(cityId));
  }else{
   // Sector 3: Grand Prix Stadium Circuit (kenney_racing-kit 3D track tiles)
   const raceId=d>=896?'road-race-end':d===736?'road-race-bridge':d%96===0?'road-race-arrow':d%64===0?'road-race-pit':'road-race';
   roadTile=assets?.prop(raceId)||scenery?.prop('road-straight')||null;
   rotateRoad=!assets?.prop(raceId);
  }
  if(roadTile){
   if(rotateRoad)roadTile.rotation.y=Math.PI/2;
   k.add(roadTile,0,0,-d);
  }else{
   k.box(28,.08,32,'#4a525d',0,0,-d);
  }

  // 3D ground tiles on both sides of the road (tile-low for city blocks, grass-tile for suburbs & stadium)
  for(const side of [-1,1]){
   const lotTile=isDowntown?scenery?.prop('tile-low'):assets?.prop('grass-tile')||scenery?.prop('tile-low');
   if(lotTile){
    k.add(lotTile,side*32,-.02,-d);
   }
   const outerTile=assets?.prop('grass-tile')||scenery?.prop('tile-low');
   if(outerTile){
    k.add(outerTile,side*64,-.04,-d);
   }
  }

  // Branching 3D side streets & hanging traffic lights at intersections
  if(isCrossroad){
   for(const side of [-1,1]){
    const branch1=scenery?.prop('road-straight');
    if(branch1)k.add(branch1,side*32,.01,-d);
    const branch2=scenery?.prop('road-straight');
    if(branch2)k.add(branch2,side*64,.01,-d);
    const tLight=scenery?.prop('traffic-light-hanging');
    if(tLight){
     tLight.rotation.y=side<0?0:Math.PI;
     k.add(tLight,side*14.2,0,-d-12);
    }
   }
  }

  // Bridge support pillars and guardrails on overpass sections
  if(isBridge){
   for(const side of [-14.5,14.5]){
    const pillar=scenery?.prop('bridge-pillar-wide')||scenery?.prop('bridge-pillar');
    if(pillar)k.add(pillar,side,-13.8,-d);
   }
  }
 }

 // SECTOR 1 (0m-300m): Coastal Suburban Boulevard (kenney_city-kit-suburban_20 on BOTH sides)
 const houseIds=['house-a','house-b','house-d','house-h','house-q'];
 for(let d=16;d<305;d+=32){
  if(d===96||d===224)continue; // Leave crossroad intersections open
  const idx=Math.floor(d/32);
  for(const side of [-1,1]){
   const house=scenery?.prop(houseIds[(idx+(side>0?2:0))%houseIds.length]);
   if(house){
    house.rotation.y=side<0?Math.PI/2:-Math.PI/2;
    k.add(house,side*25,0,-d);
   }
   const planter=scenery?.prop('planter');
   if(planter)k.add(planter,side*18.5,0,-d-5);
   const fence=scenery?.prop('fence');
   if(fence){
    fence.rotation.y=Math.PI/2;
    k.add(fence,side*17.2,0,-d+8);
   }
   const treeProp=scenery?.prop((idx+side)%2===0?'tree-large':'city-tree')||assets?.prop('race-tree-large');
   if(treeProp)k.add(treeProp,side*21,0,-d-12);
   const backTree=assets?.prop(idx%2===0?'race-tree-large':'race-tree-small');
   if(backTree)k.add(backTree,side*38,0,-d+6);
  }
  if(idx%2===0){
   const parasol=scenery?.prop('detail-parasol-a');
   if(parasol)k.add(parasol,20,0,-d+3);
  }
  const subLight=scenery?.prop('light-square-double')||assets?.prop('lamp');
  if(subLight){
   subLight.rotation.y=Math.PI/2;
   k.add(subLight,-14.2,0,-d);
  }
 }

 // SECTOR 2 (310m-620m): Downtown Commercial Skyline & Highway Overpass (kenney_city-kit-commercial_2.1 & kenney_city-kit-roads)
 const towerIds=['building-skyscraper-a','building-skyscraper-b','building-skyscraper-c'];
 const shopIds=['building-a','building-c','building-f'];
 for(let d=320;d<625;d+=32){
  const idx=Math.floor((d-320)/32);
  for(const side of [-1,1]){
   if(d!==352&&d!==544){
    // Front row commercial buildings & skyscrapers framing the highway
    const frontId=idx%2===0?towerIds[(idx+(side>0?1:0))%towerIds.length]:shopIds[(idx+(side>0?1:0))%shopIds.length];
    const frontBldg=scenery?.prop(frontId);
    if(frontBldg){
     frontBldg.rotation.y=side<0?Math.PI/2:-Math.PI/2;
     k.add(frontBldg,side*26,0,-d);
    }
   }
   // Second row towering skyscrapers for a dense downtown skyline
   const backTower=scenery?.prop(towerIds[(idx+(side>0?2:1))%towerIds.length]);
   if(backTower){
    backTower.rotation.y=side<0?Math.PI/2:-Math.PI/2;
    k.add(backTower,side*44,0,-d-12);
   }
   // Highway double streetlights along both curbs
   const hwyLamp=scenery?.prop('light-curved-double');
   if(hwyLamp){
    hwyLamp.rotation.y=side<0?Math.PI/2:-Math.PI/2;
    k.add(hwyLamp,side*14.4,0,-d-8);
   }
  }
  // Overhead 3D Highway Sign Gantries spanning across the road
  if(d===320||d===448||d===576){
   const hwySign=scenery?.prop(d===448?'sign-highway-wide':'sign-highway-detailed');
   if(hwySign){
    hwySign.rotation.y=Math.PI/2;
    k.add(hwySign,0,0,-d);
   }
  }
 }

 // SECTOR 3 (630m-930m): Grand Prix Stadium Circuit (kenney_racing-kit)
 if(assets){
  for(let d=640;d<=928;d+=32){
   const idx=Math.floor((d-640)/32);
   for(const side of [-1,1]){
    // Continuous double guardrails & catch fences along track edges
    const rail=assets.prop('rail');
    if(rail){
     rail.scale.x=32/6;
     rail.rotation.y=side<0?-Math.PI/2:Math.PI/2;
     k.add(rail,side*14.5,0,-d);
    }
    const fence=assets.prop('fence-straight');
    if(fence){
     fence.rotation.y=side<0?Math.PI/2:-Math.PI/2;
     k.add(fence,side*16.2,0,-d);
    }
    // Red & white racing barriers along the chicane aprons
    const bWall=assets.prop((idx+side)%2===0?'barrier':'barrier-white');
    if(bWall){
     bWall.rotation.y=Math.PI/2;
     k.add(bWall,side*13.8,0,-d-10);
    }
    // Covered Grandstands, Pit Garages, Pit Offices, and Team Tents on both sides
    if(idx%2===0){
     const stand=assets.prop(idx%4===0?'grandstand':'grandstand-awning');
     if(stand){
      stand.scale.setScalar(1.35);
      stand.rotation.y=side<0?Math.PI/2:-Math.PI/2;
      k.add(stand,side*25,0,-d);
     }
    }else{
     const pit=assets.prop(side<0?'garage':'pits-office');
     if(pit){
      pit.rotation.y=side<0?Math.PI/2:-Math.PI/2;
      k.add(pit,side*24,0,-d);
     }
     const tent=assets.prop('tent');
     if(tent){
      tent.rotation.y=side<0?Math.PI/2:-Math.PI/2;
      k.add(tent,side*22,0,-d-12);
     }
    }
    // Stadium floodlights, banner towers, billboards & trees
    const flood=assets.prop('light-large');
    if(flood){
     flood.rotation.y=side<0?Math.PI/2:-Math.PI/2;
     k.add(flood,side*15.5,0,-d-14);
    }
    const banner=assets.prop(side<0?'banner-red':'banner-green');
    if(banner)k.add(banner,side*17.5,0,-d+6);
    if(idx%3===0){
     const board=assets.prop('billboard');
     if(board){
      board.rotation.y=side<0?Math.PI/4:-Math.PI/4;
      k.add(board,side*20,0,-d+12);
     }
    }
    const rTree=assets.prop(idx%2===0?'race-tree-large':'race-tree-small');
    if(rTree)k.add(rTree,side*36,0,-d);
   }
  }
  // Major Start, Sector Transition & Finish Line Gantries / Archways
  for(const d of [-10,305,625,900]){
   const gantry=assets.prop(d===305||d===625?'archway':'gantry');
   if(gantry){
    gantry.scale.set(2.9,1.75,1.2);
    k.add(gantry,0,0,-d);
   }
   for(const dx of [-14.5,14.5]){
    const flag=assets.prop(d===900||d===-10?'flag':dx<0?'banner-red':'banner-green');
    if(flag)k.add(flag,dx,0,-d-2);
   }
  }
 }

 // Turbo Boost Strips on the track (placed in k.dynamic so k.batch() preserves their animated glow)
 const arrowTex=assets?.sprite('arrow_yellow');
 const boostPadMeshes=(s.boostPads||[]).map((pad:any)=>{
  const g=new T.Group(),d=pad.distance/10,wx=W(pad.x);
  for(const zOff of [-1.8,0,1.8]){
   if(arrowTex){
    const mat=new T.MeshBasicMaterial({map:arrowTex,transparent:true,depthWrite:false,color:'#ffea00'});
    const plane=new T.Mesh(new T.PlaneGeometry(2.8,1.8),mat);
    plane.rotation.x=-Math.PI/2;plane.position.set(0,.12,zOff);g.add(plane);
   }
  }
  for(const side of [-1.55,1.55]){
   const rail=k.box(.18,.08,5.4,'#00e5ff',side,.09,0,g);
   (rail.material as T.MeshStandardMaterial).emissive=new T.Color('#00b0ff');
   (rail.material as T.MeshStandardMaterial).emissiveIntensity=1.2;
  }
  return k.add(g,wx,0,-d,k.dynamic);
 });

 const fx=particles(k);
 const carRoster:RacingVehicle[]=['race','race-future','sedan-sports','hatchback-sports','suv-luxury'];
 const carColors=['#e63946','#00b4d8','#2ec4b6','#ffbe0b','#8338ec'];
 const cars=s.players.map((p:any,i:number)=>{
  const rawVariant=p?.kart as string|undefined;
  const variant=(rawVariant&&!rawVariant.startsWith('kart-')?rawVariant:carRoster[i%carRoster.length]) as RacingVehicle;
  const cColor=carColors[i%carColors.length];
  return k.add(assets?.vehicle(cColor,variant)||car(cColor),0,0,0,k.dynamic);
 });
 const flames=cars.map((g:T.Group)=>{
  const pair=new T.Group();g.add(pair);
  for(const zOff of [-.48,.48]){
   const outer=k.mesh(new T.ConeGeometry(.28,2.2,10),new T.MeshBasicMaterial({color:'#ff6d00'}),pair,-2.25,.45,zOff);
   outer.rotation.z=Math.PI/2;
   const inner=k.mesh(new T.ConeGeometry(.16,1.5,8),new T.MeshBasicMaterial({color:'#00e5ff'}),pair,-2.0,.45,zOff);
   inner.rotation.z=Math.PI/2;
  }
  return pair;
 });
 // Traffic vehicles & track chicanes (police, taxi, ambulance, firetruck, sports cars, tire stacks, barriers)
 const traffic=s.traffic.map((item:any,i:number)=>{
  let g:T.Group;
  const modelId=item.model||(item.kind==='barrier'?'barrier':(['police','taxi','sedan-sports','ambulance','suv','delivery','firetruck','truck','van'] as const)[i%9]);
  if(item.kind==='car'){
   const vId=(['police','taxi','sedan-sports','ambulance','suv','delivery','firetruck','truck','van','sedan','tractor','race-future','hatchback-sports','suv-luxury'].includes(modelId)?modelId:'sedan-sports') as RacingVehicle;
   const paint=['#f8f9fa','#3a86ff','#ffbe0b','#fb5607'][i%4];
   g=assets?.vehicle(paint,vId)||car(paint);
   if(['police','ambulance','firetruck'].includes(vId)){
    const siren=new T.Group();
    const rLight=k.box(.28,.18,.38,'#ff2a4b',0,1.95,-.35,siren);
    const bLight=k.box(.28,.18,.38,'#2979ff',0,1.95,.35,siren);
    (rLight.material as T.MeshStandardMaterial).emissive=new T.Color('#ff1744');
    (bLight.material as T.MeshStandardMaterial).emissive=new T.Color('#00b0ff');
    g.add(siren);g.userData.siren={rLight,bLight};
   }
  }else if(modelId==='tires'||modelId==='barrel'){
   g=new T.Group();
   const deb=assets?.debris(modelId==='tires'?'debris-tire':'box');
   if(deb){
    for(const [dx,dy,dz] of [[-.7,0,0],[.7,0,0],[0,.85,0]]){const c=deb.clone();c.position.set(dx,dy,dz);g.add(c);}
   }else{
    const bMat=scenery?.prop('construction-barrier');
    if(bMat)g.add(bMat);
   }
  }else if(scenery?.prop('construction-barrier')&&i%2===0){
   g=scenery.prop('construction-barrier')!;
  }else if(assets?.propIds.includes('barrier')){
   g=assets.prop(i%3===0?'barrier-white':'barrier')!;
   const size=new T.Box3().setFromObject(g).getSize(new T.Vector3());
   g.scale.multiplyScalar(4.4/Math.max(.1,size.x));
  }else{
   g=new T.Group();
  }
  return k.add(g,0,0,0,k.dynamic);
 });
 const pickups=s.pickups.map(()=>k.add(coin(),0,0,0,k.dynamic));
 // Crash debris & fiery explosion pool
 const smoothLat=s.players.map(()=>0);
 const smoothSteer=s.players.map(()=>0);
 const prevCrashes=s.players.map((p:any)=>p.crashes||0);
 type FlyingDebris={mesh:T.Group;vx:number;vy:number;vz:number;rx:number;ry:number;rz:number;life:number};
 type CrashBoom={sprite:T.Sprite;mat:T.SpriteMaterial;age:number};
 const activeDebris:FlyingDebris[]=[];
 const activeBooms:CrashBoom[]=[];
 const debrisTypes:RacingDebris[]=['debris-tire','debris-bumper','debris-spoiler-a','debris-door','box'];
 const spawnCrashFX=(wx:number,wy:number,wz:number)=>{
  fx.burst(wx,wy+.8,wz,'#ff6d00',22);
  if(assets?.explosionFrames.length){
   const mat=new T.SpriteMaterial({map:assets.explosionFrames[0],transparent:true,depthWrite:false});
   const sp=new T.Sprite(mat);sp.position.set(wx,wy+1.6,wz);sp.scale.set(4.8,4.8,1);
   k.dynamic.add(sp);activeBooms.push({sprite:sp,mat,age:0});
  }
  for(let m=0;m<6;m++){
   const dKind=debrisTypes[m%debrisTypes.length];
   const piece=assets?.debris(dKind);
   if(!piece)continue;
   piece.position.set(wx+(Math.random()-.5)*1.5,wy+.7,wz+(Math.random()-.5)*1.5);
   k.dynamic.add(piece);
   const ang=Math.random()*Math.PI*2,spd=4.5+Math.random()*7.5;
   activeDebris.push({
    mesh:piece,
    vx:Math.cos(ang)*spd,
    vy:7+Math.random()*6,
    vz:Math.sin(ang)*spd-4,
    rx:(Math.random()-.5)*15,
    ry:(Math.random()-.5)*15,
    rz:(Math.random()-.5)*15,
    life:1.4,
   });
  }
 };
 return (state,dt,t)=>{
  const viewer=state.players[state.viewSeat??0];
  state.players.forEach((p:any,i:number)=>{
   const d=p.y/10,g=cars[i],wx=W(p.x),wz=-d;
   if((p.crashes||0)>prevCrashes[i]){
    prevCrashes[i]=p.crashes;
    spawnCrashFX(wx,.2,wz);
   }
   const rawLat=typeof p.vx==='number'?p.vx:(p.heading/.22)*235;
   const blocked=(p.x<=350&&rawLat<0)||(p.x>=610&&rawLat>0);
   const targetLat=blocked?0:rawLat;
   smoothLat[i]=T.MathUtils.lerp(smoothLat[i],targetLat,Math.min(1,dt*14));
   const targetSteer=typeof p.steer==='number'?p.steer:clamp(rawLat/235,-1,1);
   smoothSteer[i]=T.MathUtils.lerp(smoothSteer[i],targetSteer,Math.min(1,dt*16));
   const crashSpin=(p.crashTimer||0)>0?Math.sin(p.crashTimer*Math.PI*6)*.85:0;
   const hop=(p.boosting?Math.abs(Math.sin(t*28))*.05:0)+((p.crashTimer||0)>0?Math.abs(Math.sin(t*22))*.32:0);
   g.position.set(wx,.14+hop,wz);
   g.rotation.y=raceHeading(d,Math.max(60,p.speed),smoothLat[i])+crashSpin;
   g.rotation.z=-smoothSteer[i]*.12+(crashSpin*.25);
   g.rotation.x=p.boosting?-.035:0;
   if(Math.abs(smoothSteer[i])>.55&&p.speed>195&&Math.random()<.35){
    fx.burst(wx-smoothSteer[i]*.8,.18,wz+1.6,'#ffbe0b',2);
   }
   g.visible=(p.invulnerable<=0||(p.crashTimer||0)>0||Math.floor(t*14)%2===0)&&(i===(state.viewSeat??0)||Math.abs(p.y-viewer.y)>36||Math.abs(p.x-viewer.x)>22);
   for(const wheel of g.userData.wheels||[])wheel.rotation.z-=p.speed*dt*.085;
   for(const fWheel of g.userData.frontWheels||[])fWheel.rotation.y=-smoothSteer[i]*.42;
   flames[i].visible=Boolean(p.boosting||(p.drift||0)>.55);
   flames[i].scale.setScalar(1+Math.sin(t*55)*.18);
  });
  traffic.forEach((g:any,i:number)=>{
   const item=state.traffic[i],curDist=item.distance+item.speed*state.elapsed,d=curDist/10;
   const hitRemaining=Math.max(0,(item.hitUntil||0)-state.elapsed);
   const hitPush=hitRemaining>0?(item.hitDir||1)*(1-hitRemaining/.85)*2.6:0;
   g.position.set(W(item.x)+hitPush,.14+(hitRemaining>0?Math.sin(hitRemaining*18)*.35:0),-d);
   const baseYaw=item.kind==='car'?raceHeading(d,Math.max(1,item.speed)):0;
   g.rotation.y=baseYaw+(hitRemaining>0?(item.hitDir||1)*(1-hitRemaining/.85)*2.2:0);
   g.rotation.z=hitRemaining>0?Math.sin(t*25)*.28:0;
   g.visible=Math.abs(curDist-viewer.y)<2200;
   if(g.userData.siren){
    const flash=Math.floor(t*10)%2===0;
    (g.userData.siren.rLight.material as T.MeshStandardMaterial).emissiveIntensity=flash?2.4:.15;
    (g.userData.siren.bLight.material as T.MeshStandardMaterial).emissiveIntensity=flash?.15:2.4;
   }
  });
  boostPadMeshes.forEach((g:T.Group,i:number)=>{
   const pad=state.boostPads?.[i];if(!pad)return;
   g.visible=Math.abs(pad.distance-viewer.y)<2000;
  });
  pickups.forEach((g:any,i:number)=>{
   const item=state.pickups[i],d=item.distance/10;
   const visible=!viewer.collected.includes(item.id)&&Math.abs(item.distance-viewer.y)<1800;
   if(g.visible&&!visible&&viewer.collected.includes(item.id))fx.burst(g.position.x,g.position.y,g.position.z);
   g.visible=visible;
   g.position.set(W(item.x),1.5+Math.sin(t*3+i)*.2,-d);
   g.rotation.y=t*2.4;g.scale.setScalar(1.5);
  });
  for(let i=activeDebris.length-1;i>=0;i--){
   const deb=activeDebris[i];deb.life-=dt;
   if(deb.life<=0){k.dynamic.remove(deb.mesh);activeDebris.splice(i,1);continue;}
   deb.vy-=22*dt;
   deb.mesh.position.x+=deb.vx*dt;
   deb.mesh.position.y+=deb.vy*dt;
   deb.mesh.position.z+=deb.vz*dt;
   if(deb.mesh.position.y<.2){deb.mesh.position.y=.2;deb.vy=Math.abs(deb.vy)*.45;deb.vx*=.78;deb.vz*=.78;}
   deb.mesh.rotation.x+=deb.rx*dt;
   deb.mesh.rotation.y+=deb.ry*dt;
   deb.mesh.rotation.z+=deb.rz*dt;
  }
  for(let i=activeBooms.length-1;i>=0;i--){
   const b=activeBooms[i];b.age+=dt;
   if(b.age>=.45){k.dynamic.remove(b.sprite);b.mat.dispose();activeBooms.splice(i,1);continue;}
   const frames=assets?.explosionFrames||[];
   if(frames.length){
    const idx=Math.min(frames.length-1,Math.floor((b.age/.45)*frames.length));
    b.mat.map=frames[idx];
   }
   const sScale=4.5+b.age*8;
   b.sprite.scale.set(sScale,sScale,1);
   b.mat.opacity=1-(b.age/.45);
  }
  fx.update(dt);(water.material as T.MeshStandardMaterial).map!.offset.y=t*.005;
 };
}
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

export type WorldMetrics={fps:number;drawCalls:number;triangles:number;quality:string;frameP95:number;geometries:number;textures:number};
export class WorldRenderer {
 private k=new Kit();private environment:T.WebGLRenderTarget;private renderer:T.WebGLRenderer;private camera=new T.PerspectiveCamera(42,1,.1,1000);private fighterCamera:T.OrthographicCamera|null=null;private step:Step;
 private aim=0;private power=.65;private guide:T.Line|null=null;private frame=0;private last=0;private samples=0;private frameTimes:number[]=[];private sampleAt=0;private elapsed=0;private look=new T.Vector3();private cameraReady=false;private snapshots=new WorldSnapshots();private target=new T.Vector3();private eye=new T.Vector3();private resize:ResizeObserver;
 private shadowOffset=new T.Vector3(-25,65,30);private shadowRight=new T.Vector3(30,0,25).normalize();private shadowUp=new T.Vector3().crossVectors(this.shadowOffset,this.shadowRight).normalize();
 private mode='follow';private seat:number|null;private game:string;private sun:T.DirectionalLight;private visible=true;private observer:IntersectionObserver;private ratio=1;private framesLow=0;private disposed=false;
 constructor(private host:HTMLElement,state:State,seat:number|null,private metrics:(m:WorldMetrics)=>void,assets:WorldAssets={}){
  this.seat=seat;this.game=state.game;this.host.dataset.assetPack=state.game==='stick-rivals'?'craftpix-yokai':state.game==='cat-defense'?'craftpix-cat-defense':Object.keys(assets).length?'kenney':'original';if(['stick-rivals','cat-defense','bridge-builders','pocket-soccer'].includes(state.game))this.fighterCamera=new T.OrthographicCamera(-35,35,20,-20,.1,200);this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});const environment=new RoomEnvironment(),pmrem=new T.PMREMGenerator(this.renderer);this.environment=pmrem.fromScene(environment,.04);this.k.scene.environment=this.environment.texture;this.k.scene.environmentIntensity=['air-hockey','paddle-duel','orbit-rescue'].includes(state.game)?.55:.3;environment.dispose();pmrem.dispose();this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.95;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;this.ratio=Math.min(devicePixelRatio,1.6);this.renderer.setPixelRatio(this.ratio);host.appendChild(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label',state.game==='stick-rivals'?'Animated Yokai fighting arena':state.game==='cat-defense'?'Cat Defense street battle':state.game==='pocket-soccer'?'3D soccer stadium':state.game==='bridge-builders'?'3D bridge ravine':'3D game environment');this.sun=this.k.light(['pocket-soccer','air-hockey','paddle-duel','orbit-rescue'].includes(this.game));
  const scenes:Record<string,(k:Kit,s:State)=>Step>={'bridge-builders':bridgeScene,'pocket-soccer':(kit,state)=>soccerScene(kit,state,assets.soccer!),'cat-defense':(kit,state)=>catsScene(kit,state,assets.cats!),'pocket-racers':(kit,state)=>raceScene(kit,state,assets.racing,assets.scenery),'platform-relay':(kit,state)=>platformScene(kit,state,assets.platform),'stick-rivals':(kit,state)=>fighterScene(kit,state,assets.fighters),'tank-arena':(kit,state)=>tankScene(kit,state,assets.action),'marble-run':(kit,state)=>marbleRunScene(kit,state,assets.action,assets.scenery),'paddle-duel':tableScene,'air-hockey':tableScene,'snake-arena':gridScene,'bomb-maze':gridScene,'mini-golf':(kit,state)=>golfScene(kit,state,assets.scenery,assets.golf),'marble-knockout':(kit,state)=>marbleScene(kit,state,assets.scenery),'paint-tag':paintScene,'kitchen-rush':(kit,state)=>kitchenScene(kit,state,assets.scenery),'orbit-rescue':(kit,state)=>spaceScene(kit,state,assets.scenery)};
  this.step=scenes[this.game](this.k,state);this.k.batch();if(this.game==='platform-relay'){this.step({...state,viewSeat:seat??0},0,0);this.camera.near=1;this.camera.far=800;}if(this.game==='mini-golf'){const geometry=new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]);this.guide=new T.Line(geometry,new T.LineDashedMaterial({color:'#fff2c4',dashSize:.6,gapSize:.4}));this.k.dynamic.add(this.guide);}this.push(state,seat);
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
 aimAt(clientX:number,clientY:number){if(this.game!=='mini-golf')return null;const rect=this.host.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2),this.camera);const point=ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-.55),new T.Vector3());if(!point)return null;const s=this.snapshots.latest,p=s.players[this.seat??0],dx=(point.x-W(p.x))*10,dy=(point.z-Z(p.y))*10;return {angle:Math.atan2(dy,dx),power:clamp(Math.hypot(dx,dy)*1.15/420,.05,1)};}
 setAim(angle:number,power:number){this.aim=angle;this.power=power;}
 setCamera(mode:string){this.mode=mode;this.cameraReady=false;}
 /** Snap the moving light in shadow-texel space so surfaces do not shimmer. */
 private platformLight(x:number){
  const target=this.sun.target.position,camera=this.sun.shadow.camera,size=this.sun.shadow.mapSize;
  target.set(x,0,0);
  const tx=(camera.right-camera.left)/size.x,ty=(camera.top-camera.bottom)/size.y;
  const u=target.dot(this.shadowRight),v=target.dot(this.shadowUp);
  target.addScaledVector(this.shadowRight,Math.round(u/tx)*tx-u).addScaledVector(this.shadowUp,Math.round(v/ty)*ty-v);
  this.sun.position.copy(target).add(this.shadowOffset);
 }
 private size(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;const canvas=this.renderer.domElement;if(canvas.width!==Math.floor(w*this.ratio)||canvas.height!==Math.floor(h*this.ratio))this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
 push(s:State,seat:number|null){this.seat=seat;this.snapshots.push(s,performance.now());}
 private draw=(now:number)=>{
  if(this.disposed)return;this.frame=requestAnimationFrame(this.draw);const frameMs=now-(this.last||now),dt=Math.min(.05,frameMs/1000);this.last=now;if(document.hidden||!this.visible){this.sampleAt=now;this.samples=0;this.frameTimes=[];return;}this.elapsed+=dt;if(frameMs>0)this.frameTimes.push(frameMs);
  const s=this.snapshots.sample(now),p=s.players[this.seat??0],target=this.target,eye=this.eye;this.step({...s,viewSeat:this.seat??0},dt,this.elapsed);
  if(this.game==='pocket-racers'){const d=p.y/10,x=roadCenter(d)+W(p.x),z=-d,shake=(p.crashTimer||0)>0?Math.sin(now*.065)*.45:0;target.set(roadCenter(d+8)+W(p.x)*.82+shake,1.4+Math.abs(shake)*.4,z-9);eye.set((this.mode==='follow'?x:roadCenter(d)+30)+shake*.6,this.mode==='follow'?(this.camera.aspect<1?7.4:4.6):42,z+(this.mode==='follow'?(this.camera.aspect<1?12.5:8.4):25));this.camera.fov=T.MathUtils.lerp(this.camera.fov,p.boosting?62:51,Math.min(1,dt*4));this.sun.position.set(roadCenter(d)-35,65,z+30);this.sun.target.position.set(roadCenter(d),0,z-15);}
  else if(this.game==='marble-run'){const x=p.x/10;target.set(x+10,1,0);eye.set(x-17,this.camera.aspect<1?17:12,this.camera.aspect<1?24:18);this.camera.fov=48;this.sun.position.set(x-30,65,35);this.sun.target.position.set(x+20,0,0);}
  else if(this.game==='platform-relay'){const x=Math.max(22,p.x/10+10),y=clamp((370-p.y)/10,0,10);target.set(x,y+3,0);eye.set(x+2,y+12,this.camera.aspect<1?65:46);this.camera.fov=43;this.platformLight(x);}

  else if(this.game==='cat-defense'||this.game==='bridge-builders'||this.game==='pocket-soccer'){
   const fc=this.fighterCamera!,aspect=this.camera.aspect;
   const bridge=this.game==='bridge-builders',soccer=this.game==='pocket-soccer';
   const height=bridge?Math.max(36,((s.to.x+s.to.w-s.from.x)/10+13)/aspect,(s.to.x+s.to.w/2-s.from.x-s.from.w)/10*1.65+4):soccer?Math.max(67,108/aspect):Math.max(47.6,96/aspect),width=height*aspect;
   const x=bridge?(s.from.x+s.to.x+s.to.w)/20:0,y=bridge?height*.22:0;
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
  this.renderer.render(this.k.scene,this.fighterCamera||this.camera);this.samples++;if(now-this.sampleAt>1100){const fps=Math.round(this.samples*1000/(now-this.sampleAt));if(this.sampleAt>0){this.metrics({fps,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,quality:this.ratio<1.3?'Performance':'High',frameP95:this.frameTimes.sort((a,b)=>a-b)[Math.floor(this.frameTimes.length*.95)]||0,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures});this.host.dataset.fps=String(fps);this.host.dataset.drawCalls=String(this.renderer.info.render.calls);if(fps<43)this.framesLow++;else this.framesLow=0;if(this.framesLow>=3&&this.ratio>1){this.ratio=Math.max(1,this.ratio-.25);this.renderer.setPixelRatio(this.ratio);this.framesLow=0;}}this.samples=0;this.frameTimes=[];this.sampleAt=now;}
 };
 dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.resize.disconnect();this.observer.disconnect();this.k.dispose();this.environment.dispose();this.renderer.dispose();this.renderer.domElement.remove();}
}
