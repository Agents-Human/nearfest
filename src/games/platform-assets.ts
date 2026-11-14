import * as THREE from 'three';
import {GLTFLoader, type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';

/** Original Kenney CC0 models, skeletons and clips; see /models/platform/provenance.json. */
export type PlatformAssets = {
  prop(id: string): THREE.Group | null;
  character(seatOrColor?: number | string): THREE.Group;
  animal(id: string): THREE.Group | null;
  fireShot(): THREE.Group;
  explosionEffect(): THREE.Group;
  bgElement(id: string): THREE.Group | null;
  propIds: string[];
  animalIds: string[];
  bgIds: string[];
  portraits: string[];
};
type PropSpec = {axis: 'x' | 'y' | 'z'; size: number; anchor?: 'top' | 'center'};
const specs: Record<string, PropSpec> = {
  'ground-grass': {axis: 'z', size: 10, anchor: 'top'},
  'ground-snow': {axis: 'z', size: 10, anchor: 'top'},
  'ground-fortified': {axis: 'z', size: 10, anchor: 'top'},
  'moving-platform': {axis: 'z', size: 10, anchor: 'top'},
  spring: {axis: 'x', size: 2.6},
  coin: {axis: 'y', size: 1.6, anchor: 'center'},
  spikes: {axis: 'x', size: 2.4},
  'spike-block': {axis: 'y', size: 2.8, anchor: 'center'},
  saw: {axis: 'y', size: 3, anchor: 'center'},
  tree: {axis: 'y', size: 8},
  'tree-snow': {axis: 'y', size: 8},
  pine: {axis: 'y', size: 9},
  plant: {axis: 'x', size: 2},
  mushrooms: {axis: 'x', size: 2},
  flowers: {axis: 'x', size: 2.4},
  'flowers-tall': {axis: 'y', size: 2.6},
  grass: {axis: 'y', size: 1},
  crate: {axis: 'y', size: 2.2},
  barrel: {axis: 'y', size: 2.4},
  rocks: {axis: 'x', size: 3.2},
  stones: {axis: 'x', size: 2.6},
  flag: {axis: 'y', size: 6},
};
const animalSpecs: Record<string, {size: number; anchor?: 'center' | 'bottom'}> = {
  fish: {size: 2.6, anchor: 'center'},
  crab: {size: 2.5},
  bee: {size: 2.4, anchor: 'center'},
  hog: {size: 2.8},
  penguin: {size: 2.6},
  polar: {size: 3.1},
  parrot: {size: 2.4, anchor: 'center'},
  monkey: {size: 2.7},
  tiger: {size: 2.9},
};
const spriteEnemySpecs: Record<string, {frames: [string, string]; width: number; height: number; anchor?: 'center' | 'bottom'}> = {
  piranha: {frames: ['piranha.png', 'piranha_down.png'], width: 2.4, height: 3.2, anchor: 'center'},
  frog: {frames: ['frog.png', 'frog_leap.png'], width: 2.8, height: 2.3},
  slime: {frames: ['slimeGreen.png', 'slimeGreen_walk.png'], width: 2.6, height: 1.8},
  bat: {frames: ['bat.png', 'bat_fly.png'], width: 3.4, height: 2.1, anchor: 'center'},
  spider: {frames: ['spider_walk1.png', 'spider_walk2.png'], width: 3.0, height: 2.2},
  snakeLava: {frames: ['snakeLava.png', 'snakeLava_ani.png'], width: 2.2, height: 5.2},
  barnacle: {frames: ['barnacle.png', 'barnacle_bite.png'], width: 2.5, height: 2.8},
};
const fxFiles = [
  'tank_explosion2.png',
  'tank_explosion3.png',
  'tank_explosion4.png',
  'tank_explosion6.png',
  'tank_explosion8.png',
  'tank_bulletFly3.png',
] as const;
const bgElementSpecs: Record<string, {file: string; width: number; height: number; anchor?: 'center' | 'bottom'}> = {
  house1: {file: 'house1.png', width: 5.5, height: 7.2},
  house2: {file: 'house2.png', width: 7.4, height: 6.8},
  houseAlt1: {file: 'houseAlt1.png', width: 5.5, height: 7.2},
  castleSmall: {file: 'castleSmall.png', width: 7.2, height: 6.6},
  castleSmallAlt: {file: 'castleSmallAlt.png', width: 7.2, height: 6.6},
  castleWall: {file: 'castleWall.png', width: 4.8, height: 5.4},
  tower: {file: 'tower.png', width: 3.6, height: 9.2},
  towerAlt: {file: 'towerAlt.png', width: 3.6, height: 9.2},
  pyramid: {file: 'pyramid.png', width: 9.2, height: 7.8},
  pyramidMayan: {file: 'pyramidMayan.png', width: 8.6, height: 6.4},
  treePalm: {file: 'treePalm.png', width: 6.2, height: 8.2},
  treeFrozen: {file: 'treeFrozen.png', width: 3.8, height: 7.6},
  treePineFrozen: {file: 'treePineFrozen.png', width: 4.2, height: 8.4},
  treeOrange: {file: 'treeOrange.png', width: 3.8, height: 7.8},
  treePineOrange: {file: 'treePineOrange.png', width: 4.2, height: 8.4},
  treeDead: {file: 'treeDead.png', width: 5.2, height: 6.8},
  cactus1: {file: 'cactus1.png', width: 2.6, height: 4.4},
  cactus2: {file: 'cactus2.png', width: 2.4, height: 4.2},
  fence: {file: 'fence.png', width: 3.2, height: 2.2},
  fenceIron: {file: 'fenceIron.png', width: 3.4, height: 2.6},
  cloud1: {file: 'cloud1.png', width: 9.5, height: 5.2, anchor: 'center'},
  cloud2: {file: 'cloud2.png', width: 8.8, height: 5.6, anchor: 'center'},
  cloud3: {file: 'cloud3.png', width: 10.2, height: 5.4, anchor: 'center'},
  sun: {file: 'sun.png', width: 6.5, height: 6.5, anchor: 'center'},
  moon: {file: 'moon.png', width: 5.8, height: 5.8, anchor: 'center'},
  moonFull: {file: 'moonFull.png', width: 6.2, height: 6.2, anchor: 'center'},
};
const variants = ['pink', 'purple', 'teal', 'gold'];
const colors = ['#e88470', '#a18acb', '#72b59a', '#e6bb58'];
let pending: Promise<PlatformAssets> | undefined;

/** Texture clones deliberately share the immutable image Source, allowing static
 * batching by source.uuid while retaining independently disposable GPU handles. */
function ownResources(model: THREE.Object3D) {
  const materials = new Map<THREE.Material, THREE.Material>();
  const textures = new Map<THREE.Texture, THREE.Texture>();
  const copy = (source: THREE.Material) => {
    if (materials.has(source)) return materials.get(source)!;
    const result = source.clone();
    for (const [key, value] of Object.entries(source)) {
      if (!(value instanceof THREE.Texture)) continue;
      if (!textures.has(value)) textures.set(value, value.clone());
      (result as unknown as Record<string, unknown>)[key] = textures.get(value)!;
    }
    if (result instanceof THREE.MeshStandardMaterial) result.roughness = .8;
    materials.set(source, result);return result;
  };
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry = object.geometry.clone();
    object.material = Array.isArray(object.material) ? object.material.map(copy) : copy(object.material);
    object.castShadow = true;object.receiveShadow = true;
    if (object instanceof THREE.SkinnedMesh) {
      // SkeletonUtils already gives this instance its own bones/skeleton.
      object.skeleton.boneInverses = object.skeleton.boneInverses.map(matrix => matrix.clone());
      object.frustumCulled = false;
    }
  });
}

function seatIndex(seatOrColor: number | string) {
  if (typeof seatOrColor === 'number') return ((Math.floor(seatOrColor) % 4) + 4) % 4;
  const named = variants.indexOf(seatOrColor);
  if (named >= 0) return named;
  const target = new THREE.Color(seatOrColor);
  let best = 0, distance = Infinity;
  colors.forEach((color, i) => {
    const c = new THREE.Color(color);
    const d = (target.r - c.r) ** 2 + (target.g - c.g) ** 2 + (target.b - c.b) ** 2;
    if (d < distance) {best = i;distance = d;}
  });
  return best;
}

function characterInstance(source: GLTF, seat: number) {
  const model = cloneSkeleton(source.scene) as THREE.Group;
  ownResources(model);
  const root = new THREE.Group();root.name = 'kenney-runner-' + variants[seat];
  const pivot = new THREE.Group();pivot.name = 'character-orientation';pivot.add(model);root.add(pivot);
  const original = new THREE.Box3().setFromObject(model);
  const scale = 4 / original.getSize(new THREE.Vector3()).y;
  pivot.scale.setScalar(scale);pivot.rotation.y = Math.PI / 2; // Source faces +Z; game faces +X.
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root), center = bounds.getCenter(new THREE.Vector3());
  pivot.position.set(-center.x, -bounds.min.y, -center.z);
  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map<string, THREE.AnimationAction>();
  for (const clip of source.animations) actions.set(clip.name, mixer.clipAction(clip.clone()));
  let current: THREE.AnimationAction | undefined;
  function playAnimation(name: string, fade = .12, restart = false) {
    const next = actions.get(name) || actions.get('idle');
    if (!next || next === current && !restart) return;
    current?.fadeOut(fade);
    next.reset();next.enabled = true;next.setEffectiveTimeScale(1);next.setEffectiveWeight(1);
    const once = name.startsWith('attack-') || ['jump', 'fall', 'die', 'pick-up'].includes(name);
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = once;next.fadeIn(fade).play();current = next;
    root.userData.animationState = next.getClip().name;
  }
  root.userData.assetSource = 'Kenney Platformer Kit 4.1 / CC0';
  root.userData.characterVariant = variants[seat];
  root.userData.portrait = '/models/platform/icons/character-' + variants[seat] + '.png';
  root.userData.mixer = mixer;
  root.userData.playAnimation = playAnimation;
  root.userData.animationNames = [...actions.keys()];
  root.userData.disposeAnimations = () => {
    mixer.stopAllAction();mixer.uncacheRoot(model);
    model.traverse(object => {if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose();});
  };
  playAnimation('idle', 0);
  return root;
}

function propInstance(source: GLTF, id: string): THREE.Group {
  const model = source.scene.clone(true);
  ownResources(model);
  const root = new THREE.Group();root.name = 'kenney-platform-' + id;root.add(model);
  const spec = specs[id], bounds = new THREE.Box3().setFromObject(model);
  const factor = spec.size / bounds.getSize(new THREE.Vector3())[spec.axis];
  model.scale.multiplyScalar(factor);root.updateMatrixWorld(true);
  bounds.setFromObject(root);const center = bounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;model.position.z -= center.z;
  model.position.y -= spec.anchor === 'top' ? bounds.max.y : spec.anchor === 'center' ? center.y : bounds.min.y;
  root.userData.assetSource = 'Kenney Platformer Kit 4.1 / CC0';
  root.userData.anchor = spec.anchor || 'bottom';
  root.userData.propId = id;
  root.userData.animationNames = source.animations.map(clip => clip.name);
  // The supplied saw/coin faces remain in XY (normal +Z), ready to spin about Z/Y.
  // The spike trap's static pose is fully extended; collision timing belongs to gameplay.
  return root;
}

function animalInstance(source: GLTF, id: string): THREE.Group {
  const model = cloneSkeleton(source.scene) as THREE.Group;
  ownResources(model);
  const spec = animalSpecs[id];
  const root = new THREE.Group();root.name = 'kenney-animal-' + id;
  const pivot = new THREE.Group();pivot.name = 'animal-orientation';pivot.add(model);root.add(pivot);
  const original = new THREE.Box3().setFromObject(model);
  const scale = spec.size / original.getSize(new THREE.Vector3()).y;
  pivot.scale.setScalar(scale);pivot.rotation.y = Math.PI / 2; // Source faces +Z; game faces +X.
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root), center = bounds.getCenter(new THREE.Vector3());
  pivot.position.set(-center.x, spec.anchor === 'center' ? -center.y : -bounds.min.y, -center.z);
  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map<string, THREE.AnimationAction>();
  for (const clip of source.animations) actions.set(clip.name, mixer.clipAction(clip.clone()));
  let current: THREE.AnimationAction | undefined;
  function playAnimation(name: string, fade = .1, restart = false) {
    const next = actions.get(name) || actions.get('run') || actions.get('walk') || actions.get('idle');
    if (!next || next === current && !restart) return;
    current?.fadeOut(fade);
    next.reset();next.enabled = true;next.setEffectiveTimeScale(1);next.setEffectiveWeight(1);
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.fadeIn(fade).play();current = next;
    root.userData.animationState = next.getClip().name;
  }
  root.userData.assetSource = 'Kenney Cube Pets 1.0 / CC0';
  root.userData.animalId = id;
  root.userData.mixer = mixer;
  root.userData.playAnimation = playAnimation;
  root.userData.animationNames = [...actions.keys()];
  root.userData.disposeAnimations = () => {
    mixer.stopAllAction();mixer.uncacheRoot(model);
  };
  playAnimation('run', 0);
  return root;
}

function spriteEnemyInstance(textures: [THREE.Texture, THREE.Texture], id: string): THREE.Group {
  const spec = spriteEnemySpecs[id];
  const root = new THREE.Group();root.name = 'kenney-extended-enemy-' + id;
  const frameTex: [THREE.Texture, THREE.Texture] = [textures[0].clone(), textures[1].clone()];
  for (const t of frameTex) {
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
  }
  const geometry = new THREE.PlaneGeometry(spec.width, spec.height);
  const material = new THREE.MeshBasicMaterial({
    map: frameTex[0],
    transparent: true,
    alphaTest: .03,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = spec.anchor === 'center' ? 0 : spec.height / 2;
  root.add(mesh);
  let elapsed = 0, currentFrame = 0;
  root.userData.assetSource = 'Kenney Platformer Art Extended Enemies / CC0';
  root.userData.animalId = id;
  root.userData.isSpriteEnemy = true;
  root.userData.setFrame = (index: 0 | 1) => {
    if (currentFrame === index) return;
    currentFrame = index;
    material.map = frameTex[index];
    material.needsUpdate = true;
  };
  root.userData.mixer = {
    update(dt: number) {
      elapsed += dt;
      if (id !== 'piranha') {
        const next = Math.floor(elapsed * 6) % 2 as 0 | 1;
        root.userData.setFrame(next);
      }
    },
  };
  root.userData.disposeAnimations = () => {
    frameTex[0].dispose();
    frameTex[1].dispose();
  };
  return root;
}

function fireShotInstance(fxMap: Map<string, THREE.Texture>): THREE.Group {
  const root = new THREE.Group();
  root.name = 'kenney-tanks-fire-shot';
  const f1 = fxMap.get('tank_explosion3.png')!.clone();
  const f2 = fxMap.get('tank_explosion4.png')!.clone();
  const coreTex = fxMap.get('tank_explosion2.png')!.clone();
  for (const t of [f1, f2, coreTex]) {
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
  }
  const flameGeo = new THREE.PlaneGeometry(2.6, 2.6);
  const flameMat = new THREE.MeshBasicMaterial({
    map: f1,
    transparent: true,
    alphaTest: .02,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const flameMesh = new THREE.Mesh(flameGeo, flameMat);
  const coreGeo = new THREE.PlaneGeometry(1.7, 1.7);
  const coreMat = new THREE.MeshBasicMaterial({
    map: coreTex,
    transparent: true,
    alphaTest: .02,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.position.z = .05;
  root.add(flameMesh, coreMesh);

  let elapsed = 0;
  root.userData.assetSource = 'Kenney Tanks / CC0';
  root.userData.updateShot = (dt: number, vx = 1) => {
    elapsed += dt;
    const frame = Math.floor(elapsed * 18) % 2;
    flameMat.map = frame === 0 ? f1 : f2;
    flameMesh.rotation.z += dt * (vx >= 0 ? -14 : 14);
    coreMesh.rotation.z += dt * (vx >= 0 ? 10 : -10);
    const pulse = 1 + Math.sin(elapsed * 28) * .16;
    flameMesh.scale.setScalar(pulse);
  };
  root.userData.disposeAnimations = () => {
    f1.dispose();
    f2.dispose();
    coreTex.dispose();
  };
  return root;
}

function explosionEffectInstance(fxMap: Map<string, THREE.Texture>): THREE.Group {
  const root = new THREE.Group();
  root.name = 'kenney-tanks-explosion';
  const frames = [
    'tank_explosion2.png',
    'tank_explosion3.png',
    'tank_explosion4.png',
    'tank_explosion6.png',
    'tank_explosion8.png',
  ].map(name => {
    const t = fxMap.get(name)!.clone();
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  });
  const geo = new THREE.PlaneGeometry(3.6, 3.6);
  const mat = new THREE.MeshBasicMaterial({
    map: frames[0],
    transparent: true,
    alphaTest: .02,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  root.add(mesh);
  let elapsed = 0;
  const duration = .36;
  root.userData.updateExplosion = (dt: number) => {
    elapsed += dt;
    const progress = Math.min(1, elapsed / duration);
    const idx = Math.min(frames.length - 1, Math.floor(progress * frames.length));
    mat.map = frames[idx];
    mat.opacity = 1 - Math.max(0, (progress - .65) / .35);
    mesh.scale.setScalar(.85 + progress * .75);
    mesh.rotation.z += dt * 5;
    return elapsed < duration;
  };
  root.userData.disposeAnimations = () => {
    frames.forEach(f => f.dispose());
  };
  return root;
}

function bgElementInstance(sourceTex: THREE.Texture, id: string): THREE.Group {
  const spec = bgElementSpecs[id];
  const root = new THREE.Group();
  root.name = 'kenney-bg-' + id;
  const tex = sourceTex.clone();
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  const geo = new THREE.PlaneGeometry(spec.width, spec.height);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    alphaTest: .03,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = spec.anchor === 'center' ? 0 : spec.height / 2;
  root.add(mesh);
  root.userData.assetSource = 'Kenney Background Elements Remastered / CC0';
  root.userData.bgId = id;
  root.userData.disposeAnimations = () => {
    tex.dispose();
  };
  return root;
}

/** Four full rigs, twenty-two scene props, nine 3D animals, seven extended enemy sprites, tank fire FX, and remastered background elements. */
export function loadPlatformAssets(): Promise<PlatformAssets> {
  if (pending) return pending;
  const loader = new GLTFLoader();
  const texLoader = new THREE.TextureLoader();
  const glbTasks = [
    ...variants.map(name => ['character-' + name, '/models/platform/character-' + name + '.glb'] as const),
    ...Object.keys(specs).map(id => [id, '/models/platform/' + id + '.glb'] as const),
    ...Object.keys(animalSpecs).map(id => ['animal-' + id, '/models/platform/animals/' + id + '.glb'] as const),
  ];
  const spriteTasks = Object.entries(spriteEnemySpecs).map(async ([id, spec]) => {
    const [t0, t1] = await Promise.all(spec.frames.map(f => texLoader.loadAsync('/models/platform/enemies/' + f)));
    return [id, [t0, t1] as [THREE.Texture, THREE.Texture]] as const;
  });
  const fxTasks = fxFiles.map(async file => [file, await texLoader.loadAsync('/models/platform/fx/' + file)] as const);
  const bgTasks = Object.entries(bgElementSpecs).map(async ([id, spec]) => [id, await texLoader.loadAsync('/models/platform/bg/' + spec.file)] as const);

  pending = Promise.all([
    Promise.all(glbTasks.map(async ([id, url]) => [id, await loader.loadAsync(url)] as const)),
    Promise.all(spriteTasks),
    Promise.all(fxTasks),
    Promise.all(bgTasks),
  ]).then(([glbEntries, spriteEntries, fxEntries, bgEntries]) => {
    const sources = new Map(glbEntries);
    const sprites = new Map(spriteEntries);
    const fxMap = new Map(fxEntries);
    const bgMap = new Map(bgEntries);
    return {
      prop(id: string) {return specs[id] ? propInstance(sources.get(id)!, id) : null;},
      character(seatOrColor: number | string = 0) {
        const seat = seatIndex(seatOrColor);return characterInstance(sources.get('character-' + variants[seat])!, seat);
      },
      animal(id: string) {
        if (animalSpecs[id]) return animalInstance(sources.get('animal-' + id)!, id);
        if (spriteEnemySpecs[id]) return spriteEnemyInstance(sprites.get(id)!, id);
        return null;
      },
      fireShot() {
        return fireShotInstance(fxMap);
      },
      explosionEffect() {
        return explosionEffectInstance(fxMap);
      },
      bgElement(id: string) {
        return bgElementSpecs[id] ? bgElementInstance(bgMap.get(id)!, id) : null;
      },
      propIds: Object.keys(specs),
      animalIds: [...Object.keys(animalSpecs), ...Object.keys(spriteEnemySpecs)],
      bgIds: Object.keys(bgElementSpecs),
      portraits: variants.map(name => '/models/platform/icons/character-' + name + '.png'),
    };
  }).catch(error => {pending = undefined;throw error;});
  return pending;
}
