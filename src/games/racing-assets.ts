import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

/** Selected CC0 Kenney assets from kenney_car-kit, kenney_racing-kit, and kenney_racing-pack. */
export type RacingVehicle =
  | 'race'
  | 'race-future'
  | 'sedan-sports'
  | 'hatchback-sports'
  | 'suv-luxury'
  | 'kart-oobi'
  | 'kart-oodi'
  | 'kart-ooli'
  | 'kart-oopi'
  | 'kart-oozi'
  | 'sedan'
  | 'suv'
  | 'truck'
  | 'van'
  | 'police'
  | 'taxi'
  | 'ambulance'
  | 'firetruck'
  | 'delivery'
  | 'tractor';

export type RacingDebris =
  | 'debris-tire'
  | 'debris-bumper'
  | 'debris-spoiler-a'
  | 'debris-door'
  | 'box';

export type RacingAssets = {
  vehicle(color: string, variant?: RacingVehicle): THREE.Group;
  debris(id: RacingDebris): THREE.Group | null;
  prop(id: string): THREE.Group | null;
  sprite(id: string): THREE.Texture | null;
  explosionFrames: THREE.Texture[];
  propIds: string[];
};

type PropSpec = {axis: 'x' | 'y'; size: number; lengthZ?: number};

const props: Record<string, PropSpec> = {
  barrier: {axis: 'x', size: 3.2},
  'barrier-white': {axis: 'x', size: 3.2},
  'barrier-wall': {axis: 'x', size: 3.8},
  cone: {axis: 'y', size: 1.4},
  pylon: {axis: 'y', size: 1.6},
  rail: {axis: 'x', size: 6},
  'rail-double': {axis: 'y', size: 1.8},
  'fence-straight': {axis: 'x', size: 16},
  grandstand: {axis: 'x', size: 10},
  'grandstand-awning': {axis: 'x', size: 10},
  garage: {axis: 'x', size: 8.5},
  'pits-office': {axis: 'x', size: 8.5},
  gantry: {axis: 'x', size: 10},
  archway: {axis: 'x', size: 11},
  flag: {axis: 'y', size: 6.5},
  'banner-green': {axis: 'y', size: 8.5},
  'banner-red': {axis: 'y', size: 8.5},
  billboard: {axis: 'x', size: 9},
  lamp: {axis: 'y', size: 7.5},
  'light-large': {axis: 'y', size: 9},
  tent: {axis: 'x', size: 7},
  'race-tree-large': {axis: 'y', size: 9.5},
  'race-tree-small': {axis: 'y', size: 7},
  'road-start': {axis: 'x', size: 44, lengthZ: 32},
  'road-race': {axis: 'x', size: 44, lengthZ: 32},
  'road-race-arrow': {axis: 'x', size: 44, lengthZ: 32},
  'road-race-bridge': {axis: 'x', size: 44, lengthZ: 32},
  'road-race-pit': {axis: 'x', size: 44, lengthZ: 32},
  'road-race-end': {axis: 'x', size: 44, lengthZ: 32},
  'grass-tile': {axis: 'x', size: 32, lengthZ: 32},
};

const debrisSpecs: Record<RacingDebris, PropSpec> = {
  'debris-tire': {axis: 'y', size: 1.15},
  'debris-bumper': {axis: 'x', size: 2.1},
  'debris-spoiler-a': {axis: 'x', size: 2.0},
  'debris-door': {axis: 'x', size: 1.8},
  box: {axis: 'y', size: 1.4},
};

const variants: RacingVehicle[] = [
  'race',
  'race-future',
  'sedan-sports',
  'hatchback-sports',
  'suv-luxury',
  'kart-oobi',
  'kart-oodi',
  'kart-ooli',
  'kart-oopi',
  'kart-oozi',
  'sedan',
  'suv',
  'truck',
  'van',
  'police',
  'taxi',
  'ambulance',
  'firetruck',
  'delivery',
  'tractor',
];

const debrisList: RacingDebris[] = [
  'debris-tire',
  'debris-bumper',
  'debris-spoiler-a',
  'debris-door',
  'box',
];

const spriteIds = [
  'oil',
  'barrel_red',
  'barrel_blue',
  'tires_red',
  'tires_white',
  'arrow_yellow',
  'arrow_white',
  'skidmark_long_1',
  'lights',
];

const paintColumn: Partial<Record<RacingVehicle, number>> = {
  race: 6,
  'race-future': 7,
  'sedan-sports': 6,
  'hatchback-sports': 3,
  'suv-luxury': 4,
  sedan: 6,
  truck: 3,
  van: 7,
};

let cached: Promise<RacingAssets> | undefined;

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
    const isKart = variant.startsWith('kart-');
    const targetLen = isKart ? 4.1 : variant === 'firetruck' || variant === 'truck' ? 5.2 : 4.5;
    const targetWid = isKart ? 2.45 : 2.25;
    const lengthScale = targetLen / Math.max(0.1, dimensions.z);
    transform.makeRotationY(Math.PI / 2).multiply(
      new THREE.Matrix4().makeScale(targetWid / Math.max(0.1, dimensions.x), lengthScale, lengthScale)
    );
  } else {
    const scale = spec!.size / Math.max(0.1, dimensions[spec!.axis]);
    const scaleZ = spec!.lengthZ ? spec!.lengthZ / Math.max(0.1, dimensions.z) : scale;
    transform.makeScale(scale, scale, scaleZ);
  }
  const bounds = sourceBounds.clone().applyMatrix4(transform);
  const center = bounds.getCenter(new THREE.Vector3());
  return new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z).multiply(transform);
}

function instance(source: THREE.Group, options: {variant?: RacingVehicle; color?: string; prop?: PropSpec}): THREE.Group {
  const root = new THREE.Group();
  const transform = normalization(source, options.variant, options.prop);
  const textureCopies = new Map<THREE.Texture, THREE.Texture>();
  const materialCopies = new Map<THREE.Material, THREE.Material>();
  const wheelGroups = new Map<THREE.Object3D, THREE.Group>();
  const frontWheelGroups: THREE.Group[] = [];
  let driverGroup: THREE.Group | undefined;
  let bodyPaint: THREE.Texture | undefined;
  const col = options.variant ? paintColumn[options.variant] : undefined;

  const copyMaterial = (sourceMaterial: THREE.Material, body: boolean): THREE.Material => {
    if (!body && materialCopies.has(sourceMaterial)) return materialCopies.get(sourceMaterial)!;
    const copy = sourceMaterial.clone();
    for (const [key, value] of Object.entries(sourceMaterial)) {
      if (!(value instanceof THREE.Texture)) continue;
      if (!textureCopies.has(value)) textureCopies.set(value, value.clone());
      (copy as unknown as Record<string, unknown>)[key] = textureCopies.get(value)!;
    }
    if (copy instanceof THREE.MeshStandardMaterial) {
      copy.roughness = body ? .42 : /glass/.test(copy.name) ? .25 : .68;
      if (body && copy.map && options.variant && options.color && col !== undefined) {
        bodyPaint ||= paintedAtlas(copy.map, options.color, col);
        copy.map = bodyPaint;
      }
    }
    if (!body) materialCopies.set(sourceMaterial, copy);
    return copy;
  };

  source.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    let wheel: THREE.Object3D | undefined;
    let isCharacter = false;
    let body = false;
    for (let ancestor: THREE.Object3D | null = object; ancestor && ancestor !== source; ancestor = ancestor.parent) {
      if (/^wheel-(?:front|back)/.test(ancestor.name)) wheel = ancestor;
      if (ancestor.name === 'character') isCharacter = true;
      if (ancestor.name === 'body' || ancestor.name === 'spoiler') body = true;
    }
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(transform, object.matrixWorld));
    const materials = Array.isArray(object.material) ? object.material.map(m => copyMaterial(m, body)) : copyMaterial(object.material, body);
    const part = new THREE.Mesh(geometry, materials);
    part.name = object.name;
    part.castShadow = true;
    part.receiveShadow = true;
    if (options.variant && wheel) {
      let pivot = wheelGroups.get(wheel);
      if (!pivot) {
        pivot = new THREE.Group();
        pivot.name = wheel.name;
        pivot.position.copy(wheel.getWorldPosition(new THREE.Vector3())).applyMatrix4(transform);
        wheelGroups.set(wheel, pivot);
        if (/^wheel-front/.test(wheel.name)) frontWheelGroups.push(pivot);
        root.add(pivot);
      }
      geometry.translate(-pivot.position.x, -pivot.position.y, -pivot.position.z);
      pivot.add(part);
    } else if (options.variant && isCharacter) {
      if (!driverGroup) {
        driverGroup = new THREE.Group();
        driverGroup.name = 'driver';
        driverGroup.position.set(0, 0.7, 0);
        root.add(driverGroup);
      }
      geometry.translate(-driverGroup.position.x, -driverGroup.position.y, -driverGroup.position.z);
      driverGroup.add(part);
    } else {
      root.add(part);
    }
  });

  root.name = options.variant ? 'kenney-' + options.variant : 'kenney-track-prop';
  root.userData.assetSource = 'Kenney / CC0-1.0';
  if (options.variant) {
    root.userData.wheels = [...wheelGroups.values()];
    root.userData.frontWheels = frontWheelGroups;
    if (driverGroup) root.userData.driver = driverGroup;
  }
  return root;
}

export function loadRacingAssets(): Promise<RacingAssets> {
  if (cached) return cached;
  const loader = new GLTFLoader();
  const texLoader = new THREE.TextureLoader();

  const glbTasks = ['race','race-future','sedan-sports','hatchback-sports','sedan','taxi','suv'].map(id => ({id:'vehicle:'+id,url:'/models/racing/vehicles/'+id+'.glb'}));

  const loadTex = (url: string): Promise<THREE.Texture | null> =>
    texLoader.loadAsync(url).then((tex): THREE.Texture => {
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }).catch(() => null);

  cached = Promise.all([
    Promise.all(glbTasks.map(async task => [task.id, (await loader.loadAsync(task.url)).scene] as const)),
    Promise.resolve([] as (readonly [string, THREE.Texture | null])[]),
    Promise.resolve([] as (THREE.Texture | null)[]),
  ]).then(([glbEntries, spriteEntries, expFrames]): RacingAssets => {
    const templates = new Map(glbEntries);
    const sprites = new Map<string, THREE.Texture>();
    for (const [id, tex] of spriteEntries) {
      if (tex) sprites.set(id, tex);
    }
    const explosionFrames: THREE.Texture[] = [];
    for (const tex of expFrames) {
      if (tex) explosionFrames.push(tex);
    }
    return {
      vehicle(color: string, variant: RacingVehicle = 'kart-oobi') {
        const tpl = templates.get('vehicle:' + variant) || templates.get('vehicle:kart-oobi')!;
        return instance(tpl, {variant, color});
      },
      debris(id: RacingDebris) {
        const tpl = templates.get('debris:' + id);
        return tpl && debrisSpecs[id] ? instance(tpl, {prop: debrisSpecs[id]}) : null;
      },
      prop(id: string) {
        const template = templates.get('prop:' + id);
        return template && props[id] ? instance(template, {prop: props[id]}) : null;
      },
      sprite(id: string) {
        return sprites.get(id) || null;
      },
      explosionFrames,
      propIds: Object.keys(props),
    };
  }).catch(error => {
    cached = undefined;
    throw error;
  });
  return cached!;
}
