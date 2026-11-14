import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Original, code-authored art. All dimensions are in metres; feet touch y=0. */
export const palette = ['#ff765d', '#a68bff', '#65dfb5', '#ffd166', '#64cfff', '#f995cb'];
const dark = '#172d3b';
const materials = new Map<string, THREE.MeshStandardMaterial>();
function material(color: string, roughness = .72, metalness = 0) {
  const key = `${color}/${roughness}/${metalness}`;
  let value = materials.get(key);
  if (!value) { value = new THREE.MeshStandardMaterial({color, roughness, metalness}); materials.set(key, value); }
  return value;
}
/** Merge each static material batch; preserve named groups used by animation. */
function pack(group: THREE.Group) {
  const batches = new Map<THREE.Material, THREE.Mesh[]>();
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
    const batch = batches.get(child.material) || [];
    batch.push(child); batches.set(child.material, batch);
  }
  for (const [mat, batch] of batches) {
    if (batch.length < 2) continue;
    const parts = batch.map(part => {
      part.updateMatrix();
      const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
      return geometry.applyMatrix4(part.matrix);
    });
    const geometry = mergeGeometries(parts);
    if (geometry) {
      for (const part of batch) {group.remove(part); part.geometry.dispose();}
      group.add(mesh(geometry, mat));
    }
    for (const part of parts) part.dispose();
  }
  return group;
}
function mesh(geometry: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const value = new THREE.Mesh(geometry, mat);
  value.position.set(x, y, z);
  value.castShadow = true;
  value.receiveShadow = true;
  return value;
}
function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, radius = .08) {
  return mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)), mat, x, y, z);
}
export function modelBox(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0) {
  return box(w, h, d, material(color), x, y, z);
}
function sphere(r: number, mat: THREE.Material, x = 0, y = 0, z = 0, detail = 14) {
  return mesh(new THREE.SphereGeometry(r, detail, Math.max(8, Math.floor(detail * .65))), mat, x, y, z);
}
function cylinder(top: number, bottom: number, height: number, mat: THREE.Material, x = 0, y = 0, z = 0, sides = 10) {
  return mesh(new THREE.CylinderGeometry(top, bottom, height, sides), mat, x, y, z);
}
function rod(from: THREE.Vector3, to: THREE.Vector3, radius: number, mat: THREE.Material) {
  const value = cylinder(radius, radius, from.distanceTo(to), mat);
  value.position.copy(from).add(to).multiplyScalar(.5);
  value.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  return value;
}

/** +X is forward. Wheel groups rotate around their local Z axis. */
export function car(color: string): THREE.Group {
  const root = new THREE.Group();
  root.name = 'touring-racer';
  const paint = new THREE.MeshPhysicalMaterial({color, roughness: .28, metalness: .34, clearcoat: .8, clearcoatRoughness: .2});
  const rubber = material('#15202b', .94);
  const trim = material('#263340', .4, .6);
  const ivory = material('#fff7dc', .42, .15);
  const silver = material('#cbd9df', .25, .8);
  const glass = new THREE.MeshStandardMaterial({color: '#123b53', roughness: .16, metalness: .62});
  const headlight = new THREE.MeshStandardMaterial({color: '#fff5c4', emissive: '#ffe3a0', emissiveIntensity: .65});
  const tail = new THREE.MeshStandardMaterial({color: '#ff332f', emissive: '#e72b18', emissiveIntensity: .6});
  root.add(box(4.2, .45, 1.91, trim, 0, .52, 0, .16));
  root.add(box(4.25, .62, 1.87, paint, 0, .91, 0, .22));
  root.add(box(1.35, .25, 1.8, paint, 1.38, 1.2, 0, .1));
  root.add(box(.55, .22, 1.95, trim, 1.94, .5, 0, .06));
  root.add(box(.5, .28, 1.86, trim, -1.96, .55));
  // Sloped panoramic cockpit, bevelled roof, pillars and rear window.
  const silhouette = new THREE.Shape();
  silhouette.moveTo(-1.18, 1.12);
  silhouette.lineTo(-.75, 1.93);
  silhouette.lineTo(.48, 1.93);
  silhouette.lineTo(1.12, 1.12);
  silhouette.closePath();
  const cabin = mesh(new THREE.ExtrudeGeometry(silhouette, {depth: 1.48, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .08, bevelThickness: .07}), glass, 0, 0, -.74);
  root.add(cabin, box(1.25, .13, 1.49, paint, -.13, 1.99, 0));
  for (const z of [-.79, .79]) {
    root.add(rod(new THREE.Vector3(.52, 1.94, z), new THREE.Vector3(1.16, 1.16, z), .055, paint));
    root.add(rod(new THREE.Vector3(-.8, 1.94, z), new THREE.Vector3(-1.23, 1.16, z), .06, paint));
    root.add(rod(new THREE.Vector3(-.25, 1.94, z), new THREE.Vector3(-.25, 1.14, z), .045, trim));
    root.add(box(.32, .17, .25, paint, .76, 1.35, z * 1.23));
    root.add(box(.3, .055, .045, silver, -.48, 1.02, z * 1.2));
    root.add(box(.16, .18, .33, headlight, 2.12, .99, z * .8));
    root.add(box(.08, .17, .4, tail, -2.15, 1.02, z * .77));
    // Narrow twin racing stripes continue over bonnet, roof and rear deck.
    root.add(box(1.27, .025, .12, ivory, 1.39, 1.338, z * .26, .007));
    root.add(box(1.17, .025, .12, ivory, -.13, 2.064, z * .26, .007));
    root.add(box(.7, .025, .12, ivory, -1.7, 1.229, z * .26, .007));
  }
  root.add(box(.08, .26, .9, rubber, 2.155, .69));
  for (let i = -2; i <= 2; i++) root.add(box(.03, .2, .035, silver, 2.2, .69, i * .14));
  // Supported rear wing rather than a floating rectangle.
  for (const z of [-.65, .65]) root.add(box(.13, .5, .1, trim, -1.73, 1.45, z));
  root.add(box(.49, .13, 2.14, paint, -1.8, 1.73, 0));
  for (const z of [-1.07, 1.07]) root.add(box(.49, .32, .065, paint, -1.8, 1.8, z));
  const wheels: THREE.Object3D[] = [];
  for (const x of [-1.28, 1.3]) for (const z of [-.98, .98]) {
    const wheel = new THREE.Group();
    wheel.position.set(x, .48, z);
    const tire = cylinder(.48, .48, .39, rubber, 0, 0, 0, 20);
    tire.rotation.x = Math.PI / 2;
    const rim = cylinder(.29, .29, .405, silver, 0, 0, 0, 12);
    rim.rotation.x = Math.PI / 2;
    const inner = cylinder(.2, .2, .42, trim, 0, 0, 0, 12);
    inner.rotation.x = Math.PI / 2;
    wheel.add(tire, rim, inner);
    for (let j = 0; j < 5; j++) {
      const a = j * Math.PI * 2 / 5;
      const spoke = box(.28, .05, .018, silver, Math.cos(a) * .12, Math.sin(a) * .12, Math.sign(z) * .22, .01);
      spoke.rotation.z = a;
      wheel.add(spoke);
    }
    root.add(pack(wheel));
    wheels.push(wheel);
  }
  root.userData.wheels = wheels;
  return pack(root);
}

/** Animated adventurer. Joints swing around Z; the character faces +X. */
export function explorer(color: string): THREE.Group {
  const root = new THREE.Group();
  root.name = 'trail-explorer';
  const suit = material(color, .48);
  const cream = material('#fff5dc', .72);
  const trim = material(dark, .65);
  const shoe = material('#263947', .85);
  const glass = material('#19394d', .16, .3);
  const gold = material('#ffd46d', .4, .25);
  root.add(box(1.22, 1.55, 1.35, suit, 0, 2.3, 0, .25));
  root.add(box(.16, 1.05, .94, cream, .61, 2.4, 0, .07));
  root.add(box(.2, .3, .4, gold, .72, 2.66, 0));
  root.add(box(1.31, .2, 1.37, trim, 0, 1.75));
  root.add(box(.17, .23, .28, gold, .69, 1.77));
  // Backpack with straps, rolled bed mat, and an antenna.
  root.add(box(.52, 1.3, 1.06, material('#bd7353'), -.76, 2.37, 0, .17));
  root.add(box(.18, .67, .8, material('#754b3c'), -1.04, 2.25));
  const bedroll = cylinder(.23, .23, 1.2, material('#b0c689'), -.86, 3.06);
  bedroll.rotation.x = Math.PI / 2;
  root.add(bedroll);
  for (const z of [-.43, .43]) root.add(box(1.55, .13, .1, cream, -.04, 2.85, z));
  const head = sphere(.96, suit, .03, 3.77, 0, 20);
  head.scale.set(.95, 1, 1.06);
  root.add(head);
  const visorFrame = sphere(.79, cream, .48, 3.78, 0, 18);
  visorFrame.scale.set(.66, .72, 1.14);
  const visor = sphere(.71, glass, .64, 3.79, 0, 18);
  visor.scale.set(.62, .64, 1.14);
  root.add(visorFrame, visor);
  // Eyes are visible from the side camera and identify the character's facing.
  for (const z of [-.31, .31]) {
    const eye = sphere(.1, cream, 1.04, 3.82, z, 10);
    eye.scale.set(.28, 1.25, .7);
    root.add(eye);
  }
  const glint = sphere(.12, material('#a9e8f4'), .99, 4.02, -.32, 10);
  glint.scale.set(.2, .4, 1.6);
  root.add(glint);
  root.add(box(.7, .13, 1.35, cream, .48, 4.43, 0));
  for (const z of [-.99, .99]) {
    const ear = cylinder(.24, .24, .16, cream, .02, 3.76, z, 14);
    ear.rotation.x = Math.PI / 2;
    root.add(ear);
  }
  const scarfMat = material('#ffe2a1');
  root.add(box(.95, .25, 1.35, scarfMat, .02, 3.04));
  const scarf = box(.75, .2, .4, scarfMat, -.91, 2.98, .45);
  scarf.rotation.z = -.25;
  root.add(scarf);
  const limb = (z: number, arm: boolean) => {
    const joint = new THREE.Group();
    joint.position.set(arm ? 0 : -.02, arm ? 2.9 : 1.65, z);
    if (arm) {
      const sleeve = cylinder(.24, .2, .72, suit, 0, -.34);
      sleeve.rotation.z = .08;
      joint.add(sleeve, sphere(.25, cream, 0, -.78));
    } else {
      joint.add(cylinder(.25, .23, 1, suit, 0, -.45));
      joint.add(box(.74, .42, .57, shoe, .16, -1.43, 0, .14));
      joint.add(cylinder(.22, .2, .45, cream, 0, -1.05));
      joint.add(box(.73, .1, .59, cream, .17, -1.6, 0, .04));
    }
    root.add(pack(joint));
    return joint;
  };
  root.userData.leftLeg = limb(-.4, false);
  root.userData.rightLeg = limb(.4, false);
  root.userData.leftArm = limb(-.88, true);
  root.userData.rightArm = limb(.88, true);
  root.userData.scarf = scarf;
  // Keep the scarf available for secondary animation.
  root.remove(scarf);
  pack(root);
  root.add(scarf);
  return root;
}

export function tree(kind: 'pine' | 'palm' | 'broadleaf', height: number): THREE.Group {
  const root = new THREE.Group();
  root.name = `${kind}-tree`;
  const bark = material(kind === 'palm' ? '#b28b61' : '#795447');
  if (kind === 'pine') {
    root.add(cylinder(.17, .35, height * .72, bark, 0, height * .36));
    const colors = ['#155b50', '#217b60', '#349368', '#66b776'];
    for (let i = 0; i < 4; i++) {
      const foliage = mesh(new THREE.ConeGeometry(height * (.26 - i * .044), height * .44, 9), material(colors[i]), 0, height * (.4 + i * .14));
      foliage.rotation.y = i * .73;
      root.add(foliage);
    }
  } else if (kind === 'broadleaf') {
    root.add(cylinder(.22, .44, height * .68, bark, 0, height * .34));
    for (const [x, z] of [[-.22, .03], [.2, -.13], [.05, .22]]) {
      root.add(rod(new THREE.Vector3(0, height * .3, 0), new THREE.Vector3(x * height, height * .7, z * height), height * .035, bark));
    }
    const colors = ['#428b58', '#67ad65', '#86c975', '#57a16a', '#96cc74'];
    for (let i = 0; i < 7; i++) {
      const a = i * 2.39996, radius = i === 6 ? 0 : height * .19;
      const crown = mesh(new THREE.IcosahedronGeometry(height * (i === 6 ? .25 : .235), 1), material(colors[i % colors.length]), Math.cos(a) * radius, height * (i === 6 ? .83 : .66 + (i % 2) * .08), Math.sin(a) * radius);
      crown.scale.set(1.05, .88 + i % 3 * .1, 1);
      crown.rotation.set(i * .2, a, .13);
      root.add(crown);
    }
  } else {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-height * .03, height * .32, 0), new THREE.Vector3(height * .07, height * .68, 0), new THREE.Vector3(height * .16, height * .86, 0)]);
    root.add(mesh(new THREE.TubeGeometry(curve, 8, height * .035, 7, false), bark));
    const top = curve.getPoint(1);
    const greens = ['#31875c', '#4a9f64', '#72b95e'];
    for (let leaf = 0; leaf < 7; leaf++) {
      const a = leaf * Math.PI * 2 / 7;
      const positions: number[] = [], indices: number[] = [], uvs: number[] = [];
      const length = height * (.4 + (leaf % 3) * .035);
      for (let i = 0; i <= 6; i++) {
        const t = i / 6, spread = Math.sin(t * Math.PI) * height * .068;
        const x = Math.cos(a) * length * t;
        const z = Math.sin(a) * length * t;
        const y = Math.sin(t * Math.PI * .85) * height * .16 - t * t * height * .2;
        for (const side of [-1, 1]) {
          positions.push(x - Math.sin(a) * spread * side, y - Math.abs(spread) * .16, z + Math.cos(a) * spread * side);
          uvs.push(t, (side + 1) / 2);
        }
        if (i < 6) {const j = i * 2;indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);}
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);geometry.computeVertexNormals();
      const mat = material(greens[leaf % greens.length]);mat.side = THREE.DoubleSide;
      const frond = mesh(geometry, mat);frond.position.copy(top);root.add(frond);
    }
    for (let i = 0; i < 3; i++) root.add(sphere(height * .045, material('#71503a'), top.x + Math.cos(i * 2.1) * height * .045, top.y - height * .025, Math.sin(i * 2.1) * height * .045, 8));
  }
  return pack(root);
}

export function rock(size: number, color = '#829285'): THREE.Group {
  const root = new THREE.Group();root.name = 'weathered-rock';
  const stone = mesh(new THREE.DodecahedronGeometry(size * .53, 0), material(color), 0, size * .33, 0);
  stone.scale.set(1.2, .72, .9);stone.rotation.set(.18, .72, .1);
  root.add(stone);
  const moss = mesh(new THREE.DodecahedronGeometry(size * .26, 0), material('#70995d'), -size * .15, size * .6, 0);
  moss.scale.set(1.5, .14, 1.15);root.add(moss);
  return root;
}

export function crystal(color = '#7ce5f4'): THREE.Group {
  const root = new THREE.Group();root.name = 'sky-crystal';
  const mat = new THREE.MeshPhysicalMaterial({color, roughness: .16, metalness: .25, emissive: color, emissiveIntensity: .25, clearcoat: 1, flatShading: true});
  const core = mesh(new THREE.OctahedronGeometry(.64, 0), mat, 0, .55, 0);
  core.scale.set(.7, 1.4, .7);root.add(core);
  const band = mesh(new THREE.TorusGeometry(.38, .035, 5, 16), material('#ffe19a', .3, .6), 0, .55);
  band.rotation.x = Math.PI / 2;root.add(band);
  return root;
}

/** Freestanding, legible sign with canvas-authored lettering; faces +Z. */
export function sign(text: string, color = '#164b47', width = 8): THREE.Group {
  const root = new THREE.Group();root.name = 'world-sign';
  const frame = material('#fff0ce', .6);
  const post = material('#71574b');
  const height = width * .29;
  for (const x of [-width * .37, width * .37]) root.add(box(.22, 4, .22, post, x, 2));
  root.add(box(width + .25, height + .25, .28, frame, 0, 4, 0, .1));
  const canvas = document.createElement('canvas');canvas.width = 1024;canvas.height = 320;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;ctx.fillRect(0, 0, 1024, 320);
  ctx.strokeStyle = '#fff0ce';ctx.lineWidth = 3;ctx.strokeRect(18, 18, 988, 284);
  ctx.fillStyle = '#fff5df';ctx.font = `800 ${text.length > 19 ? 65 : text.length > 13 ? 80 : 98}px sans-serif`;
  ctx.textAlign = 'center';ctx.textBaseline = 'middle';ctx.fillText(text, 512, 164, 940);
  const texture = new THREE.CanvasTexture(canvas);texture.colorSpace = THREE.SRGBColorSpace;
  const panel = mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({map: texture, roughness: .65}), 0, 4, .15);
  panel.castShadow = false;root.add(panel);
  return root;
}

/** Actual gold coin, centred at the origin. Both embossed faces look along ±Z. */
export function coin(): THREE.Group {
  const root = new THREE.Group();root.name = 'gold-star-coin';
  const gold = material('#f4b92d', .27, .78);
  const polished = material('#ffe78b', .2, .7);
  const inset = material('#d99417', .34, .68);
  const disc = cylinder(.7, .7, .24, gold, 0, 0, 0, 32);
  disc.rotation.x = Math.PI / 2;root.add(disc);
  // A raised lip catches light even when the face is viewed obliquely.
  for (const side of [-1, 1]) {
    const centre = cylinder(.565, .565, .016, inset, 0, 0, side * .126, 28);
    centre.rotation.x = Math.PI / 2;root.add(centre);
    root.add(mesh(new THREE.TorusGeometry(.599, .037, 6, 28), polished, 0, 0, side * .135));
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 ? .155 : .355;
      if (i === 0) star.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
      else star.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    }
    star.closePath();
    const badge = mesh(new THREE.ExtrudeGeometry(star, {depth: .025, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 1, steps: 1}), polished, 0, 0, side * .142);
    if (side < 0) badge.rotation.y = Math.PI;
    root.add(badge);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      root.add(sphere(.025, polished, Math.cos(a) * .485, Math.sin(a) * .485, side * .148, 6));
    }
  }
  for (let i = 0; i < 28; i++) {
    const a = i * Math.PI * 2 / 28;
    const ridge = mesh(new THREE.BoxGeometry(.024, .055, .2), polished, Math.cos(a) * .696, Math.sin(a) * .696);
    ridge.rotation.z = a - Math.PI / 2;root.add(ridge);
  }
  return pack(root);
}

/** Natural floating terrain. Width is X, depth is 10; the walkable top is y=0. */
export function island(width: number, seed: number): THREE.Group {
  const root = new THREE.Group();root.name = 'floating-garden-island';
  const w = Math.max(2.5, width), half = w / 2, ringSize = 20;
  let value = ((seed + 1) * 2654435761) >>> 0;
  const rand = () => {value ^= value << 13;value ^= value >>> 17;value ^= value << 5;return (value >>> 0) / 4294967296;};
  const turf = material('#7eab60');
  const moss = material('#9dc878');
  const mossDark = material('#527d4e');
  const strata = [material('#8a9c86'), material('#7a8b79'), material('#64766c'), material('#596b65'), material('#4a605b')];
  const roots = material('#695e43');
  const stemMat = material('#497b45');
  const greens = [material('#709c53'), material('#9ac76b'), material('#bad780')];
  // Superellipse perimeter keeps a broad usable top, with irregular stone sides.
  const outline = Array.from({length: ringSize}, (_, i) => {
    const a = i / ringSize * Math.PI * 2;
    return new THREE.Vector2(Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** .45 * half, Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** .48 * 5);
  });
  const rings: THREE.Vector3[][] = [];
  const levels = [0, -.45, -1.9, -4.4, -7.4, -10];
  const scales = [1, 1, .95, .8, .47, .08];
  const offset = (rand() - .5) * Math.min(2, w * .15);
  levels.forEach((y, level) => {
    rings.push(outline.map((p, i) => {
      const irregularity = level < 2 ? 1 : .92 + rand() * .17;
      return new THREE.Vector3(p.x * scales[level] * irregularity + offset * level / 5, y + (level < 2 ? 0 : (rand() - .5) * .8), p.y * scales[level] * irregularity + Math.sin(i * 1.3 + seed) * (level < 2 ? 0 : .2));
    }));
  });
  function surface(vertices: THREE.Vector3[], indices: number[], mat: THREE.Material) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flatMap(p => [p.x, p.y, p.z]), 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(vertices.flatMap(p => [p.x / w + .5, p.z / 10 + .5]), 2));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    root.add(mesh(geometry.toNonIndexed(), mat));geometry.dispose();
  }
  const topIndices: number[] = [];
  for (let i = 0; i < ringSize; i++) topIndices.push(0, 1 + (i + 1) % ringSize, 1 + i);
  surface([new THREE.Vector3(), ...rings[0]], topIndices, turf);
  for (let level = 0; level < rings.length - 1; level++) {
    const indices: number[] = [];
    for (let i = 0; i < ringSize; i++) {
      const next = (i + 1) % ringSize;
      indices.push(i, next, ringSize + i, next, ringSize + next, ringSize + i);
    }
    surface([...rings[level], ...rings[level + 1]], indices, level === 0 ? moss : strata[level - 1]);
  }
  // The mineral strata break into exposed shelves and angular detached teeth.
  for (let i = 0; i < Math.max(5, Math.floor(w * .7)); i++) {
    const side = i % 2 ? -1 : 1, x = (rand() - .5) * w * .85, y = -1.5 - rand() * 4.4;
    const shard = mesh(new THREE.DodecahedronGeometry(.6 + rand() * .7, 0), strata[i % strata.length], x, y, side * (4.4 - Math.abs(y) * .15));
    shard.scale.set(1 + rand() * 1.8, .2 + rand() * .3, .4 + rand() * .5);shard.rotation.y = rand() * .8;root.add(shard);
  }
  // Low clumps of moss spill over the rim, without putting obstacles in the lane.
  for (let i = 0; i < Math.max(8, Math.floor(w)); i++) {
    const x = (rand() - .5) * w * .9, z = (i % 2 ? -1 : 1) * (4.2 + rand() * .5);
    const clump = mesh(new THREE.IcosahedronGeometry(.45 + rand() * .4, 0), i % 2 ? moss : mossDark, x, -.15, z);
    clump.scale.set(1.6, .42, 1);root.add(clump);
  }
  // Vines have small leaf pairs and follow the crags instead of hanging as rods.
  for (let i = 0; i < Math.max(4, Math.floor(w / 2)); i++) {
    const x = (rand() - .5) * w * .86, side = i % 2 ? -1 : 1, length = 2.8 + rand() * 4;
    const points = [new THREE.Vector3(x, -.15, side * 4.7), new THREE.Vector3(x + .2, -length * .3, side * 4.85), new THREE.Vector3(x - .35, -length * .65, side * 4.4), new THREE.Vector3(x + .1, -length, side * 4.1)];
    const vine = new THREE.CatmullRomCurve3(points);
    root.add(mesh(new THREE.TubeGeometry(vine, 7, .045, 4, false), roots));
    for (let j = 1; j <= 4; j++) {
      const p = vine.getPoint(j / 5);
      for (const direction of [-1, 1]) {
        const leaf = mesh(new THREE.OctahedronGeometry(.19, 0), j % 2 ? mossDark : greens[0], p.x + direction * .13, p.y + .02, p.z);
        leaf.scale.set(1.2, .36, .6);leaf.rotation.z = direction * .55;root.add(leaf);
      }
    }
  }
  // Tufted blades lean outward at the front and rear edges; z≈0 remains clear.
  for (let i = 0; i < Math.max(14, Math.floor(w * 1.6)); i++) {
    const x = (rand() - .5) * w * .9, z = (i % 2 ? -1 : 1) * (3.45 + rand() * .9);
    const h = .3 + rand() * .55;
    for (let blade = 0; blade < 3; blade++) {
      const a = blade * 2.1 + rand(), dx = Math.cos(a), dz = Math.sin(a), bend = .12 + rand() * .15;
      const positions = [x - dz * .055, 0, z + dx * .055, x + dz * .055, 0, z - dx * .055, x + dx * bend, h, z + dz * bend];
      const geometry = new THREE.BufferGeometry();geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, .5, 1], 2));geometry.computeVertexNormals();
      const mat = greens[(i + blade) % greens.length];mat.side = THREE.DoubleSide;root.add(mesh(geometry, mat));
    }
  }
  const petals = [material('#ffcd83'), material('#f6a6b4'), material('#c4bbf1'), material('#fff3c0')];
  for (let i = 0; i < Math.max(5, Math.floor(w * .5)); i++) {
    const x = (rand() - .5) * w * .86, z = (i % 2 ? -1 : 1) * (3.4 + rand() * .55), h = .35 + rand() * .45;
    root.add(cylinder(.018, .024, h, stemMat, x, h / 2, z, 4));
    root.add(sphere(.055, material('#ffcf4a'), x, h, z, 6));
    for (let j = 0; j < 5; j++) {
      const a = j * Math.PI * 2 / 5, petal = sphere(.09, petals[i % petals.length], x + Math.cos(a) * .08, h + .005, z + Math.sin(a) * .08, 6);
      petal.scale.y = .35;root.add(petal);
    }
  }
  return pack(root);
}
