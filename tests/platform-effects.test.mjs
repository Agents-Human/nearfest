import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {tsImport} from 'tsx/esm/api';
const {fireShotInstance,explosionEffectInstance,spriteEnemyInstance}=await tsImport('../src/games/platform-assets.ts',import.meta.url);
const {Kit}=await tsImport('../src/games/world-kit.ts',import.meta.url);
const {platformEnemyY}=await tsImport('../src/games/platform-scene.ts',import.meta.url);

test('the flying bat is drawn at its hitbox centre; grounded monsters keep their feet on the island',()=>{
  assert.equal(platformEnemyY({kind:'bat',flying:true,y:360}),10);
  assert.equal(platformEnemyY({kind:'crab',flying:false,y:440}),0);
  assert.equal(platformEnemyY({kind:'piranha',y:530}),-7);
});

test('sustained fire keeps one texture per layer, steady brightness and reusable geometry',()=>{
  const shot=fireShotInstance(new Map([['tank_explosion2.png',new T.Texture()]]));
  const [trail,core]=shot.children,resources=shot.children.map(mesh=>({map:mesh.material.map,geometry:mesh.geometry}));
  for(let frame=0;frame<240;frame++){
    shot.userData.updateShot(1/120,540,1);
    shot.children.forEach((mesh,i)=>{
      assert.equal(mesh.material.map,resources[i].map);assert.equal(mesh.geometry,resources[i].geometry);
      assert.equal(mesh.material.depthWrite,false);assert.equal(mesh.material.forceSinglePass,true);
    });
    if(frame>5){assert.equal(core.material.opacity,1);assert.equal(trail.material.opacity,.75);}
  }
  let alpha=1;
  for(let frame=16;frame>=0;frame--){shot.userData.updateShot(1/120,-540,frame/120);assert(core.material.opacity<=alpha);alpha=core.material.opacity;}
  assert.equal(alpha,0);assert.equal(shot.scale.x,-1);
  shot.userData.resetShot();shot.userData.updateShot(.05,540,1);
  assert.equal(core.material.opacity,1);assert.equal(shot.scale.x,1);
  shot.userData.disposeAnimations();
});

test('bat wings move smoothly while the body, silhouette texture and material stay stable',()=>{
  const bat=spriteEnemyInstance([new T.Texture(),new T.Texture()],'bat'),mesh=bat.children[0];
  const map=mesh.material.map,version=mesh.material.version,vertices=mesh.geometry.attributes.position;
  const rest=Array.from(vertices.array);let previous=rest.slice(),moved=false;
  for(let frame=0;frame<360;frame++){
    bat.userData.mixer.update(1/120);
    assert.equal(mesh.material.map,map);assert.equal(mesh.material.version,version);assert.equal(bat.visible,true);
    for(let i=0;i<vertices.count;i++){
      if(Math.abs(rest[i*3])<.3){assert(Math.abs(vertices.getX(i)-rest[i*3])<1e-8);assert(Math.abs(vertices.getY(i)-rest[i*3+1])<1e-8);}
      assert(Math.abs(vertices.getY(i)-previous[i*3+1])<.05,'no abrupt wing-frame jumps');
      if(Math.abs(vertices.getY(i)-rest[i*3+1])>.2)moved=true;
    }
    previous=Array.from(vertices.array);
  }
  assert(moved,'wings still flap');bat.userData.disposeAnimations();
});

test('hit effects fade once without flashing between explosion images',()=>{
  const effect=explosionEffectInstance(new Map([['tank_explosion2.png',new T.Texture()]])),mesh=effect.children[0],map=mesh.material.map;
  let opacity=1,alive=true;
  for(let frame=0;frame<40;frame++){alive=effect.userData.updateExplosion(1/120);assert.equal(mesh.material.map,map);assert(mesh.material.opacity<=opacity);opacity=mesh.material.opacity;}
  assert.equal(alive,false);assert.equal(opacity,0);assert.equal(mesh.material.depthWrite,false);effect.userData.disposeAnimations();
});

test('batching retains cutout and shadow settings instead of adding solid quad shadows',()=>{
  const kit=new Kit(),root=kit.dynamic;
  for(const alphaTest of [.03,.25]){
    const mesh=kit.mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({color:'white',alphaTest,alphaToCoverage:true,depthWrite:false}),root);
    mesh.castShadow=mesh.receiveShadow=false;root.add(mesh);
  }
  kit.batch(root);assert.equal(root.children.length,2);
  for(const mesh of root.children){assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);assert.equal(mesh.material.depthWrite,false);}
  kit.dispose();
});
