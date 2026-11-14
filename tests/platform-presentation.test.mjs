import test from 'node:test';
import assert from 'node:assert/strict';
import {tsImport} from 'tsx/esm/api';
import {PLATFORM_CHARACTERS,PLATFORM_TINTS} from '../shared/platform-options.mjs';
const {THREE:T,PlatformLifeFeedback,characterInstance,createPlatformMountains}=await tsImport('./fixtures/platform-presentation.ts',import.meta.url);

test('life loss blinks three times, final death stays visible, and repeated snapshots never retrigger it',()=>{
  for(const fps of [30,60,120]){
    const p={lives:3,alive:true,damageCount:0},feedback=new PlatformLifeFeedback(p);
    for(let i=0;i<fps;i++)assert(feedback.update(p,1/fps));
    for(let life=2;life>=0;life--){
      Object.assign(p,{lives:life,alive:life>0,damageCount:3-life});
      let previous=true,blinks=0;
      for(let i=0;i<fps*3;i++){
        const visible=feedback.update({...p},1/fps);
        if(previous&&!visible)blinks++;
        if(i>fps*1.3)assert(visible);
        previous=visible;
      }
      assert.equal(blinks,3,`${fps}fps: ${life} lives`);
    }
  }
});

test('all ten appearances share the same rig and geometry, with independent color uniforms',()=>{
  const scene=new T.Group();scene.add(new T.Mesh(new T.BoxGeometry(2,4,1),new T.MeshStandardMaterial()));
  const source={scene,animations:[]};let positions;
  for(const [i,name] of PLATFORM_CHARACTERS.entries()){
    const runner=characterInstance(source,i),model=runner.children[0].children[0],mesh=model.children[0];
    assert.equal(runner.userData.characterVariant,name);
    assert.equal(mesh.material.userData.characterTint.getHexString(),new T.Color(PLATFORM_TINTS[name]).getHexString());
    const geometry=[...mesh.geometry.attributes.position.array];
    if(positions)assert.deepEqual(geometry,positions);else positions=geometry;
    assert.notEqual(mesh.material,scene.children[0].material);
    const shader={uniforms:{},fragmentShader:'#include <map_fragment>'};mesh.material.onBeforeCompile(shader);
    assert.equal(shader.uniforms.runnerTint.value,mesh.material.userData.characterTint);
    assert.match(shader.fragmentShader,/bodyMask/);
    runner.userData.disposeAnimations();mesh.geometry.dispose();mesh.material.dispose();
  }
  scene.children[0].geometry.dispose();scene.children[0].material.dispose();
});

test('endless mountain ranges keep GPU resources stable and tile without gaps',()=>{
  const mountains=createPlatformMountains(),meshes=mountains.root.children;
  assert.equal(meshes.length,3);
  const resources=meshes.map(m=>[m.geometry,m.material]);
  for(let x=0;x<=100000;x+=250){
    mountains.update(x,.5,1/60);
    meshes.forEach((mesh,i)=>{
      assert.equal(mesh.geometry,resources[i][0]);assert.equal(mesh.material,resources[i][1]);
      assert(x-mesh.position.x>=0&&x-mesh.position.x<260);
    });
  }
  for(const mesh of meshes){
    const p=mesh.geometry.attributes.position;
    // The identical height profile at the start of each of the three tiles.
    for(let row=0;row<=6;row++){
      assert(Math.abs(p.getY(row)-p.getY(64*7+row))<1e-5);
      assert(Math.abs(p.getY(row)-p.getY(128*7+row))<1e-5);
    }
    mesh.geometry.dispose();mesh.material.dispose();
  }
});
