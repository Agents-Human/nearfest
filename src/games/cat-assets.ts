import * as THREE from 'three';

/** Original CraftPix Cat Defense artwork. Runtime atlases sample original animation
 * frames, crop their shared transparent margin, and pack without redrawing/tinting.
 * Full source paths, hashes and encoding details: /models/cats/provenance.json. */
export type CatAction = 'idle' | 'shoot' | 'walk' | 'attack' | 'dead';
export type CatEnemyKind = 'runner' | 'brute' | 'boss';
export type CatClip = {start: number; count: number; duration: number; loop: boolean};
export type CatSpriteMetadata = {
  id: string; name: string; url: string;
  width: number; height: number; frameWidth: number; frameHeight: number; columns: number; frameCount: number;
  anchorX: number; groundY: number; bodyHeightPixels: number; nativeFacing: number;
  clips: Partial<Record<CatAction, CatClip>>;
  originalFrame: [number, number]; trimBounds: [number, number, number, number];
};
export type CatSprite = {
  root: THREE.Group;
  metadata: CatSpriteMetadata;
  setAnimation(action: CatAction, restart?: boolean): void;
  update(dt: number): void;
  /** Positive faces right, negative faces left; source orientations differ. */
  face(direction: number): void;
  dispose(): void;
};
export type CatBackground = {
  url: string; width: number; height: number;
  playableRect: {left: number; top: number; right: number; bottom: number};
  barrierX: number; catX: number; lanesY: number[];
  healthBar: {x: number; y: number; width: number; height: number};
};
type CatIcon = {url: string; width: number; height: number};
type Manifest = {characters: Record<string, CatSpriteMetadata>; background: CatBackground; icons: Record<'coin' | 'projectile', CatIcon>};
export type CatAssets = {
  background: CatBackground;
  characters: Record<string, CatSpriteMetadata>;
  cat(seat: number, bodyHeight?: number): CatSprite;
  enemy(kind: CatEnemyKind, bodyHeight?: number): CatSprite;
  backdrop(worldWidth?: number): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  coin(size?: number): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  projectile(width?: number): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
};

let pending: Promise<CatAssets> | undefined;
export function loadCatAssets(): Promise<CatAssets> {
  if (pending) return pending;
  pending = fetch('/models/cats/atlas.json').then(async response => {
    if (!response.ok) throw new Error('The cat-defense atlas could not be loaded.');
    const manifest = await response.json() as Manifest;
    const loader = new THREE.TextureLoader();
    const urls = [...Object.values(manifest.characters).map(sprite => sprite.url), manifest.background.url, ...Object.values(manifest.icons).map(icon => icon.url)];
    const entries = await Promise.all(urls.map(async url => {
      const texture = await loader.loadAsync(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      return [url, texture] as const;
    }));
    const sources = new Map(entries);
    function sprite(id: string, bodyHeight: number): CatSprite {
      const meta = manifest.characters[id];
      if (!meta) throw new RangeError('Unknown cat-defense sprite: ' + id);
      const texture = sources.get(meta.url)!.clone();
      texture.repeat.set(meta.frameWidth / meta.width, meta.frameHeight / meta.height);
      texture.needsUpdate = true;
      const scale = bodyHeight / meta.bodyHeightPixels;
      const geometry = new THREE.PlaneGeometry(meta.frameWidth * scale, meta.frameHeight * scale);
      const material = new THREE.MeshBasicMaterial({map: texture, transparent: true, alphaTest: .015, depthWrite: false, side: THREE.DoubleSide, toneMapped: false});
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set((meta.frameWidth / 2 - meta.anchorX) * scale, (meta.groundY - meta.frameHeight / 2) * scale, 0);
      mesh.castShadow = mesh.receiveShadow = false;
      mesh.renderOrder = 10;
      const root = new THREE.Group();
      root.name = 'craftpix-cat-defense-' + id;
      root.add(mesh);
      root.userData.assetSource = 'CraftPix Cartoon Cat Defense Kit';
      root.userData.bodyHeight = bodyHeight;
      let action: CatAction = 'idle', elapsed = 0, disposed = false;
      function frame() {
        const clip = meta.clips[action] || meta.clips.idle!;
        const offset = Math.floor(elapsed / clip.duration * clip.count);
        const index = clip.start + (clip.loop ? offset % clip.count : Math.min(clip.count - 1, offset));
        texture.offset.set(index % meta.columns * meta.frameWidth / meta.width, 1 - (Math.floor(index / meta.columns) + 1) * meta.frameHeight / meta.height);
        root.userData.animationState = action;
        root.userData.animationFrame = index;
      }
      frame();
      return {
        root, metadata: meta,
        setAnimation(next, restart = false) {
          const available = meta.clips[next] ? next : 'idle';
          if (action === available && !restart) return;
          action = available;elapsed = 0;frame();
        },
        update(dt) {elapsed += Math.max(0, Math.min(.1, dt));frame();},
        face(direction) {root.scale.x = (direction < 0 ? -1 : 1) / meta.nativeFacing;},
        dispose() {
          if (disposed) return;
          disposed = true;texture.dispose();geometry.dispose();material.dispose();
        },
      };
    }
    function image(url: string, width: number, height: number, transparent: boolean) {
      const texture = sources.get(url)!.clone();texture.needsUpdate = true;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({map: texture, transparent, alphaTest: transparent ? .015 : 0, depthWrite: !transparent, side: THREE.DoubleSide, toneMapped: false}));
      mesh.castShadow = mesh.receiveShadow = false;return mesh;
    }
    return {
      background: manifest.background,
      characters: manifest.characters,
      cat(seat, bodyHeight = 8) {return sprite('cat-' + ((((Math.trunc(seat) % 4) + 4) % 4) + 1), bodyHeight);},
      enemy(kind, bodyHeight = kind === 'boss' ? 13 : kind === 'brute' ? 10 : 8.5) {return sprite(kind, bodyHeight);},
      backdrop(worldWidth = 160) {
        const mesh = image(manifest.background.url, worldWidth, worldWidth * manifest.background.height / manifest.background.width, false);
        mesh.name = 'craftpix-cat-defense-street';mesh.position.z = -5;mesh.renderOrder = -10;return mesh;
      },
      coin(size = 1.8) {
        const icon = manifest.icons.coin, mesh = image(icon.url, size * icon.width / icon.height, size, true);
        mesh.name = 'craftpix-cat-gold-coin';mesh.renderOrder = 20;return mesh;
      },
      projectile(width = 1.6) {
        const icon = manifest.icons.projectile, mesh = image(icon.url, width, width * icon.height / icon.width, true);
        mesh.name = 'craftpix-cat-shot';mesh.renderOrder = 15;return mesh;
      },
    } satisfies CatAssets;
  }).catch(error => {pending = undefined;throw error;});
  return pending;
}
