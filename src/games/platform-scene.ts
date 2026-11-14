import * as T from 'three';
import {Kit,particles,random,animateExplorer} from './world-kit';
import {explorer,tree,coin,island,sign} from './world-models';
import type {PlatformAssets} from './platform-assets';
import {createPlatformStorm} from './platform-storm';
import {createPlatformMountains} from './platform-mountains';
import {PlatformLifeFeedback} from './platform-life-feedback';
import {platformCharacter,PLATFORM_TINTS} from '../../shared/platform-options.mjs';
type State=any;
type Step=(s:State,dt:number,time:number)=>void;
const clamp=T.MathUtils.clamp;

/** Flying sprites are centred on their collision body; walkers are foot-anchored. */
export const platformEnemyY=(enemy:any)=>(460-enemy.y-(enemy.flying||enemy.kind==='fish'||enemy.kind==='piranha'?0:20))/10;

const platformBiomes:Record<string,{label:string;skyTop:string;skyBottom:string;fog:string;water:string;sign:string}>={
 grove:{label:'EMERALD GROVE',skyTop:'#5294c7',skyBottom:'#d2ebdc',fog:'#b3d4cf',water:'#49b6c9',sign:'#23594f'},
 frost:{label:'FROSTBITE PEAKS',skyTop:'#3b5998',skyBottom:'#cbe3f5',fog:'#b8d0e8',water:'#3a89b5',sign:'#26466d'},
 tropics:{label:'SUNBAKED ATOLL',skyTop:'#d96b43',skyBottom:'#f7d29c',fog:'#e8c39b',water:'#2ec4b6',sign:'#7a3e26'},
 canopy:{label:'TWILIGHT CANOPY',skyTop:'#3a2459',skyBottom:'#b86b8f',fog:'#835879',water:'#2b8a7e',sign:'#3d2352'},
 volcano:{label:'VOLCANIC CITADEL',skyTop:'#2b1118',skyBottom:'#c94a29',fog:'#8f3929',water:'#e0533c',sign:'#5c1d18'},
};
export function platformScene(k:Kit,s:State,assets?:PlatformAssets):Step{
 const sky=k.sky('#5294c7','#d2ebdc'),fog=new T.Fog('#b3d4cf',90,235);k.scene.fog=fog;const water=k.surface(1100,700,'#278fa4','water',-6);water.position.x=200;k.dynamic.add(water);water.castShadow=false;
 const skyMat=sky.material as T.ShaderMaterial,waterMat=water.material as T.MeshStandardMaterial,targetTop=new T.Color(),targetBottom=new T.Color(),targetFog=new T.Color(),targetWater=new T.Color();
 const stormSky=new T.Color('#34485d'),stormHorizon=new T.Color('#8196a4'),stormWater=new T.Color('#376d81');
 const sunlight=k.scene.children.find(o=>o instanceof T.DirectionalLight&&o.castShadow) as T.DirectionalLight|undefined;
 // The scenery moves with the visible part of the endless shared course.
 const backdrop=new T.Group();k.dynamic.add(backdrop);
 const mountains=createPlatformMountains();k.dynamic.add(mountains.root);
 for(let i=0;i<20;i++){
  const x=-120+i*22,y=18+random(i)*15,z=-35-random(i+9)*25;
  const cloudSprite=assets?.bgElement(['cloud1','cloud2','cloud3'][i%3]);
  if(cloudSprite){cloudSprite.scale.setScalar(1.3+random(i)*.6);k.add(cloudSprite,x,y,z,backdrop);}
  else for(let j=0;j<4;j++){const puff=k.sphere(2.8+random(j+i)*2,'#f2f2e9',x+j*3,y+random(j)*1.5,z,backdrop);puff.scale.y=.45;}
 }
 const celestial=assets?.bgElement('sun');if(celestial){celestial.scale.setScalar(1.8);k.add(celestial,48,34,-68,backdrop);}
 const moonSprite=assets?.bgElement('moonFull');if(moonSprite){moonSprite.scale.setScalar(1.5);k.add(moonSprite,-38,32,-70,backdrop);}
 k.batch(backdrop);backdrop.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=o.receiveShadow=false;});
 const fx=particles(k);const chunks=new Map<number,T.Group>(),gems=new Map<number,T.Group>(),hazards=new Map<number,T.Group>(),springs=new Map<number,T.Group>(),shots=new Map<number,T.Group>(),activeExplosions:T.Group[]=[],enemies=new Map<number,{g:T.Group;submerged?:boolean;ring?:T.Mesh}>();
 const spawnExplosion=(x:number,y:number,z:number)=>{if(!assets)return;const exp=assets.explosionEffect();exp.position.set(x,y,z);k.dynamic.add(exp);activeExplosions.push(exp);};
 const retire=(g:T.Group)=>{if(g.userData.disposeAnimations)g.userData.disposeAnimations();const owned=new Set<T.Material>(),shared=new Set(k.mats.values());g.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])if(!shared.has(m))owned.add(m);}});for(const m of owned){for(const value of Object.values(m))if(value instanceof T.Texture&&!k.textures.includes(value))value.dispose();m.dispose();}g.removeFromParent();};
 const crew=s.players.map((p:any,i:number)=>{const color=platformCharacter(p.character,i),g=assets?.character(color)||explorer(PLATFORM_TINTS[color]);if(!assets)g.scale.setScalar(.85);if(g.userData.disposeAnimations)k.cleanups.push(g.userData.disposeAnimations);return k.add(g,0,0,i*.8,k.dynamic);});
 const markers=s.players.map((p:any,i:number)=>k.ring(1.1,.08,PLATFORM_TINTS[platformCharacter(p.character,i)],0,0,0,k.dynamic));
 const shields=s.players.map(()=>{const shield=k.mesh(new T.SphereGeometry(2.8,16,10),new T.MeshBasicMaterial({color:'#8fe7ef',transparent:true,opacity:.14,depthWrite:false}),k.dynamic);shield.castShadow=shield.receiveShadow=false;shield.visible=false;return shield;});
 const lastBounced=s.players.map(()=>0);
 const lifeFeedback=s.players.map((p:any)=>new PlatformLifeFeedback(p));
 const shotPool:T.Group[]=[];
 // Pooled projectiles stay attached (invisible), so scene disposal owns them too.
 k.cleanups.push(()=>{for(const g of [...shots.values(),...shotPool,...activeExplosions,...[...enemies.values()].map(e=>e.g)])g.userData.disposeAnimations?.();});
 const storm=createPlatformStorm();k.dynamic.add(storm.root);k.cleanups.push(()=>storm.dispose());
 return (state,dt,t)=>{
  const viewer=state.players[state.viewSeat??0],px=viewer.x/10;backdrop.position.x=px*.8;water.position.x=px;storm.update(t,state.stormX,viewer.x);
  const activePlatform=state.platforms.filter((p:any)=>p.x<=viewer.x).at(-1)||state.platforms[0];
  const biomeKey=activePlatform?.biome||state.biome||'grove',theme=platformBiomes[biomeKey]||platformBiomes.grove;
  const weather=clamp(1-(viewer.x-state.stormX)/400,0,1);
  const blendRate=Math.min(1,dt*2.4);
  mountains.update(px,weather,dt);
  skyMat.uniforms.top.value.lerp(targetTop.set(theme.skyTop).lerp(stormSky,weather*.7),blendRate);
  skyMat.uniforms.bottom.value.lerp(targetBottom.set(theme.skyBottom).lerp(stormHorizon,weather*.55),blendRate);
  fog.color.lerp(targetFog.set(theme.fog).lerp(stormHorizon,weather*.6),blendRate);
  if(k.scene.background instanceof T.Color)k.scene.background.lerp(targetBottom,blendRate);
  waterMat.color.lerp(targetWater.set(theme.water).lerp(stormWater,weather*.6),blendRate);
  if(sunlight)sunlight.intensity=T.MathUtils.lerp(sunlight.intensity,2.8-weather*1.5,blendRate);

  const platformIds=new Set<number>(state.platforms.map((p:any)=>p.id));
  for(const p of state.platforms){
   let g=chunks.get(p.id);
   if(!g){
    g=new T.Group();const w=p.w/10,b=p.biome||'grove',bTheme=platformBiomes[b]||platformBiomes.grove;
    const tileId=p.moving?'moving-platform':b==='frost'?'ground-snow':b==='tropics'||b==='volcano'?'ground-fortified':'ground-grass';
    if(assets){
     for(let offset=0;offset<w;offset+=10){
      const width=Math.min(10,w-offset),tile=assets.prop(tileId)||assets.prop('ground-grass')!;
      tile.scale.x=width/10;k.add(tile,offset+width/2,0,0,g);
      if(tileId==='ground-fortified'){const under=assets.prop(b==='volcano'?'ground-snow':'ground-grass')!;under.scale.set(width/10,.7,.92);k.add(under,offset+width/2,-1.1,0,g);}
     }
     for(const f of [.22,.78]){
      if(b==='tropics')k.add(tree('palm',6.5+random(p.id+f)*2.5),w*f,0,-3.2,g);
      else{const plant=assets.prop(b==='frost'?'tree-snow':b==='volcano'||p.id%3===0?'pine':'tree')!;plant.scale.setScalar(.7+random(p.id+f)*.3);k.add(plant,w*f,0,-3.2,g);}
     }
     const detailPool=b==='frost'?['crate','rocks','stones','crate']:b==='tropics'?['barrel','rocks','flowers-tall','plant']:b==='canopy'?['flowers-tall','mushrooms','barrel','grass']:b==='volcano'?['rocks','stones','crate','barrel']:['flowers','mushrooms','plant','grass'];
     for(let j=0;j<4;j++){const detailId=detailPool[(p.id+j)%detailPool.length],detail=assets.prop(detailId)||assets.prop('grass')!;if(detailId==='crate'||detailId==='barrel')detail.scale.setScalar(.58);k.add(detail,4+j*(w-8)/4,0,3.7,g);}
     if(!p.moving){
      const bgLandmarkPool=b==='frost'?['castleSmallAlt','towerAlt','houseAlt1']:b==='tropics'?['pyramid','pyramidMayan','treePalm']:b==='canopy'?['tower','house2','treeOrange']:b==='volcano'?['castleSmall','castleWall','tower']:['house1','house2','towerAlt'];
      const bgTreePool=b==='frost'?['treePineFrozen','treeFrozen']:b==='tropics'?['treePalm','cactus1','cactus2']:b==='canopy'?['treeOrange','treePineOrange']:b==='volcano'?['treeDead','fenceIron']:['fence','treeOrange'];
      if(p.id%2===0){const lm=assets.bgElement(bgLandmarkPool[p.id%bgLandmarkPool.length]);if(lm)k.add(lm,w*.5,0,-5.4,g);}
      const bgT=assets.bgElement(bgTreePool[p.id%bgTreePool.length]);if(bgT)k.add(bgT,w*(p.id%2?.34:.68),0,-4.5,g);
     }
     if(p.id%5===0){const flag=assets.prop('flag')!;k.add(flag,3,0,-3.8,g);}
    }else{k.add(island(w,p.id),w/2,0,0,g);k.add(tree(b==='tropics'?'palm':'broadleaf',7),w*.3,0,-3.7,g);}
    if(p.id%5===0)k.add(sign(p.id===0?'RUN  /  JUMP  /  SURVIVE':`${bTheme.label}  /  ZONE ${Math.floor(p.id/5)+1}`,bTheme.sign,9.5),w*.55,0,-4.2,g);
    k.dynamic.add(g);k.batch(g);chunks.set(p.id,g);
   }
   g.position.set(p.x/10,(460-p.y)/10,0);
  }
  for(const [id,g] of chunks)if(!platformIds.has(id)){retire(g);chunks.delete(id);}

  for(const sp of state.springs||[]){
   let g=springs.get(sp.id);
   if(!g){g=assets?.prop('spring')||(()=>{const grp=new T.Group();k.box(2.4,.8,2.4,'#59d7ed',0,.4,0,grp);return grp;})();k.dynamic.add(g);springs.set(sp.id,g);}
   g.position.set(sp.x/10,(460-sp.y)/10,1.1);
  }
  for(const [id,g] of springs)if(!(state.springs||[]).some((p:any)=>p.id===id)){retire(g);springs.delete(id);}

  for(const item of state.coins){let g=gems.get(item.id);if(!g){g=assets?.prop('coin')||coin();k.dynamic.add(g);gems.set(item.id,g);}const visible=!item.collectedBy.includes(state.viewSeat??0);if(g.visible&&!visible)fx.burst(g.position.x,g.position.y,g.position.z);g.visible=visible;g.position.set(item.x/10,(460-item.y)/10+Math.sin(t*3+item.id)*.2,1.1);g.rotation.y=t*2.2;}
  for(const [id,g] of gems)if(!state.coins.some((p:any)=>p.id===id)){retire(g);gems.delete(id);}

  for(const h of state.hazards){
   let g=hazards.get(h.id);
   if(!g){g=new T.Group();if(h.kind==='thorns'){
    if(assets){const trap=assets.prop('spikes')!;trap.scale.set(1.6,2.8,1.3);g.add(trap);}else for(let j=0;j<4;j++)k.mesh(new T.ConeGeometry(.55,2.7,5),k.mat('#d9786c'),g,(j-1.5)*.9,1.35,0);
   }else if(h.kind==='spike-block'){
    if(assets&&assets.prop('spike-block'))g.add(assets.prop('spike-block')!);else k.box(2.6,2.6,2.6,'#d9534f',0,0,0,g);
   }else if(assets){g.add(assets.prop('saw')!);k.ring(1.8,.055,'#ffae84',0,0,0,g).rotation.x=0;}else{k.sphere(1.5,'#ac75d6',0,0,0,g);k.ring(2,.12,'#f0adff',0,0,0,g).rotation.x=.8;}
    k.dynamic.add(g);hazards.set(h.id,g);
   }
   const hy=h.kind==='orb'?(460-h.y+65-Math.sin(state.elapsed*(2+Math.min(1.5,(state.difficulty-1)*.2))+h.phase)*25)/10:h.kind==='spike-block'?(460-h.y+48-Math.cos(state.elapsed*2.6+h.phase)*28)/10:(460-h.y)/10;
   g.position.set(h.x/10,hy,1.1);
   if(h.kind==='orb')g.rotation.z=t*4;
   else if(h.kind==='spike-block')g.rotation.y=t*2.5;
  }
  for(const [id,g] of hazards)if(!state.hazards.some((p:any)=>p.id===id)){retire(g);hazards.delete(id);}

  for(const e of state.enemies||[]){
   if(!e.alive)continue;
   let entry=enemies.get(e.id);
   if(!entry){
    const model=assets?.animal(e.kind)||(()=>{const grp=new T.Group();k.sphere(1.4,'#ff6b6b',0,1.4,0,grp);return grp;})();
    k.dynamic.add(model);
    const isWater=e.kind==='fish'||e.kind==='piranha';
    const ring=isWater?k.ring(1.6,.08,'#a8f5ff',e.baseX/10,-5.8,1.1,k.dynamic):undefined;
    entry={g:model,submerged:e.submerged,ring};
    enemies.set(e.id,entry);
   }
   const {g,ring}=entry;
   const isWater=e.kind==='fish'||e.kind==='piranha';
   if(isWater&&entry.submerged!==undefined&&entry.submerged!==e.submerged){
    fx.burst(e.x/10,-5.2,1.1,'#9beeff',12);
    entry.submerged=e.submerged;
   }
   if(ring){
    ring.position.set(e.baseX/10,-5.85,1.1);
    ring.scale.setScalar(.85+Math.sin(t*6+e.id)*.25);
    ring.visible=Boolean(e.alive);
   }
   g.visible=Boolean(e.alive&&!e.submerged);
   if(g.visible){
    const wy=platformEnemyY(e);
    g.position.set(e.x/10,wy,1.1);
    if(g.userData.isSpriteEnemy){
     if(e.kind==='piranha'&&g.userData.setFrame)g.userData.setFrame(e.vy>=0?1:0);
     else g.scale.x=e.facing>=0?-1:1;
    }else if(isWater){
     g.rotation.y=e.facing>=0?0:Math.PI;
     g.rotation.z=clamp(-(e.vy||0)/420,-.95,.95)*(e.facing>=0?1:-1);
    }else{
     g.rotation.y=e.facing>=0?0:Math.PI;
    }
    if(g.userData.mixer)g.userData.mixer.update(dt);
   }
  }
  for(const [id,entry] of enemies)if(!(state.enemies||[]).some((p:any)=>p.id===id&&p.alive)){
   fx.burst(entry.g.position.x,entry.g.position.y+1,entry.g.position.z,'#ff7b29',16);
   spawnExplosion(entry.g.position.x,entry.g.position.y+1.2,entry.g.position.z+.2);
   if(entry.ring){entry.ring.geometry.dispose();entry.ring.removeFromParent();}
   retire(entry.g);enemies.delete(id);
  }

  for(const sh of state.shots||[]){
   let g=shots.get(sh.id);
   if(!g){
    g=shotPool.pop()||assets?.fireShot()||(()=>{const grp=new T.Group();k.sphere(.55,'#ff6b2b',0,0,0,grp);k.ring(.9,.08,'#ffe066',0,0,0,grp).rotation.y=Math.PI/2;return grp;})();
    g.visible=true;g.userData.resetShot?.();k.dynamic.add(g);shots.set(sh.id,g);
   }
   g.position.set(sh.x/10,(460-sh.y)/10,1.25);
   if(g.userData.updateShot)g.userData.updateShot(dt,sh.vx,sh.life);
   else g.rotation.z=0;
  }
  for(const [id,g] of shots)if(!(state.shots||[]).some((p:any)=>p.id===id)){
   g.visible=false;shotPool.push(g);shots.delete(id);
  }
  for(let idx=activeExplosions.length-1;idx>=0;idx--){
   const exp=activeExplosions[idx];
   if(!exp.userData.updateExplosion||!exp.userData.updateExplosion(dt)){
    retire(exp);activeExplosions.splice(idx,1);
   }
  }

  state.players.forEach((p:any,i:number)=>{
   const g=crew[i];g.position.set(p.x/10,(435-p.y)/10,i===(state.viewSeat??0)?1.2:-1.5-i*.9);
   g.visible=lifeFeedback[i].update(p,dt);
   // A final sea fall still leaves a readable death pose above the water.
   if(!p.alive)g.position.y=Math.max(.1,g.position.y);
   shields[i].visible=p.alive&&(p.invulnerable||0)>0;shields[i].position.copy(g.position);shields[i].position.y+=2;
   if(p.bouncedAt&&p.bouncedAt!==lastBounced[i]){lastBounced[i]=p.bouncedAt;fx.burst(g.position.x,g.position.y,g.position.z,'#72f2eb',16);}
   if(p.vx)g.rotation.y=p.vx>0?0:Math.PI;
   else if(p.facing)g.rotation.y=p.facing>0?0:Math.PI;
   if(g.userData.mixer){g.userData.playAnimation(!p.alive?'die':!p.ground?p.vy<0?'jump':'fall':Math.abs(p.vx)>5?'sprint':'idle');g.userData.mixer.update(dt);}
   else{animateExplorer(g,p,t);if(!p.alive)g.rotation.z=-1.2;}
   markers[i].position.copy(g.position);markers[i].position.y+=.08;markers[i].visible=p.alive&&p.ground;
  });
  fx.update(dt);waterMat.map!.offset.x=t*.003;
 };
}
