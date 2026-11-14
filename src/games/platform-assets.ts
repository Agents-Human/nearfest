import * as THREE from 'three';
import {GLTFLoader, type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';

/** Original Kenney CC0 models, skeletons and clips; see /models/platform/provenance.json. */
export type PlatformAssets = {
  prop(id: string): THREE.Group | null;
  character(seatOrColor?: number | string): THREE.Group;
  propIds: string[];
  portraits: string[];
};
type PropSpec = {axis: 'x' | 'y' | 'z'; size: number; anchor?: 'top' | 'center'};
const specs: Record<string, PropSpec> = {
  'ground-grass': {axis: 'z', size: 10, anchor: 'top'},
  'ground-snow': {axis: 'z', size: 10, anchor: 'top'},
  coin: {axis: 'y', size: 1.6, anchor: 'center'},
  spikes: {axis: 'x', size: 2.4},
  saw: {axis: 'y', size: 3, anchor: 'center'},
  tree: {axis: 'y', size: 8},
  'tree-snow': {axis: 'y', size: 8},
  pine: {axis: 'y', size: 9},
  plant: {axis: 'x', size: 2},
  mushrooms: {axis: 'x', size: 2},
  flowers: {axis: 'x', size: 2.4},
  grass: {axis: 'y', size: 1},
  crate: {axis: 'y', size: 2.2},
  flag: {axis: 'y', size: 6},
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

/** Four full rigs and fourteen scene props, loaded once. A failed load can be retried. */
export function loadPlatformAssets(): Promise<PlatformAssets> {
  if (pending) return pending;
  const loader = new GLTFLoader();
  const tasks = [...variants.map(name => 'character-' + name), ...Object.keys(specs)];
  pending = Promise.all(tasks.map(async id => [id, await loader.loadAsync('/models/platform/' + id + '.glb')] as const)).then(entries => {
    const sources = new Map(entries);
    return {
      prop(id: string) {return specs[id] ? propInstance(sources.get(id)!, id) : null;},
      character(seatOrColor: number | string = 0) {
        const seat = seatIndex(seatOrColor);return characterInstance(sources.get('character-' + variants[seat])!, seat);
      },
      propIds: Object.keys(specs),
      portraits: variants.map(name => '/models/platform/icons/character-' + name + '.png'),
    };
  }).catch(error => {pending = undefined;throw error;});
  return pending;
}
