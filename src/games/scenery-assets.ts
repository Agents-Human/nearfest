import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

/** Hand-selected original Kenney CC0 models, supplied in assets/new.
 * Original files, hashes and licenses: /models/scenery/provenance.json.
 * Each game loads only its own small model group; no asset-pack bulk imports.
 */
export type SceneryDimensions = {x: number; y: number; z: number};
export type SceneryAssets = {
  game: string;
  /** Independent model instance, centered in X/Z with its base at y=0. */
  prop(id: string): THREE.Group | null;
  /** A center-pivoted ball for rolling: golf diameter 2, marble diameter 3.8. */
  ball(color?: THREE.ColorRepresentation): THREE.Group | null;
  propIds: string[];
  dimensions: Record<string, SceneryDimensions>;
};

type Spec = {group: string; axis: 'x' | 'y' | 'z'; size: number};
const specs: Record<string, Spec> = {
  windmill: {group: 'minigolf', axis: 'y', size: 11},
  castle: {group: 'minigolf', axis: 'x', size: 12},
  'golf-ball': {group: 'minigolf', axis: 'y', size: 2},
  flag: {group: 'minigolf', axis: 'y', size: 8},
  tomato: {group: 'food', axis: 'y', size: 1.8},
  cabbage: {group: 'food', axis: 'y', size: 2},
  cheese: {group: 'food', axis: 'x', size: 3.2},
  loaf: {group: 'food', axis: 'x', size: 4},
  burger: {group: 'food', axis: 'y', size: 2.6},
  pan: {group: 'food', axis: 'x', size: 5.5},
  pot: {group: 'food', axis: 'x', size: 5},
  'cutting-board': {group: 'food', axis: 'x', size: 6},
  plate: {group: 'food', axis: 'x', size: 5},
  salad: {group: 'food', axis: 'x', size: 3},
  soup: {group: 'food', axis: 'x', size: 3.5},
  marble: {group: 'marble', axis: 'y', size: 3.8},
  fan: {group: 'marble', axis: 'y', size: 8},
  tree: {group: 'marble', axis: 'y', size: 7},
  'tree-tall': {group: 'marble', axis: 'y', size: 10},
  banner: {group: 'marble', axis: 'y', size: 7},
  'house-a': {group: 'city', axis: 'x', size: 12},
  'house-b': {group: 'city', axis: 'x', size: 12},
  'house-d': {group: 'city', axis: 'x', size: 13},
  'house-h': {group: 'city', axis: 'x', size: 12},
  'house-q': {group: 'city', axis: 'x', size: 14},
  'city-tree': {group: 'city', axis: 'y', size: 10},
  'tree-large': {group: 'city', axis: 'y', size: 12},
  fence: {group: 'city', axis: 'x', size: 6},
  planter: {group: 'city', axis: 'x', size: 4},
  'building-skyscraper-a': {group: 'commercial', axis: 'y', size: 36},
  'building-skyscraper-b': {group: 'commercial', axis: 'y', size: 40},
  'building-skyscraper-c': {group: 'commercial', axis: 'y', size: 34},
  'building-a': {group: 'commercial', axis: 'x', size: 16},
  'building-c': {group: 'commercial', axis: 'x', size: 18},
  'building-f': {group: 'commercial', axis: 'x', size: 16},
  'detail-parasol-a': {group: 'commercial', axis: 'y', size: 3.8},
  'detail-awning': {group: 'commercial', axis: 'x', size: 4.5},
  'light-curved-double': {group: 'roads', axis: 'y', size: 9.5},
  'light-square-double': {group: 'roads', axis: 'y', size: 9.5},
  'traffic-light-hanging': {group: 'roads', axis: 'y', size: 9.5},
  'sign-highway-wide': {group: 'roads', axis: 'z', size: 30},
  'sign-highway-detailed': {group: 'roads', axis: 'z', size: 28},
  'road-straight': {group: 'roads', axis: 'x', size: 32},
  'road-crossroad': {group: 'roads', axis: 'x', size: 32},
  'road-crossing': {group: 'roads', axis: 'x', size: 32},
  'road-bridge': {group: 'roads', axis: 'x', size: 32},
  'road-straight-barrier': {group: 'roads', axis: 'x', size: 32},
  'road-driveway-double': {group: 'roads', axis: 'x', size: 32},
  'tile-low': {group: 'roads', axis: 'x', size: 32},
  'construction-barrier': {group: 'roads', axis: 'x', size: 4.2},
  'construction-cone': {group: 'roads', axis: 'y', size: 1.5},
  'bridge-pillar': {group: 'roads', axis: 'y', size: 14},
  'bridge-pillar-wide': {group: 'roads', axis: 'y', size: 14},
  pipe: {group: 'factory', axis: 'y', size: 9},
  machine: {group: 'factory', axis: 'y', size: 7},
  crane: {group: 'factory', axis: 'y', size: 16},
  screen: {group: 'factory', axis: 'x', size: 6},
  'robot-arm': {group: 'factory', axis: 'y', size: 8},
  fox: {group: 'pets', axis: 'y', size: 3.5},
};

export const sceneryGroups: Readonly<Record<string, readonly string[]>> = {
  'mini-golf': ['windmill', 'castle', 'golf-ball', 'flag', 'fox'],
  'kitchen-rush': ['tomato', 'cabbage', 'cheese', 'loaf', 'burger', 'pan', 'pot', 'cutting-board', 'plate', 'salad', 'soup'],
  'marble-knockout': ['marble', 'fan', 'tree', 'tree-tall', 'banner', 'fox'],
  'marble-run': [
    'marble', 'fan', 'tree', 'tree-tall', 'banner', 'fox',
    'house-a', 'house-h', 'house-q', 'city-tree', 'tree-large', 'fence', 'planter',
    'windmill', 'castle', 'flag',
    'building-a', 'building-c', 'building-f', 'detail-parasol-a', 'light-curved-double', 'light-square-double', 'sign-highway-wide',
    'pipe', 'machine', 'crane', 'screen', 'robot-arm',
  ],
  'pocket-racers': [
    'house-a',
    'house-b',
    'house-d',
    'house-h',
    'house-q',
    'city-tree',
    'tree-large',
    'fence',
    'planter',
    'building-skyscraper-a',
    'building-skyscraper-b',
    'building-skyscraper-c',
    'building-a',
    'building-c',
    'building-f',
    'detail-parasol-a',
    'light-curved-double',
    'light-square-double',
    'traffic-light-hanging',
    'sign-highway-wide',
    'sign-highway-detailed',
    'road-straight',
    'road-crossroad',
    'road-crossing',
    'road-bridge',
    'road-straight-barrier',
    'road-driveway-double',
    'tile-low',
    'construction-barrier',
    'bridge-pillar',
    'bridge-pillar-wide',
  ],
  'orbit-rescue': ['pipe', 'machine', 'crane', 'screen', 'robot-arm'],
};

const sourceCache = new Map<string, Promise<THREE.Group>>();
const gameCache = new Map<string, Promise<SceneryAssets>>();

function dimensions(source: THREE.Group, spec: Spec) {
  source.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(source);
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size[spec.axis]) || size[spec.axis] <= 0) throw new Error('Scenery model has invalid bounds.');
  const scale = spec.size / size[spec.axis];
  return {bounds, scale, size: {x: size.x * scale, y: size.y * scale, z: size.z * scale}};
}

/** Preserve the hierarchy: windmill.getObjectByName('blades'), fan's 'fan',
 * crane's 'arm', and the fox's body/leg nodes remain available for animation.
 * Returned geometry, materials, and texture handles belong only to this
 * instance. Disposing one scene cannot poison the cached source or a replay.
 */
function instance(id: string, source: THREE.Group): THREE.Group {
  const spec = specs[id];
  const {bounds, scale, size} = dimensions(source, spec);
  const center = bounds.getCenter(new THREE.Vector3());
  const root = new THREE.Group();
  const normalized = new THREE.Group();
  const copy = source.clone(true);
  const geometryCopies = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  const materialCopies = new Map<THREE.Material, THREE.Material>();
  const textureCopies = new Map<THREE.Texture, THREE.Texture>();
  const copyMaterial = (material: THREE.Material) => {
    if (materialCopies.has(material)) return materialCopies.get(material)!;
    const cloned = material.clone();
    for (const [key, value] of Object.entries(material)) {
      if (!(value instanceof THREE.Texture)) continue;
      if (!textureCopies.has(value)) {
        const texture = value.clone();
        texture.anisotropy = 4;
        texture.needsUpdate = true;
        textureCopies.set(value, texture);
      }
      (cloned as unknown as Record<string, unknown>)[key] = textureCopies.get(value);
    }
    materialCopies.set(material, cloned);
    return cloned;
  };
  copy.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!geometryCopies.has(object.geometry)) geometryCopies.set(object.geometry, object.geometry.clone());
    object.geometry = geometryCopies.get(object.geometry)!;
    object.material = Array.isArray(object.material) ? object.material.map(copyMaterial) : copyMaterial(object.material);
    object.castShadow = true;
    object.receiveShadow = true;
  });
  normalized.scale.setScalar(scale);
  normalized.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  normalized.add(copy);
  root.add(normalized);
  root.name = 'kenney-' + id;
  root.userData.assetSource = 'Kenney / CC0-1.0';
  root.userData.assetId = id;
  root.userData.dimensions = size;
  root.userData.pivot = 'bottom-center';
  return root;
}

function template(id: string): Promise<THREE.Group> {
  const cached = sourceCache.get(id);
  if (cached) return cached;
  const spec = specs[id];
  const pending = new GLTFLoader().loadAsync(`/models/scenery/${spec.group}/${id}.glb`)
    .then(gltf => gltf.scene)
    .catch(error => {sourceCache.delete(id); throw error;});
  sourceCache.set(id, pending);
  return pending;
}

/** Shared downloads are cached, but every prop()/ball() returns owned resources.
 * Unsupported games resolve to an empty kit without making network requests.
 * Failed downloads are removed from the cache, so the next attempt can recover.
 */
export function loadSceneryAssets(game: string): Promise<SceneryAssets> {
  const existing = gameCache.get(game);
  if (existing) return existing;
  const ids = sceneryGroups[game] || [];
  const pending = Promise.all(ids.map(async id => [id, await template(id)] as const)).then(entries => {
    const templates = new Map(entries);
    const sizes = Object.fromEntries(entries.map(([id, source]) => [id, dimensions(source, specs[id]).size]));
    const prop = (id: string) => {
      const source = templates.get(id);
      return source ? instance(id, source) : null;
    };
    return {
      game, prop, propIds: [...ids], dimensions: sizes,
      ball(color?: THREE.ColorRepresentation) {
        const id = game === 'mini-golf' ? 'golf-ball' : (game === 'marble-knockout' || game === 'marble-run') ? 'marble' : '';
        const ball = prop(id);
        if (!ball) return null;
        const radius = sizes[id].y / 2;
        ball.children[0].position.y -= radius;
        ball.userData.radius = radius;
        ball.userData.pivot = 'center';
        if (color !== undefined) {
          const visited = new Set<THREE.Material>();
          ball.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
              if (!(material instanceof THREE.MeshStandardMaterial) || visited.has(material)) continue;
              visited.add(material);
              // Golf's source atlas is solid red; replace only that ball's colour
              // map to preserve its real dimple geometry in every player colour.
              if (id === 'golf-ball') {material.map?.dispose(); material.map = null; material.roughness = .38;}
              if(id==='marble'){material.transparent=false;material.opacity=1;material.depthWrite=true;material.roughness=.18;material.metalness=.2;}
              material.color.set(color);
              material.needsUpdate = true;
            }
          });
        }
        return ball;
      },
    } satisfies SceneryAssets;
  }).catch(error => {gameCache.delete(game); throw error;});
  gameCache.set(game, pending);
  return pending;
}
