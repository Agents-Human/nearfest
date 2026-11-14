import * as THREE from 'three';

/** The user's original CraftPix Yokai strips and vampire terrace.
 * Sprite strips are unmodified; the runtime terrace is resized/encoded to WebP.
 * License and source hashes: /models/fighters/provenance.json.
 * These are drawn side-view fighters, not recolored platformer rigs. */
export type FighterAction = 'idle' | 'run' | 'jump' | 'fall' | 'punch' | 'kick' | 'hurt' | 'block' | 'death';
export type FighterClip = {
  source: string;
  frames: number;
  fps: number;
  duration: number;
  loop: boolean;
  startFrame: number;
  endFrame: number;
};
export type FighterMetadata = {
  id: string;
  name: string;
  accent: string;
  frameSize: number;
  anchorX: number;
  groundY: number;
  bodyHeightPixels: number;
  idlePaintedBounds: readonly [number, number, number, number];
};
export type FighterCharacter = {
  root: THREE.Group;
  name: string;
  accent: string;
  metadata: FighterMetadata;
  clips: Record<FighterAction, FighterClip>;
  setAnimation(action: FighterAction, restart?: boolean): void;
  update(dt: number): void;
  face(direction: number): void;
  dispose(): void;
};
export type FighterAssets = {
  fighters: readonly FighterMetadata[];
  background: {
    url: string;
    width: number;
    height: number;
    groundY: number;
    worldWidth: number;
    worldHeight: number;
  };
  character(seat: number, bodyHeight?: number): FighterCharacter;
  /** Plane lies in XY, normal +Z, with a recommended painted floor at y=0. */
  backdrop(): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
};

export const fighterMetadata: readonly FighterMetadata[] = [
  {id: 'tengu', name: 'Yamabushi Tengu', accent: '#df6557', frameSize: 128, anchorX: 64, groundY: 128, bodyHeightPixels: 95, idlePaintedBounds: [18, 33, 99, 128]},
  {id: 'kitsune', name: 'Kitsune', accent: '#f2c657', frameSize: 128, anchorX: 64, groundY: 128, bodyHeightPixels: 79, idlePaintedBounds: [24, 49, 77, 128]},
];
const strips = ['idle', 'idle_2', 'run', 'jump', 'hurt', 'dead', 'attack_1', 'attack_2', 'attack_3'] as const;
type Strip = typeof strips[number];
const counts: Record<string, Record<Strip, number>> = {
  tengu: {idle: 6, idle_2: 5, run: 8, jump: 15, hurt: 3, dead: 6, attack_1: 3, attack_2: 6, attack_3: 4},
  kitsune: {idle: 8, idle_2: 6, run: 8, jump: 10, hurt: 2, dead: 10, attack_1: 10, attack_2: 10, attack_3: 7},
};

/** Durations match the server's .27s quick strike and .40s heavy attack.
 * The pack has no dedicated block animation; its alternate idle is the guard pose.
 * Jump is split into ascent and descent ranges so it follows authoritative motion. */
export function fighterClips(id: string): Record<FighterAction, FighterClip> {
  const count = counts[id];
  if (!count) throw new RangeError('Unknown fighter: ' + id);
  const clip = (source: Strip, duration: number, loop = false, startFrame = 0, endFrame = count[source] - 1): FighterClip => ({
    source, frames: count[source], fps: (endFrame - startFrame + 1) / duration, duration, loop, startFrame, endFrame,
  });
  const midJump = id === 'tengu' ? 7 : 5;
  return {
    idle: clip('idle', count.idle / 9, true),
    run: clip('run', .5, true),
    jump: clip('jump', .38, false, 0, midJump - 1),
    fall: clip('jump', .35, false, midJump, count.jump - 1),
    punch: clip(id === 'tengu' ? 'attack_1' : 'attack_3', .27),
    kick: clip(id === 'tengu' ? 'attack_2' : 'attack_1', .40),
    hurt: clip('hurt', .18),
    block: clip('idle_2', count.idle_2 / 7, true),
    death: clip('dead', .72),
  };
}

let pending: Promise<FighterAssets> | undefined;
export function loadFighterAssets(): Promise<FighterAssets> {
  if (pending) return pending;
  const loader = new THREE.TextureLoader();
  const ids = fighterMetadata.flatMap(fighter => strips.map(strip => `${fighter.id}/${strip}`));
  pending = Promise.all([
    ...ids.map(async id => {
      const texture = await loader.loadAsync(`/models/fighters/${id}.png`);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      return [id, texture] as const;
    }),
    loader.loadAsync('/models/fighters/vampire-terrace.webp').then(texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      return ['background', texture] as const;
    }),
  ]).then(entries => {
    const sources = new Map<string, THREE.Texture>(entries);
    return {
      fighters: fighterMetadata,
      background: {url: '/models/fighters/vampire-terrace.webp', width: 1920, height: 1080, groundY: 777.5, worldWidth: 160, worldHeight: 90},
      character(seat: number, bodyHeight = 10): FighterCharacter {
        const meta = fighterMetadata[((Math.trunc(seat) % fighterMetadata.length) + fighterMetadata.length) % fighterMetadata.length];
        const clips = fighterClips(meta.id);
        // Texture instances own animation UV state while sharing immutable decoded images.
        const textures = new Map<Strip, THREE.Texture>();
        for (const strip of strips) {
          const texture = sources.get(`${meta.id}/${strip}`)!.clone();
          texture.repeat.set(1 / counts[meta.id][strip], 1);
          texture.needsUpdate = true;
          textures.set(strip, texture);
        }
        const scale = bodyHeight / meta.bodyHeightPixels;
        const geometry = new THREE.PlaneGeometry(meta.frameSize * scale, meta.frameSize * scale);
        const material = new THREE.MeshBasicMaterial({map: textures.get('idle'), transparent: true, alphaTest: .02, depthWrite: false, side: THREE.DoubleSide, toneMapped: false});
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `${meta.id}-animated-sprite`;
        mesh.position.set((meta.frameSize / 2 - meta.anchorX) * scale, (meta.groundY - meta.frameSize / 2) * scale, 0);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.renderOrder = 10;
        const root = new THREE.Group();
        root.name = 'craftpix-' + meta.id;
        root.add(mesh);
        root.userData.assetSource = 'CraftPix Yokai Pixel Art Character Sprites';
        root.userData.frameAnchor = {x: meta.anchorX, y: meta.groundY};
        root.userData.bodyHeight = bodyHeight;
        let action: FighterAction = 'idle', elapsed = 0, disposed = false;
        const setFrame = () => {
          const clip = clips[action], count = clip.endFrame - clip.startFrame + 1;
          const frame = clip.startFrame + (clip.loop ? Math.floor(elapsed * clip.fps) % count : Math.min(count - 1, Math.floor(elapsed * clip.fps)));
          const texture = textures.get(clip.source as Strip)!;
          texture.offset.x = frame / clip.frames;
          material.map = texture;
          root.userData.animationState = action;
          root.userData.animationFrame = frame;
        };
        setFrame();
        return {
          root, name: meta.name, accent: meta.accent, metadata: meta, clips,
          setAnimation(next, restart = false) {
            if (next === action && !restart) return;
            action = next;elapsed = 0;setFrame();
          },
          update(dt) {elapsed += Math.max(0, Math.min(.1, dt));setFrame();},
          face(direction) {root.scale.x = direction < 0 ? -1 : 1;},
          dispose() {
            if (disposed) return;
            disposed = true;
            geometry.dispose();material.dispose();textures.forEach(texture => texture.dispose());
          },
        };
      },
      backdrop() {
        const texture = sources.get('background')!.clone();texture.needsUpdate = true;
        const material = new THREE.MeshBasicMaterial({map: texture, toneMapped: false, depthWrite: false});
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(160, 90), material);
        mesh.name = 'craftpix-vampire-terrace';
        mesh.position.set(0, 90 * (777.5 / 1080 - .5), -20);
        mesh.castShadow = mesh.receiveShadow = false;
        mesh.renderOrder = -10;
        mesh.userData.assetSource = 'CraftPix Free Vampires Locations Battle Background Pack / terrace';
        return mesh;
      },
    } satisfies FighterAssets;
  }).catch(error => {pending = undefined;throw error;});
  return pending;
}
