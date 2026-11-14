import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export type ActionAssets = {
  prop(id: string): THREE.Group | null;
  tank(color: THREE.ColorRepresentation): THREE.Group;
  texture(name: string): THREE.Texture | null;
  textures: Map<string, THREE.Texture>;
  propIds: string[];
  dimensions: Record<string, {x: number; y: number; z: number}>;
};
type Spec = {group: string; scale?: number; axis?: 'x' | 'y' | 'z'; size?: number; rotate?: number; url?: string};
const quarter = Math.PI / 2;
const specs: Record<string, Spec> = {
  'arena-column': {group: 'building', scale: 5, rotate: quarter},
  'arena-arch': {group: 'building', scale: 5, rotate: quarter},
  'arena-wall': {group: 'building', scale: 5, rotate: quarter},
  'arena-stairs': {group: 'building', scale: 5, rotate: quarter},
  'arena-floor': {group: 'building', scale: 10, rotate: quarter},
  'border-high': {group: 'building', scale: 5, rotate: quarter},
  'border-high-corner': {group: 'building', scale: 5, rotate: quarter},
  'barricade-window-b': {group: 'building', scale: 5, rotate: quarter},
  'wall-window-square-detailed': {group: 'building', scale: 5, rotate: quarter},
  'plating-detailed-wide': {group: 'building', scale: 5, rotate: quarter},
  crate: {group: 'factory', axis: 'x', size: 3.6},
  'box-large': {group: 'factory', axis: 'x', size: 3.6},
  'box-wide': {group: 'factory', axis: 'x', size: 4.2},
  'box-small': {group: 'factory', axis: 'x', size: 1.5},
  beacon: {group: 'factory', axis: 'y', size: 4.5},
  checker: {group: 'factory', axis: 'x', size: 10},
  'floor-large': {group: 'factory', axis: 'x', size: 10},
  'indicator-special-area': {group: 'factory', axis: 'x', size: 6.2},
  'button-floor-round': {group: 'factory', axis: 'x', size: 4.4},
  'conveyor-long-stripe-sides': {group: 'factory', axis: 'x', size: 12},
  'catwalk-straight': {group: 'factory', axis: 'x', size: 10},
  machine: {group: 'factory', axis: 'y', size: 7, url: '/models/scenery/factory/machine.glb'},
  'machine-fortified': {group: 'factory', axis: 'y', size: 6.5},
  screen: {group: 'factory', axis: 'x', size: 6, url: '/models/scenery/factory/screen.glb'},
  crane: {group: 'factory', axis: 'y', size: 13, url: '/models/scenery/factory/crane.glb'},
  'robot-arm': {group: 'factory', axis: 'y', size: 7.5, url: '/models/scenery/factory/robot-arm.glb'},
  pipe: {group: 'factory', axis: 'y', size: 6.5, url: '/models/scenery/factory/pipe.glb'},
  'scanner-high': {group: 'factory', axis: 'y', size: 6.2},
  'piston-round': {group: 'factory', axis: 'y', size: 6},
  'hopper-round': {group: 'factory', axis: 'y', size: 5.8},
  'warning-orange': {group: 'factory', axis: 'y', size: 3.4},
  'warning-traffic': {group: 'factory', axis: 'y', size: 3.8},
  cone: {group: 'factory', axis: 'y', size: 1.8},
  'structure-yellow-high': {group: 'factory', axis: 'y', size: 9},
  barrel: {group: 'survival', axis: 'y', size: 3.1},
  'barrel-open': {group: 'survival', axis: 'y', size: 3.0},
  chest: {group: 'survival', axis: 'x', size: 3.5},
  'fence-fortified': {group: 'survival', axis: 'x', size: 6.5},
  'structure-metal-wall': {group: 'survival', axis: 'x', size: 7.8},
  'metal-panel-screws': {group: 'survival', axis: 'x', size: 5.5},
  'workbench-anvil': {group: 'survival', axis: 'x', size: 5.2},
  'rock-flat-grass': {group: 'survival', axis: 'x', size: 16},
  'rock-flat': {group: 'survival', axis: 'x', size: 14},
  'arrow-basic': {group: 'factory', axis: 'x', size: 4.4, rotate: quarter},
  'indicator-special-arrow': {group: 'factory', axis: 'x', size: 4.6, rotate: quarter},
  'track-straight': {group: 'marble', scale: 10, rotate: quarter},
  'track-wide': {group: 'marble', scale: 10, rotate: quarter},
  'track-curve': {group: 'marble', scale: 10, rotate: quarter},
  'track-ramp': {group: 'marble', scale: 10, rotate: quarter},
  'track-support': {group: 'marble', scale: 10, rotate: quarter},
  'track-gate': {group: 'marble', scale: 10, rotate: quarter},
  'track-fan': {group: 'marble', scale: 10, rotate: quarter, url: '/models/scenery/marble/fan.glb'},
  'track-end': {group: 'marble', scale: 10, rotate: quarter},
  tunnel: {group: 'marble', scale: 13, rotate: quarter},
  'banner-double-high': {group: 'marble', scale: 11, rotate: quarter},
  'banner-hanging-double-high': {group: 'marble', scale: 11, rotate: quarter},
  'helix-large-left': {group: 'marble', scale: 8.5, rotate: quarter},
  'helix-large-right': {group: 'marble', scale: 8.5, rotate: quarter},
  'funnel-long': {group: 'marble', scale: 9.5, rotate: quarter},
  's-curve-left-large': {group: 'marble', scale: 8.5, rotate: quarter},
  'support-color-four-top': {group: 'marble', scale: 10, rotate: quarter},
  'support-color-four-middle': {group: 'marble', scale: 10, rotate: quarter},
  'support-color-four-bottom': {group: 'marble', scale: 10, rotate: quarter},
  'fan-standing-four': {group: 'marble', scale: 9.5, rotate: quarter},
  'fan-four': {group: 'marble', scale: 8.5, rotate: quarter},
  'tree-large': {group: 'marble', scale: 9},
  'tree-tall-large': {group: 'marble', scale: 10},
};
export const actionAssetGroups: Readonly<Record<string, readonly string[]>> = {
  'stick-rivals': ['arena-column', 'arena-arch', 'arena-wall', 'arena-stairs', 'arena-floor', 'crate', 'beacon', 'checker'],
  'marble-run': [
    'track-straight', 'track-wide', 'track-curve', 'track-ramp', 'track-support', 'track-gate', 'track-fan', 'track-end',
    'tunnel', 'banner-double-high', 'banner-hanging-double-high', 'helix-large-left', 'helix-large-right', 'funnel-long', 's-curve-left-large',
    'support-color-four-top', 'support-color-four-middle', 'support-color-four-bottom', 'fan-standing-four', 'fan-four', 'tree-large', 'tree-tall-large',
    'arrow-basic', 'indicator-special-arrow', 'button-floor-round', 'piston-round', 'warning-orange', 'cone', 'beacon', 'rock-flat-grass', 'rock-flat', 'crate', 'barrel',
  ],
  // Tank scenery is code-authored; only the combat effect textures are loaded.
  'tank-arena': [],
};
const tankTextureFiles = [
  'tank_explosion1.png', 'tank_explosion2.png', 'tank_explosion3.png', 'tank_explosion4.png',
  'explosion1.png', 'explosion2.png', 'explosion3.png', 'explosion4.png', 'explosion5.png',
  'shotLarge.png', 'shotOrange.png', 'tank_bulletFly3.png', 'tracksDouble.png',
];
export const tankHudIcons = ['/models/action/icons/tank-blue.png', '/models/action/icons/tank-red.png'];

/** Measured from the original mesh vertices; +X is travel after normalization.
 * Track prop origins are at the bottom of the structure, not at the road surface.
 */
export const marbleTrackMetrics = {
  sourceScale: 10,
  straight: {length: 10, width: 10, surfaceY: 2.5, flatHalfWidth: 1, shoulderHalfWidth: 2.875, shoulderY: 3.125, innerRailHalfWidth: 3.5, railTop: 5},
  wide: {length: 10, width: 17, surfaceY: 2.5, flatHalfWidth: 2, railTop: 5},
  ramp: {length: 20, width: 10, entryY: 2.5, exitY: 5, rise: 2.5, profile: [[-10, 2.5], [-7.28, 2.57], [-5.04, 2.76], [-3.16, 3.04], [-1.52, 3.38], [1.52, 4.12], [3.16, 4.46], [5.04, 4.74], [7.28, 4.93], [10, 5]]},
  curve: {entry: [-10, 2.5, -5], exit: [5, 2.5, 10]},
} as const;

const sourceCache = new Map<string, Promise<THREE.Group>>();
const gameCache = new Map<string, Promise<ActionAssets>>();
const atlasSources = new Map<string, THREE.Texture['source']>();

function loadTemplate(id: string) {
  const cached = sourceCache.get(id);
  if (cached) return cached;
  const spec = specs[id];
  const pending = new GLTFLoader().loadAsync(spec.url || `/models/action/${spec.group}/${id}.glb`).then(gltf => {
    // Every selected model in a pack uses the same immutable colour atlas.
    // Sharing the Source gives repeated clones a stable source.uuid for batching;
    // actual Texture/GPU handles are independently cloned below.
    gltf.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        for (const value of Object.values(material)) {
          if (!(value instanceof THREE.Texture)) continue;
          const key = spec.group + '/' + value.name;
          const canonical = atlasSources.get(key);
          if (canonical) value.source = canonical;
          else atlasSources.set(key, value.source);
        }
      }
    });
    return gltf.scene;
  }).catch(error => {sourceCache.delete(id); throw error;});
  sourceCache.set(id, pending);
  return pending;
}

function instantiate(id: string, source: THREE.Group): THREE.Group {
  const spec = specs[id];
  const root = new THREE.Group(), orientation = new THREE.Group();
  const model = source.clone(true);
  const materials = new Map<THREE.Material, THREE.Material>();
  const textures = new Map<THREE.Texture, THREE.Texture>();
  const geometries = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  function ownMaterial(original: THREE.Material) {
    if (materials.has(original)) return materials.get(original)!;
    const clone = original.clone();
    for (const [key, value] of Object.entries(original)) {
      if (!(value instanceof THREE.Texture)) continue;
      if (!textures.has(value)) {const texture = value.clone(); texture.anisotropy = 4; textures.set(value, texture);}
      (clone as unknown as Record<string, unknown>)[key] = textures.get(value)!;
    }
    materials.set(original, clone);
    return clone;
  }
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!geometries.has(object.geometry)) geometries.set(object.geometry, object.geometry.clone());
    object.geometry = geometries.get(object.geometry)!;
    object.material = Array.isArray(object.material) ? object.material.map(ownMaterial) : ownMaterial(object.material);
    object.castShadow = true; object.receiveShadow = true;
  });
  orientation.add(model); root.add(orientation);
  orientation.rotation.y = spec.rotate || 0;
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const scale = spec.scale ?? spec.size! / bounds.getSize(new THREE.Vector3())[spec.axis!];
  orientation.scale.setScalar(scale);
  root.updateMatrixWorld(true); bounds.setFromObject(root);
  const center = bounds.getCenter(new THREE.Vector3());
  orientation.position.set(-center.x, -bounds.min.y, -center.z);
  const size = bounds.getSize(new THREE.Vector3());
  root.name = 'kenney-action-' + id;
  root.userData.assetId = id;
  root.userData.assetSource = 'Kenney / CC0-1.0';
  root.userData.dimensions = {x: size.x, y: size.y, z: size.z};
  root.userData.pivot = 'bottom-center';
  return root;
}

/** Merge an original tank subassembly by material, keeping turret articulation. */
function mergeAssembly(group: THREE.Group) {
  group.updateMatrixWorld(true);
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const old = new Set<THREE.BufferGeometry>();
  for (const child of [...group.children]) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
    child.updateMatrix();
    const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    geometry.applyMatrix4(child.matrix);
    const batch = batches.get(child.material) || [];
    batch.push(geometry); batches.set(child.material, batch);
    old.add(child.geometry); group.remove(child);
  }
  old.forEach(geometry => geometry.dispose());
  for (const [material, parts] of batches) {
    const geometry = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    if (!geometry) continue;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  }
  return group;
}

/** Original code-authored toy tank, not a Kenney 3D asset or a billboard.
 * At rest: +X forward, base Y=0, 4.6 long × 3 wide. All resources are owned.
 * userData.turret rotates about Y; userData.muzzle is the barrel endpoint.
 */
export function tank(color: THREE.ColorRepresentation): THREE.Group {
  const root = new THREE.Group(); root.name = 'original-toy-tank';
  const hull = new THREE.Group(); root.add(hull);
  const paint = new THREE.MeshStandardMaterial({color, roughness: .42, metalness: .22});
  const darkPaint = new THREE.MeshStandardMaterial({color: new THREE.Color(color).multiplyScalar(.55), roughness: .5, metalness: .25});
  const rubber = new THREE.MeshStandardMaterial({color: '#18232b', roughness: .95});
  const steel = new THREE.MeshStandardMaterial({color: '#71828c', roughness: .54, metalness: .6});
  const light = new THREE.MeshStandardMaterial({color: '#f5f0d1', emissive: '#fff0aa', emissiveIntensity: .45});
  const glass = new THREE.MeshStandardMaterial({color: '#92dbe4', roughness: .18, metalness: .35});
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent = hull) {
    const part = new THREE.Mesh(geometry, material); part.position.set(x, y, z);
    part.castShadow = part.receiveShadow = true; parent.add(part); return part;
  }
  function box(w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number, parent = hull, radius = .04) {
    return mesh(radius <= .02 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 1, Math.min(radius, w / 3, h / 3, d / 3)), material, x, y, z, parent);
  }
  function cylinder(radius: number, length: number, material: THREE.Material, x: number, y: number, z: number, parent = hull) {
    return mesh(new THREE.CylinderGeometry(radius, radius, length, 16), material, x, y, z, parent);
  }
  // Continuous rounded track belts surround separate wheels, with raised shoes.
  for (const side of [-1, 1]) {
    const tread = new THREE.Shape();
    tread.moveTo(-1.65, .06); tread.lineTo(1.65, .06);
    tread.quadraticCurveTo(2.2, .06, 2.2, .58); tread.quadraticCurveTo(2.2, 1.1, 1.65, 1.1);
    tread.lineTo(-1.65, 1.1); tread.quadraticCurveTo(-2.2, 1.1, -2.2, .58); tread.quadraticCurveTo(-2.2, .06, -1.65, .06);
    const hole = new THREE.Path();
    hole.moveTo(-1.65, .25); hole.lineTo(1.65, .25);
    hole.quadraticCurveTo(2, .25, 2, .58); hole.quadraticCurveTo(2, .91, 1.65, .91);
    hole.lineTo(-1.65, .91); hole.quadraticCurveTo(-2, .91, -2, .58); hole.quadraticCurveTo(-2, .25, -1.65, .25);
    tread.holes.push(hole);
    const track = new THREE.ExtrudeGeometry(tread, {depth: .56, bevelEnabled: false, curveSegments: 5});
    track.translate(0, 0, -.28); mesh(track, rubber, 0, 0, side * 1.21);
    for (let i = 0; i < 14; i++) {
      const x = -1.69 + i * .26;
      for (const y of [.06, 1.1]) box(.16, .12, .58, steel, x, y, side * 1.21, hull, .015);
    }
    for (const end of [-1, 1]) for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 6;
      const shoe = box(.15, .12, .58, steel, end * (1.65 + Math.cos(a) * .575), .58 + Math.sin(a) * .52, side * 1.21, hull, .015);
      shoe.rotation.z = end * (a + Math.PI / 2);
    }
    for (let i = 0; i < 5; i++) {
      const x = -1.64 + i * .82;
      const wheel = cylinder(.37, .59, darkPaint, x, .58, side * 1.21); wheel.rotation.x = Math.PI / 2;
      const cap = cylinder(.19, .025, steel, x, .58, side * 1.495); cap.rotation.x = Math.PI / 2;
      const axle = cylinder(.065, .032, rubber, x, .58, side * 1.496); axle.rotation.x = Math.PI / 2;
    }
    box(4.3, .12, .36, darkPaint, 0, 1.18, side * 1.17);
  }
  const armor = new THREE.Shape();
  armor.moveTo(-2.1, .75); armor.lineTo(1.85, .75); armor.lineTo(2.1, 1.25);
  armor.lineTo(1.6, 1.58); armor.lineTo(-1.8, 1.58); armor.lineTo(-2.1, 1.22); armor.closePath();
  const armorGeometry = new THREE.ExtrudeGeometry(armor, {depth: 2.08, bevelEnabled: true, bevelThickness: .035, bevelSize: .035, bevelSegments: 1, steps: 1});
  armorGeometry.translate(0, 0, -1.04); mesh(armorGeometry, paint, 0, 0, 0);
  box(1.2, .09, 1.65, darkPaint, -1.31, 1.6, 0);
  for (let i = 0; i < 6; i++) box(.07, .035, 1.25, rubber, -1.75 + i * .17, 1.665, 0, hull, .008);
  for (const z of [-.7, .7]) {
    box(.12, .18, .3, steel, 2, 1.19, z);
    box(.035, .12, .22, light, 2.07, 1.2, z);
    box(.08, .13, .28, darkPaint, -2.13, 1, z);
  }
  cylinder(.79, .14, steel, -.35, 1.64, 0);
  const turret = new THREE.Group(); turret.name = 'turret'; turret.position.set(-.35, 1.72, 0); root.add(turret);
  box(1.75, .68, 1.6, paint, -.08, .35, 0, turret, .16);
  box(.42, .45, .65, darkPaint, .82, .38, 0, turret, .08);
  cylinder(.38, .12, darkPaint, -.36, .75, 0, turret);
  box(.3, .13, .15, glass, .23, .74, -.37, turret);
  box(.1, .1, .42, steel, -.35, .84, 0, turret);
  cylinder(.025, .65, steel, -.67, 1, .52, turret);
  for (const z of [-.82, .82]) for (const x of [-.62, 0, .58]) {
    const bolt = cylinder(.045, .025, steel, x, .34, z, turret); bolt.rotation.x = Math.PI / 2;
  }
  const barrelGroup = new THREE.Group(); barrelGroup.name = 'barrelGroup'; turret.add(barrelGroup);
  const barrel = cylinder(.15, 1.65, steel, 1.6, .4, 0, barrelGroup); barrel.rotation.z = -Math.PI / 2;
  const muzzle = cylinder(.205, .4, darkPaint, 2.45, .4, 0, barrelGroup); muzzle.rotation.z = -Math.PI / 2;
  const bore = cylinder(.116, .012, rubber, 2.647, .4, 0, barrelGroup); bore.rotation.z = -Math.PI / 2;
  mergeAssembly(hull); mergeAssembly(turret); mergeAssembly(barrelGroup);
  const muzzlePoint = new THREE.Object3D(); muzzlePoint.name = 'muzzle'; muzzlePoint.position.set(2.65, .4, 0); barrelGroup.add(muzzlePoint);
  // Fit the complete forward-facing model (including muzzle and hub caps) to
  // the gameplay footprint without moving its useful turret/muzzle pivots.
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  const normalized = new THREE.Group();
  for (const child of [...root.children]) normalized.add(child);
  normalized.scale.set(4.6 / size.x, 1, 3 / size.z);
  normalized.position.set(-center.x * normalized.scale.x, -bounds.min.y, -center.z * normalized.scale.z);
  root.add(normalized);
  const shieldDome = new THREE.Mesh(
    new THREE.SphereGeometry(2.65, 20, 14),
    new THREE.MeshStandardMaterial({color: '#6ce8ff', emissive: '#35bfff', emissiveIntensity: .65, transparent: true, opacity: .28, roughness: .15, depthWrite: false})
  );
  shieldDome.position.set(0, 1.35, 0);
  shieldDome.scale.set(1.1, .75, .92);
  shieldDome.visible = false;
  root.add(shieldDome);
  root.userData.dimensions = {x: 4.6, y: size.y, z: 3};
  root.userData.turret = turret; root.userData.barrelGroup = barrelGroup; root.userData.muzzle = muzzlePoint; root.userData.shieldDome = shieldDome;
  root.userData.assetSource = 'Original code-authored 3D tank';
  root.userData.forward = '+X'; root.userData.pivot = 'bottom-center';
  return root;
}

function loadTex(url: string): Promise<THREE.Texture | null> {
  return new Promise<THREE.Texture | null>(resolve => {
    new THREE.TextureLoader().load(url, tex => {
      tex.colorSpace = THREE.SRGBColorSpace;
      resolve(tex);
    }, undefined, () => resolve(null));
  });
}

/** Lazy per-game props. Fighter characters use the existing loadPlatformAssets()
 * rig/clip loader; this module intentionally does not download a second rig copy.
 */
export function loadActionAssets(game: string): Promise<ActionAssets> {
  const cached = gameCache.get(game);
  if (cached) return cached;
  const ids = actionAssetGroups[game] || [];
  const texFiles = game === 'tank-arena' ? tankTextureFiles : [];
  const pending = Promise.all([
    Promise.all(ids.map(async id => [id, await loadTemplate(id)] as const)),
    Promise.all(texFiles.map(async name => [name, await loadTex(`/models/action/tanks/${name}`)] as const)),
  ]).then(([entries, texEntries]) => {
    const templates = new Map(entries);
    const textures = new Map<string, THREE.Texture>();
    for (const [name, tex] of texEntries) if (tex) textures.set(name, tex);
    const dimensions: ActionAssets['dimensions'] = {};
    // Determine normalized bounds without creating GPU resources.
    for (const [id, source] of entries) {
      const model = source.clone(true), wrapper = new THREE.Group(); wrapper.add(model);
      wrapper.rotation.y = specs[id].rotate || 0; wrapper.updateMatrixWorld(true);
      const size = new THREE.Box3().setFromObject(wrapper).getSize(new THREE.Vector3());
      const scale = specs[id].scale ?? specs[id].size! / size[specs[id].axis!];
      dimensions[id] = {x: size.x * scale, y: size.y * scale, z: size.z * scale};
    }
    return {
      prop(id: string) {const source = templates.get(id); return source ? instantiate(id, source) : null;},
      tank,
      texture(name: string) {return textures.get(name) || null;},
      textures,
      propIds: [...ids],
      dimensions,
    } satisfies ActionAssets;
  }).catch(error => {gameCache.delete(game); throw error;});
  gameCache.set(game, pending);
  return pending;
}
