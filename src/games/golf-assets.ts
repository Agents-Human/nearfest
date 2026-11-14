import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

/** Original supplied Kenney Minigolf Kit 3.1, CC0. See /models/golf/README.md.
 * Grid cells are 10 × 10; +Y is up, +Z south, +X east. The grass surface is y=0.
 * These meshes do not install physics: use the matching metadata below.
 */
export const GOLF_TILE_SIZE = 10;
export type GolfTileId = 'open' | 'straight' | 'corner' | 'start' | 'end' | 'hole-open' | 'side';
export type GolfPropId = 'rail' | 'triangle' | 'diamond' | 'tunnel' | 'bump';
export type GolfPoint = readonly [x: number, z: number];
export type GolfDimensions = {x: number; y: number; z: number};
export type GolfWall = readonly [minX: number, minZ: number, maxX: number, maxZ: number];
export type GolfTileMetadata = {
  /** Solid curb footprints in local coordinates. All curbs rise 5/6 above grass. */
  walls: readonly GolfWall[];
  /** The supplied start tile slopes down toward +Z; other floor surfaces are flat. */
  surface: 'flat' | 'start-ramp';
  cup?: {x: number; z: number; radius: number; depth: number};
};

export const golfTileMetadata: Readonly<Record<GolfTileId, GolfTileMetadata>> = {
  open: {walls: [], surface: 'flat'},
  straight: {walls: [[-5, -5, -4, 5], [4, -5, 5, 5]], surface: 'flat'},
  corner: {walls: [[4, -5, 5, 5], [-5, 4, 4, 5]], surface: 'flat'},
  start: {walls: [[-5, -5, -4, 0], [4, -5, 5, 0]], surface: 'start-ramp'},
  end: {walls: [[-5, -5, -4, 5], [4, -5, 5, 5], [-4, 4, 4, 5]], surface: 'flat'},
  'hole-open': {walls: [], surface: 'flat', cup: {x: 0, z: 0, radius: 2 / 3, depth: 19 / 60}},
  side: {walls: [[4, -5, 5, 5]], surface: 'flat'},
};

const SOURCE_HALF = 0.49994999170303345;
const SOURCE_SURFACE = 0.06332699954509735;
const SOURCE_SCALE = 5 / SOURCE_HALF;
const railHeight = 5 / 6;
const triangleCenter = (0.276047 + 0.025) / 2;
const polygon = (points: readonly GolfPoint[], offset = 0): readonly GolfPoint[] => points.map(
  ([x, z]) => [(x - offset) * SOURCE_SCALE, (z - offset) * SOURCE_SCALE] as const,
);

/** Exact beveled footprints, rather than bounding boxes that obstruct open routes.
 * Triangle is ONE of the two source obstacles, recentered for independent placement.
 * Tunnel opening is a polygon in X/Y, extruded from z=-4 to z=4. Its side pieces
 * and roof are solid; do not use the whole 8×8 footprint as a collision rectangle.
 * Bump is a walkable, 24-sided raised surface, not a vertical solid cylinder.
 */
export const golfPropMetadata = {
  rail: {kind: 'polygon', height: railHeight, points: [[-.5, -5], [.5, -5], [.5, 5], [-.5, 5]] as readonly GolfPoint[]},
  triangle: {
    kind: 'polygon', height: railHeight,
    points: polygon([[.251047, .025], [.276047, .035355], [.276047, .251047], [.251047, .276047], [.035355, .276047], [.025, .251047]], triangleCenter),
  },
  diamond: {
    kind: 'polygon', height: railHeight,
    points: polygon([[.017678, -.247591], [.247591, -.017678], [.247591, .017678], [.017678, .247591], [-.017678, .247591], [-.247591, .017678], [-.247591, -.017678], [-.017678, -.247591]]),
  },
  tunnel: {
    kind: 'arch', width: 8, length: 8, height: 7 / 3,
    /** [x, ceilingY]; mirrored around X=0. At y=0, passage is -2 < x < 2. */
    opening: [[-2, 0], [-1.625473, .854925], [-.908441, 1.452445], [0, 5 / 3], [.908441, 1.452445], [1.625473, .854925], [2, 0]] as const,
    maxBallDiameterAtCenter: 5 / 3,
  },
  bump: {kind: 'slope', outerRadius: 3, plateauRadius: 1.5, height: 1 / 3, sides: 24},
} as const;

/** Height of the supplied 24-sided bump, including its flat center plateau. */
export function golfBumpHeight(x: number, z: number): number {
  const step = Math.PI / 12;
  const angle = ((Math.atan2(z, x) % step) + step) % step;
  const polygonRadius = Math.hypot(x, z) * Math.cos(angle - step / 2) / Math.cos(step / 2);
  return Math.max(0, Math.min(1, (3 - polygonRadius) / 1.5)) / 3;
}

/** The original start tile drops 19/30 below the common grass plane on +Z. */
export function golfStartHeight(z: number): number {
  return z <= 0 ? 0 : -Math.min(1, z / 5) * 19 / 30;
}

export type GolfAssets = {
  tile(id?: string): THREE.Group | null;
  prop(id: string): THREE.Group | null;
  tileIds: readonly GolfTileId[];
  propIds: readonly GolfPropId[];
  dimensions: Readonly<Record<string, GolfDimensions>>;
};

const tileIds = Object.keys(golfTileMetadata) as GolfTileId[];
const propIds = Object.keys(golfPropMetadata) as GolfPropId[];
const propSources: Record<GolfPropId, string> = {
  rail: 'side', triangle: 'obstacle-triangle', diamond: 'obstacle-diamond', tunnel: 'tunnel-wide', bump: 'bump',
};
const EPSILON = 1e-6;
type Vertex = {position: THREE.Vector3; normal: THREE.Vector3; uv: THREE.Vector2};

function interpolate(a: Vertex, b: Vertex, alpha: number): Vertex {
  return {
    position: a.position.clone().lerp(b.position, alpha),
    normal: a.normal.clone().lerp(b.normal, alpha).normalize(),
    uv: a.uv.clone().lerp(b.uv, alpha),
  };
}

/** Clip a triangle at the grass plane, so extracted rails do not drag a floor
 * slab with them. Attribute interpolation retains the original atlas and shading.
 */
function aboveGrass(vertices: Vertex[]): Vertex[] {
  const result: Vertex[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const from = vertices[i];
    const to = vertices[(i + 1) % vertices.length];
    const insideFrom = from.position.y >= SOURCE_SURFACE - EPSILON;
    const insideTo = to.position.y >= SOURCE_SURFACE - EPSILON;
    if (insideFrom) result.push(from);
    if (insideFrom !== insideTo) {
      result.push(interpolate(from, to, (SOURCE_SURFACE - from.position.y) / (to.position.y - from.position.y)));
    }
  }
  return result;
}

function extractObstacle(geometry: THREE.BufferGeometry, id: GolfPropId): THREE.BufferGeometry {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  const index = geometry.index;
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [];
  const count = index?.count ?? position.count;
  for (let offset = 0; offset < count; offset += 3) {
    const triangle: Vertex[] = [];
    for (let corner = 0; corner < 3; corner++) {
      const i = index ? index.getX(offset + corner) : offset + corner;
      triangle.push({
        position: new THREE.Vector3().fromBufferAttribute(position, i),
        normal: new THREE.Vector3().fromBufferAttribute(normal, i),
        uv: new THREE.Vector2(uv.getX(i), uv.getY(i)),
      });
    }
    if (Math.max(...triangle.map(v => v.position.y)) <= SOURCE_SURFACE + EPSILON) continue;
    if (id === 'triangle' && !triangle.every(v => v.position.x > 0 && v.position.z > 0)) continue;
    // This atlas column identifies the cream arch, excluding its green floor and orange rails.
    if (id === 'tunnel' && !triangle.every(v => Math.abs(v.uv.x - .09375) < EPSILON)) continue;
    const clipped = aboveGrass(triangle);
    for (let i = 1; i + 1 < clipped.length; i++) {
      for (const vertex of [clipped[0], clipped[i], clipped[i + 1]]) {
        positions.push(vertex.position.x, vertex.position.y, vertex.position.z);
        normals.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
        uvs.push(vertex.uv.x, vertex.uv.y);
      }
    }
  }
  const extracted = new THREE.BufferGeometry();
  extracted.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  extracted.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  extracted.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  extracted.computeBoundingBox();
  extracted.computeBoundingSphere();
  return extracted;
}

function prepare(source: THREE.Group, propId?: GolfPropId): THREE.Group {
  const copy = source.clone(true);
  if (propId) {
    copy.traverse(object => {
      if (object instanceof THREE.Mesh) object.geometry = extractObstacle(object.geometry, propId);
    });
  }
  copy.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(copy);
  if (bounds.isEmpty() || !Number.isFinite(bounds.max.y)) throw new Error('Invalid minigolf model geometry.');
  const center = bounds.getCenter(new THREE.Vector3());
  const normalized = new THREE.Group();
  normalized.scale.setScalar(SOURCE_SCALE);
  normalized.position.set(-center.x * SOURCE_SCALE, -SOURCE_SURFACE * SOURCE_SCALE, -center.z * SOURCE_SCALE);
  normalized.add(copy);
  const root = new THREE.Group();
  root.add(normalized);
  return root;
}

/** Every returned instance owns its geometries, materials and texture handles.
 * Texture.clone() intentionally shares the immutable texture Source UUID. A
 * match can dispose its model safely while the cached template and replay live on.
 */
function instance(template: THREE.Group, id: string, kind: 'tile' | 'prop'): THREE.Group {
  const copy = template.clone(true);
  const geometries = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  const materials = new Map<THREE.Material, THREE.Material>();
  const textures = new Map<THREE.Texture, THREE.Texture>();
  const materialCopy = (source: THREE.Material) => {
    let material = materials.get(source);
    if (material) return material;
    material = source.clone();
    for (const [key, value] of Object.entries(source)) {
      if (!(value instanceof THREE.Texture)) continue;
      if (!textures.has(value)) {
        const texture = value.clone();
        texture.anisotropy = 4;
        texture.needsUpdate = true;
        textures.set(value, texture);
      }
      (material as unknown as Record<string, unknown>)[key] = textures.get(value);
    }
    materials.set(source, material);
    return material;
  };
  copy.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!geometries.has(object.geometry)) geometries.set(object.geometry, object.geometry.clone());
    object.geometry = geometries.get(object.geometry)!;
    object.material = Array.isArray(object.material) ? object.material.map(materialCopy) : materialCopy(object.material);
    object.castShadow = true;
    object.receiveShadow = true;
  });
  copy.name = `kenney-golf-${kind}-${id}`;
  copy.userData.assetSource = 'Kenney Minigolf Kit 3.1 / CC0-1.0';
  copy.userData.assetId = id;
  copy.userData.pivot = kind === 'tile' ? 'grass-center' : 'bottom-center';
  copy.userData.tileSize = GOLF_TILE_SIZE;
  copy.userData.collision = kind === 'tile' ? golfTileMetadata[id as GolfTileId] : golfPropMetadata[id as GolfPropId];
  return copy;
}

let cached: Promise<GolfAssets> | undefined;

/** Small selected pack only. A failed request is retryable. Windmill, castle,
 * golf ball and flag are already supplied by loadSceneryAssets('mini-golf').
 */
export function loadGolfAssets(): Promise<GolfAssets> {
  if (cached) return cached;
  const files = [...new Set<string>([...tileIds, ...Object.values(propSources)])];
  const loader = new GLTFLoader();
  cached = Promise.all(files.map(async id => [id, (await loader.loadAsync(`/models/golf/${id}.glb`)).scene] as const)).then(entries => {
    const sources = new Map(entries);
    const tiles = new Map(tileIds.map(id => [id, prepare(sources.get(id)!)]));
    const props = new Map(propIds.map(id => [id, prepare(sources.get(propSources[id])!, id)]));
    const dimensions = Object.fromEntries([...tiles, ...props].map(([id, model]) => {
      model.updateMatrixWorld(true);
      const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      const dimensions = {x: size.x, y: size.y, z: size.z};
      model.userData.dimensions = dimensions;
      return [id, dimensions];
    }));
    return {
      tileIds: [...tileIds], propIds: [...propIds], dimensions,
      tile(id = 'open') {
        const source = tiles.get(id as GolfTileId);
        return source ? instance(source, id, 'tile') : null;
      },
      prop(id: string) {
        const source = props.get(id as GolfPropId);
        return source ? instance(source, id, 'prop') : null;
      },
    } satisfies GolfAssets;
  }).catch(error => {cached = undefined; throw error;});
  return cached;
}
