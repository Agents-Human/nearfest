import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

export type SoccerPlayer = {
  root: THREE.Group;
  /** World XZ heading: 0 = +X, PI/2 = +Z, PI = -X, -PI/2 = -Z. */
  face(angle: number): void;
  /** time is seconds; moving may be a boolean or a normalized stride intensity. */
  update(moving: boolean | number, kicking: boolean, time: number): void;
  dispose(): void;
};
export type SoccerAssets = {
  player(seat: number, size?: number): SoccerPlayer;
  /** Grounded root; the physical sphere centre is at y=radius. userData.roll(dx,dz) rolls its artwork. */
  ball(radius?: number): THREE.Group;
  /** Original supplied equipment artwork; normal +Z, bottom y=0. */
  flag(color?: 'green' | 'white', height?: number): THREE.Group;
  equipment(id: 'card-yellow' | 'card-red' | 'flag-green' | 'flag-white', size?: number): THREE.Group;
  teamColors: string[];
  teamNames: string[];
};
const names = ['blue', 'red', 'yellow', 'green'];
const colors = ['#419fdd', '#e86a17', '#ffcc00', '#2ecc71'];
const equipmentIds = ['ball', 'flag-green', 'flag-white', 'card-yellow', 'card-red'];
let cached: Promise<SoccerAssets> | undefined;

function ownTexture(source: THREE.Texture) {const copy = source.clone();copy.needsUpdate = true;return copy;}
function spriteMaterial(source: THREE.Texture) {
  return new THREE.MeshBasicMaterial({map: ownTexture(source), transparent: true, alphaTest: .08, depthWrite: true, side: THREE.DoubleSide, toneMapped: false});
}
function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
  const value = new THREE.Mesh(geometry, material);value.position.set(x, y, z);parent.add(value);return value;
}
function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  geometries.forEach(value => value.dispose());materials.forEach(value => value.dispose());textures.forEach(value => value.dispose());root.clear();
}
function shadow(radius: number, parent: THREE.Object3D) {
  const canvas = document.createElement('canvas');canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;const gradient = ctx.createRadialGradient(32, 32, 6, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(4,15,21,.38)');gradient.addColorStop(.55, 'rgba(4,15,21,.19)');gradient.addColorStop(1, 'rgba(4,15,21,0)');
  ctx.fillStyle = gradient;ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  const result = mesh(new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, toneMapped: false}), parent, 0, .014, 0);
  result.renderOrder = 1;return result;
}

function player(textures: Map<string, THREE.Texture>, seat: number, size: number): SoccerPlayer {
  const team = ((Math.floor(seat) % 4) + 4) % 4;
  const root = new THREE.Group();root.name = 'kenney-soccer-' + names[team];
  root.userData.team = team;root.userData.sourceForward = 'image-right';root.userData.localForward = '+X';
  const contact = shadow(size * .65, root);contact.scale.set(1, 1, .85);
  const bodyTexture = textures.get(names[team] + '-body')!;
  const armTexture = textures.get(names[team] + '-arm')!;
  // The source face and nose point image-right; -90° X places that direction on local +X.
  const bodyGeometry = new THREE.PlaneGeometry(size * 21 / 31, size).rotateX(-Math.PI / 2);
  const body = mesh(bodyGeometry, spriteMaterial(bodyTexture), root, 0, size * .105, 0);
  const arms: THREE.Group[] = [], boots: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();pivot.position.set(-size * .18, size * .082, side * size * .32);root.add(pivot);
    // Source arm sleeve lies left; hand lies right. Its natural extension is +X.
    mesh(new THREE.PlaneGeometry(size * .58, size * .58 * 13 / 19.75).rotateX(-Math.PI / 2), spriteMaterial(armTexture), pivot, size * .2);
    arms.push(pivot);
    const boot = mesh(new RoundedBoxGeometry(size * .24, size * .065, size * .13, 2, size * .025), new THREE.MeshStandardMaterial({color: '#14202a', roughness: .65}), root, -size * .24, size * .045, side * size * .20);
    boot.castShadow = true;boot.receiveShadow = true;boots.push(boot);
  }
  root.userData.radius = size * .5;
  let wasKicking = false, kickStart = -Infinity, disposed = false;
  const api: SoccerPlayer = {
    root,
    face(angle) {if (Number.isFinite(angle)) {root.rotation.y = -angle;root.userData.facingAngle = angle;}},
    update(moving, kicking, time) {
      if (disposed || !Number.isFinite(time)) return;
      const intensity = typeof moving === 'boolean' ? Number(moving) : THREE.MathUtils.clamp(moving, 0, 1);
      if (kicking && !wasKicking) kickStart = time;
      wasKicking = kicking;
      const phase = time * 11 + team * .6, stride = Math.sin(phase) * intensity;
      const progress = THREE.MathUtils.clamp((time - kickStart) / .28, 0, 1);
      const kick = progress < 1 ? Math.sin(progress * Math.PI) : 0;
      arms[0].rotation.y = .26 + stride * .48 - kick * .3;
      arms[1].rotation.y = -.26 - stride * .48 + kick * .45;
      boots[0].position.x = size * (-.24 + stride * .16);
      boots[1].position.x = size * (-.24 - stride * .16 + kick * .83);
      boots[1].position.y = size * (.045 + kick * .035);
      boots[1].rotation.y = kick * -.2;
      body.position.x = kick * size * .035;
      body.position.y = size * (.105 + Math.abs(stride) * .015);
      body.rotation.y = stride * .028;
    },
    dispose() {if (disposed) return;disposed = true;disposeObject(root);},
  };
  root.userData.dispose = api.dispose;
  api.update(false, false, 0);return api;
}

function sphereTexture(source: THREE.Texture) {
  const canvas = document.createElement('canvas');canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;ctx.fillStyle = '#ffffff';ctx.fillRect(0, 0, 256, 256);ctx.drawImage(source.image as CanvasImageSource, 0, 0, 256, 256);
  const map = new THREE.CanvasTexture(canvas);map.colorSpace = THREE.SRGBColorSpace;map.anisotropy = 4;return map;
}
function ball(source: THREE.Texture, radius: number): THREE.Group {
  const root = new THREE.Group();root.name = 'kenney-soccer-ball';shadow(radius * 1.35, root);
  const geometry = new THREE.SphereGeometry(radius, 32, 20), positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  // Project the original top-down soccer design onto a real sphere's two hemispheres.
  // This preserves the supplied panel artwork in the overhead camera without using a flat ball.
  for (let i = 0; i < positions.count; i++) uv.setXY(i, positions.getX(i) / (radius * 2) + .5, .5 - positions.getZ(i) / (radius * 2));
  const sphere = mesh(geometry, new THREE.MeshStandardMaterial({map: sphereTexture(source), roughness: .48, metalness: .02}), root, 0, radius);
  sphere.castShadow = true;sphere.receiveShadow = true;root.userData.radius = radius;root.userData.sphere = sphere;
  const axis = new THREE.Vector3();
  root.userData.roll = (dx: number, dz: number) => {
    const distance = Math.hypot(dx, dz);if (!Number.isFinite(distance) || distance < .0001) return;
    axis.set(dz, 0, -dx).normalize();sphere.rotateOnWorldAxis(axis, distance / radius);
  };
  root.userData.dispose = () => disposeObject(root);return root;
}
function equipment(source: THREE.Texture, size: number, name: string): THREE.Group {
  const root = new THREE.Group();root.name = 'kenney-soccer-' + name;
  const image = source.image as {width: number; height: number};
  const height = size, width = size * image.width / image.height;
  mesh(new THREE.PlaneGeometry(width, height), spriteMaterial(source), root, 0, height / 2);
  root.userData.dispose = () => disposeObject(root);return root;
}

/** Loads 13 sharp standalone vector assets extracted from the supplied CC0 pack. */
export function loadSoccerAssets(): Promise<SoccerAssets> {
  if (cached) return cached;
  const loader = new THREE.TextureLoader();
  const paths = [...names.flatMap(team => ['body', 'arm'].map(part => ({key: team + '-' + part, path: 'players/' + team + '-' + part + '.svg'}))), ...equipmentIds.map(id => ({key: id, path: 'equipment/' + id + '.svg'}))];
  cached = Promise.all(paths.map(async ({key, path}) => {
    const texture = await loader.loadAsync('/models/soccer/' + path);texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;return [key, texture] as const;
  })).then(entries => {
    const textures = new Map(entries);
    return {
      player(seat: number, size = 3) {return player(textures, seat, Math.max(.2, size));},
      ball(radius = .65) {return ball(textures.get('ball')!, Math.max(.05, radius));},
      flag(color: 'green' | 'white' = 'green', height = 3) {return equipment(textures.get('flag-' + color)!, height, 'flag-' + color);},
      equipment(id: 'card-yellow' | 'card-red' | 'flag-green' | 'flag-white', size = 1) {return equipment(textures.get(id)!, size, id);},
      teamColors: [...colors],teamNames: [...names],
    };
  }).catch(error => {cached = undefined;throw error;});
  return cached;
}
