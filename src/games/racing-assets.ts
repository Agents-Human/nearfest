import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

/** Selected CC0 Kenney assets. Exact original paths/hashes: /models/racing/provenance.json. */
export type RacingVehicle = 'race' | 'sedan' | 'truck' | 'van';
export type RacingAssets = {
  vehicle(color: string, variant?: RacingVehicle): THREE.Group;
  prop(id: string): THREE.Group | null;
  propIds: string[];
};

type PropSpec = {axis: 'x' | 'y'; size: number};
// All props stand at y=0 and are centred in X/Z. Fronts face +Z; rails/gantry span X.
// Stretch gantry.scale.x to 3.2 for a 32m road without inflating its 5.51m height.
const props: Record<string, PropSpec> = {
  barrier: {axis: 'x', size: 3},
  cone: {axis: 'y', size: 1.4},
  rail: {axis: 'x', size: 6},
  grandstand: {axis: 'x', size: 8},
  garage: {axis: 'x', size: 7},
  gantry: {axis: 'x', size: 10},
  flag: {axis: 'y', size: 6},
  billboard: {axis: 'x', size: 8},
  lamp: {axis: 'y', size: 7},
};
const variants: RacingVehicle[] = ['race', 'sedan', 'truck', 'van'];
const paintColumn: Record<RacingVehicle, number> = {race: 6, sedan: 6, truck: 3, van: 7};
let cached: Promise<RacingAssets> | undefined;

/** Change only the two proven paint swatches in the body's 8×8 colour atlas.
 * Windows, tyres, rims, lights, undercarriage and all wheel materials retain their source colours. */
function paintedAtlas(source: THREE.Texture, color: string, column: number): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx || !source.image) throw new Error('The racing colour atlas could not be prepared.');
  ctx.drawImage(source.image as CanvasImageSource, 0, 0, 512, 512);
  const pixels = ctx.getImageData(column * 64, 2 * 64, 64, 128);
  const reference = ctx.getImageData(column * 64 + 32, 2 * 64 + 32, 1, 1).data;
  const brightness = reference[0] * .2126 + reference[1] * .7152 + reference[2] * .0722;
  const hex = new THREE.Color(color).getHex(THREE.SRGBColorSpace);
  const target = [hex >> 16 & 255, hex >> 8 & 255, hex & 255];
  for (let i = 0; i < pixels.data.length; i += 4) {
    const shade = THREE.MathUtils.clamp((pixels.data[i] * .2126 + pixels.data[i + 1] * .7152 + pixels.data[i + 2] * .0722) / Math.max(1, brightness), .65, 1.15);
    for (let c = 0; c < 3; c++) pixels.data[i + c] = Math.min(255, Math.round(target[c] * shade));
  }
  ctx.putImageData(pixels, column * 64, 2 * 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'Kenney body paint / ' + color;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = source.flipY;
  texture.wrapS = source.wrapS;texture.wrapT = source.wrapT;
  texture.magFilter = source.magFilter;texture.minFilter = source.minFilter;
  texture.repeat.copy(source.repeat);texture.offset.copy(source.offset);texture.center.copy(source.center);
  texture.rotation = source.rotation;texture.channel = source.channel;texture.anisotropy = 4;
  return texture;
}

function normalization(source: THREE.Group, variant?: RacingVehicle, spec?: PropSpec): THREE.Matrix4 {
  source.updateMatrixWorld(true);
  const sourceBounds = new THREE.Box3().setFromObject(source);
  const dimensions = sourceBounds.getSize(new THREE.Vector3());
  const transform = new THREE.Matrix4();
  if (variant) {
    // Source cars point +Z and wheels turn about X. Bake +90° Y so runtime faces +X.
    // Y/Z share a scale to keep wheel circles round; tyre width is fitted separately.
    const lengthScale = 4.4 / dimensions.z;
    transform.makeRotationY(Math.PI / 2).multiply(new THREE.Matrix4().makeScale(2.2 / dimensions.x, lengthScale, lengthScale));
  } else {
    const scale = spec!.size / dimensions[spec!.axis];
    transform.makeScale(scale, scale, scale);
  }
  const bounds = sourceBounds.clone().applyMatrix4(transform);
  const center = bounds.getCenter(new THREE.Vector3());
  return new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z).multiply(transform);
}

/** Bake source transforms into fresh geometry while retaining real wheel pivots.
 * Every returned model owns its geometry/material/texture handles, so scene disposal
 * cannot invalidate the cached source templates or another returned model. */
function instance(source: THREE.Group, options: {variant?: RacingVehicle; color?: string; prop?: PropSpec}): THREE.Group {
  const root = new THREE.Group();
  const transform = normalization(source, options.variant, options.prop);
  const textureCopies = new Map<THREE.Texture, THREE.Texture>();
  const materialCopies = new Map<THREE.Material, THREE.Material>();
  const wheelGroups = new Map<THREE.Object3D, THREE.Group>();
  let bodyPaint: THREE.Texture | undefined;
  const copyMaterial = (sourceMaterial: THREE.Material, body: boolean): THREE.Material => {
    if (!body && materialCopies.has(sourceMaterial)) return materialCopies.get(sourceMaterial)!;
    const copy = sourceMaterial.clone();
    for (const [key, value] of Object.entries(sourceMaterial)) {
      if (!(value instanceof THREE.Texture)) continue;
      if (!textureCopies.has(value)) textureCopies.set(value, value.clone());
      (copy as unknown as Record<string, unknown>)[key] = textureCopies.get(value)!;
    }
    if (copy instanceof THREE.MeshStandardMaterial) {
      copy.roughness = body ? .48 : /glass/.test(copy.name) ? .3 : .74;
      if (body && copy.map && options.variant && options.color) {
        bodyPaint ||= paintedAtlas(copy.map, options.color, paintColumn[options.variant]);
        copy.map = bodyPaint;
      }
    }
    if (!body) materialCopies.set(sourceMaterial, copy);
    return copy;
  };
  source.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    let wheel: THREE.Object3D | undefined;
    let body = false;
    for (let ancestor: THREE.Object3D | null = object; ancestor && ancestor !== source; ancestor = ancestor.parent) {
      if (/^wheel-(?:front|back)/.test(ancestor.name)) wheel = ancestor;
      if (ancestor.name === 'body') body = true;
    }
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(transform, object.matrixWorld));
    const materials = Array.isArray(object.material) ? object.material.map(m => copyMaterial(m, body)) : copyMaterial(object.material, body);
    const part = new THREE.Mesh(geometry, materials);
    part.name = object.name;part.castShadow = true;part.receiveShadow = true;
    if (options.variant && wheel) {
      let pivot = wheelGroups.get(wheel);
      if (!pivot) {
        pivot = new THREE.Group();pivot.name = wheel.name;
        pivot.position.copy(wheel.getWorldPosition(new THREE.Vector3())).applyMatrix4(transform);
        wheelGroups.set(wheel, pivot);root.add(pivot);
      }
      geometry.translate(-pivot.position.x, -pivot.position.y, -pivot.position.z);
      pivot.add(part);
    } else root.add(part);
  });
  root.name = options.variant ? 'kenney-' + options.variant : 'kenney-track-prop';
  root.userData.assetSource = 'Kenney / CC0-1.0';
  if (options.variant) root.userData.wheels = [...wheelGroups.values()];
  return root;
}

/** Load only the selected 13 GLBs (~0.85MB), once. A failed load is retryable. */
export function loadRacingAssets(): Promise<RacingAssets> {
  if (cached) return cached;
  const loader = new GLTFLoader();
  const tasks = [
    ...variants.map(id => ({id: 'vehicle:' + id, url: '/models/racing/vehicles/' + id + '.glb'})),
    ...Object.keys(props).map(id => ({id: 'prop:' + id, url: '/models/racing/props/' + id + '.glb'})),
  ];
  cached = Promise.all(tasks.map(async task => [task.id, (await loader.loadAsync(task.url)).scene] as const)).then(entries => {
    const templates = new Map(entries);
    return {
      vehicle(color: string, variant: RacingVehicle = 'race') {
        return instance(templates.get('vehicle:' + variant)!, {variant, color});
      },
      prop(id: string) {
        const template = templates.get('prop:' + id);
        return template && props[id] ? instance(template, {prop: props[id]}) : null;
      },
      propIds: Object.keys(props),
    };
  }).catch(error => {cached = undefined;throw error;});
  return cached;
}
