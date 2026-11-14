import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Original solid geometry for the board room. No global mutable resources.
 * Each factory result owns all geometry/materials; dispose by traversing it.
 * Chess/checker/disc/seed bases are y=0. A bowl's rim is y=0, its cavity below.
 * Chess IDs match the rules engine: ±1 pawn, ±2 knight, ±3 bishop, ±4 rook,
 * ±5 queen, ±6 king. Positive is ivory, negative is ink blue. */
const IVORY = '#e8d9b9', INK = '#36271f', BRASS = '#8d6d43';
const Y = new THREE.Vector3(0, 1, 0);
type Finish = {body: THREE.MeshPhysicalMaterial; brass: THREE.MeshStandardMaterial; felt: THREE.MeshStandardMaterial; engraving: THREE.MeshStandardMaterial};
function finish(light: boolean): Finish {
  return {
    body: new THREE.MeshPhysicalMaterial({color: light ? IVORY : INK, roughness: .4, metalness: 0, clearcoat: .22, clearcoatRoughness: .4}),
    brass: new THREE.MeshStandardMaterial({color: BRASS, roughness: .34, metalness: .72}),
    felt: new THREE.MeshStandardMaterial({color: '#263b35', roughness: .96}),
    engraving: new THREE.MeshStandardMaterial({color: light ? '#887556' : '#17110e', roughness: .42}),
  };
}
function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const result = new THREE.Mesh(g, m);result.position.set(x, y, z);result.castShadow = true;result.receiveShadow = true;return result;
}
function lathe(points: [number, number][], m: THREE.Material, segments = 48) {
  return mesh(new THREE.LatheGeometry(points.map(p => new THREE.Vector2(...p)), segments), m);
}
function orb(radius: number, m: THREE.Material, x = 0, y = 0, z = 0, segments = 20) {
  return mesh(new THREE.SphereGeometry(radius, segments, Math.max(8, Math.round(segments * .65))), m, x, y, z);
}
function ring(radius: number, tube: number, y: number, m: THREE.Material) {
  const result = mesh(new THREE.TorusGeometry(radius, tube, 6, 48), m, 0, y);result.rotation.x = Math.PI / 2;return result;
}
function rounded(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, bevel = .012) {
  return mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(bevel, w / 3, h / 3, d / 3)), m, x, y, z);
}
function taperedRod(from: THREE.Vector3, to: THREE.Vector3, lower: number, upper: number, m: THREE.Material) {
  const result = mesh(new THREE.CylinderGeometry(upper, lower, from.distanceTo(to), 10), m);
  result.position.copy(from).add(to).multiplyScalar(.5);result.quaternion.setFromUnitVectors(Y, to.clone().sub(from).normalize());return result;
}
/** Batch only static direct children. All original geometry is released. */
function batch(root: THREE.Group) {
  const buckets = new Map<THREE.Material, THREE.Mesh[]>();
  for (const item of root.children) {
    if (!(item instanceof THREE.Mesh) || Array.isArray(item.material)) continue;
    const bucket = buckets.get(item.material) || [];bucket.push(item);buckets.set(item.material, bucket);
  }
  for (const [mat, pieces] of buckets) {
    if (pieces.length < 2) continue;
    const geometries = pieces.map(piece => {
      piece.updateMatrix();const geometry = piece.geometry.index ? piece.geometry.toNonIndexed() : piece.geometry.clone();
      geometry.applyMatrix4(piece.matrix);return geometry;
    });
    const geometry = mergeGeometries(geometries, false);
    if (geometry) {
      for (const piece of pieces) {root.remove(piece);piece.geometry.dispose();}
      root.add(mesh(geometry, mat));
    }
    for (const part of geometries) part.dispose();
  }
  return root;
}
function base(root: THREE.Group, m: Finish, radius = .38) {
  const r = radius / .38;
  root.add(lathe([
    [0, .008], [.31 * r, .008], [.349 * r, .018], [.376 * r, .04], [.38 * r, .067],
    [.38 * r, .092], [.369 * r, .112], [.34 * r, .133], [.326 * r, .15], [.31 * r, .18], [0, .18],
  ], m.body));
  root.add(mesh(new THREE.CylinderGeometry(.315 * r, .315 * r, .016, 40), m.felt, 0, .008));
  root.add(ring(.371 * r, .009 * r, .108, m.brass));
}
function height(root: THREE.Group, target: number) {
  const bounds = new THREE.Box3().setFromObject(root);
  const shift = -bounds.min.y, scale = target / (bounds.max.y - bounds.min.y);
  root.traverse(item => {
    if (!(item instanceof THREE.Mesh)) return;
    item.updateMatrix();item.geometry.applyMatrix4(item.matrix);item.position.set(0, 0, 0);item.quaternion.identity();item.scale.set(1, 1, 1);
    item.geometry.translate(0, shift, 0);item.geometry.scale(1, scale, 1);
  });
  root.userData.height = target;
}

function pawn(root: THREE.Group, m: Finish) {
  root.add(lathe([[0, .17], [.25, .17], [.24, .205], [.205, .235], [.17, .27], [.14, .34], [.112, .47], [.106, .57], [.12, .62], [.175, .65], [.19, .68], [.18, .71], [0, .72]], m.body));
  root.add(ring(.17, .009, .655, m.brass), orb(.192, m.body, 0, .808));
}
function knight(root: THREE.Group, m: Finish) {
  root.add(lathe([[0, .17], [.27, .17], [.27, .21], [.24, .25], [.21, .29], [.2, .33], [0, .33]], m.body));
  const outline = new THREE.Shape();
  outline.moveTo(-.2, .3);
  outline.bezierCurveTo(-.29, .47, -.29, .63, -.22, .83);
  outline.bezierCurveTo(-.18, .96, -.11, 1.07, -.105, 1.15);
  outline.lineTo(-.12, 1.28);outline.lineTo(-.035, 1.24);outline.lineTo(.015, 1.295);outline.lineTo(.065, 1.15);
  outline.bezierCurveTo(.16, 1.12, .2, 1.06, .235, .995);
  outline.lineTo(.355, .9);outline.lineTo(.335, .79);outline.lineTo(.195, .785);
  outline.lineTo(.12, .84);outline.lineTo(.085, .91);
  outline.bezierCurveTo(.015, .85, -.005, .76, .04, .65);
  outline.bezierCurveTo(.095, .53, .17, .42, .215, .3);outline.closePath();
  const head = mesh(new THREE.ExtrudeGeometry(outline, {depth: .22, bevelEnabled: true, bevelThickness: .032, bevelSize: .022, bevelSegments: 3, curveSegments: 10, steps: 1}), m.body, 0, 0, -.11);
  root.add(head);
  // Carved cheeks, nostrils and mane grooves are geometry, visible from either side.
  for (const side of [-1, 1]) {
    root.add(orb(.019, m.engraving, .105, 1.075, side * .146, 10));
    root.add(orb(.008, m.brass, .105, 1.08, side * .161, 8));
    root.add(orb(.011, m.engraving, .29, .86, side * .145, 8));
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(.02, .91, side * .146), new THREE.Vector3(-.065, .8, side * .15), new THREE.Vector3(-.07, .65, side * .15), new THREE.Vector3(.035, .43, side * .145)]);
    root.add(mesh(new THREE.TubeGeometry(curve, 12, .006, 4, false), m.engraving));
    for (let i = 0; i < 5; i++) {
      const y = .66 + i * .09, x = -.235 + i * .017;
      root.add(taperedRod(new THREE.Vector3(x, y, side * .145), new THREE.Vector3(x + .06, y - .035, side * .145), .007, .005, m.engraving));
    }
  }
  root.add(ring(.244, .009, .23, m.brass));
}
function bishop(root: THREE.Group, m: Finish) {
  root.add(lathe([[0, .17], [.275, .17], [.26, .22], [.22, .27], [.18, .36], [.14, .53], [.118, .69], [.13, .8], [.17, .84], [.22, .865], [.23, .9], [.2, .935], [0, .935]], m.body));
  root.add(ring(.216, .009, .87, m.brass));
  // A real diagonal opening in the mitre silhouette, cut through its depth.
  const mitre = new THREE.Shape();mitre.moveTo(-.1, .93);
  mitre.bezierCurveTo(-.29, 1.035, -.225, 1.18, -.135, 1.295);
  mitre.quadraticCurveTo(-.035, 1.405, 0, 1.435);
  mitre.quadraticCurveTo(.08, 1.365, .17, 1.26);
  mitre.lineTo(-.015, 1.102);mitre.lineTo(.03, 1.05);mitre.lineTo(.215, 1.205);
  mitre.bezierCurveTo(.272, 1.09, .205, .98, .105, .93);mitre.closePath();
  root.add(mesh(new THREE.ExtrudeGeometry(mitre, {depth: .23, bevelEnabled: true, bevelThickness: .025, bevelSize: .012, bevelSegments: 3, curveSegments: 14, steps: 1}), m.body, 0, 0, -.115));
}
function rook(root: THREE.Group, m: Finish) {
  root.add(lathe([[0, .17], [.278, .17], [.27, .23], [.238, .28], [.22, .33], [.2, .4], [.19, .76], [.205, .84], [.265, .88], [.28, .92], [.28, .965], [0, .965]], m.body, 40));
  root.add(ring(.264, .009, .889, m.brass));
  root.add(lathe([[.205, .94], [.305, .94], [.305, 1.025], [.218, 1.025], [.205, .94]], m.body, 40));
  root.add(mesh(new THREE.CylinderGeometry(.215, .215, .008, 32), m.engraving, 0, .956));
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const merlon = rounded(.145, .19, .12, m.body, Math.cos(a) * .255, 1.105, Math.sin(a) * .255, .007);
    merlon.rotation.y = -a + Math.PI / 2;root.add(merlon);
  }
}
function queen(root: THREE.Group, m: Finish) {
  root.add(lathe([[0, .17], [.28, .17], [.278, .22], [.235, .28], [.18, .4], [.135, .62], [.12, .85], [.14, 1.01], [.19, 1.075], [.245, 1.11], [.25, 1.15], [.205, 1.18], [.19, 1.235], [0, 1.235]], m.body));
  root.add(ring(.24, .009, 1.115, m.brass), ring(.22, .024, 1.25, m.body));
  root.add(orb(.13, m.body, 0, 1.28));
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const from = new THREE.Vector3(Math.cos(a) * .19, 1.2, Math.sin(a) * .19);
    const to = new THREE.Vector3(Math.cos(a) * .27, 1.49, Math.sin(a) * .27);
    root.add(taperedRod(from, to, .04, .025, m.body), orb(.038, m.brass, to.x, to.y, to.z, 12));
  }
  root.add(lathe([[0, 1.27], [.075, 1.27], [.066, 1.46], [.043, 1.53], [0, 1.55]], m.body));
  root.add(orb(.065, m.body, 0, 1.585));
}
function king(root: THREE.Group, m: Finish) {
  root.add(lathe([[0, .17], [.29, .17], [.28, .225], [.235, .29], [.19, .41], [.147, .63], [.137, .89], [.15, 1.06], [.2, 1.13], [.27, 1.17], [.275, 1.215], [.23, 1.25], [.19, 1.3], [0, 1.3]], m.body));
  root.add(ring(.265, .009, 1.18, m.brass), orb(.19, m.body, 0, 1.29));
  root.add(lathe([[0, 1.35], [.105, 1.35], [.105, 1.405], [.075, 1.445], [0, 1.445]], m.body));
  root.add(rounded(.105, .365, .105, m.body, 0, 1.6175, 0, .01));
  root.add(rounded(.32, .095, .105, m.body, 0, 1.665, 0, .01));
  root.add(ring(.1, .008, 1.4, m.brass));
}

export function chessPiece(value: number): THREE.Group {
  const root = new THREE.Group();
  const type = Math.abs(value);
  if (value === 0) return root;
  if (!Number.isInteger(type) || type > 6) throw new RangeError('Chess pieces use signed integers 1–6.');
  const m = finish(value > 0);
  const names = ['empty', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
  root.name = `${value > 0 ? 'ivory' : 'ink'}-${names[type]}`;
  base(root, m, type === 1 ? .32 : type === 2 || type === 3 ? .355 : .38);
  [() => {}, pawn, knight, bishop, rook, queen, king][type](root, m);
  height(root, [0, 1, 1.3, 1.45, 1.2, 1.65, 1.8][type]);
  root.userData.pieceType = names[type];root.userData.side = value > 0 ? 0 : 1;
  root.userData.forward = '+X';
  // Material handles that no geometry uses need no GPU allocation or disposal.
  return batch(root);
}

/** Dedicated lacquered draughts pieces; independent of the chess materials. */
export function checker(value: number): THREE.Group {
  const root = new THREE.Group(); if (!value) return root;
  const red = value > 0, crowned = Math.abs(value) >= 2;
  const body = new THREE.MeshPhysicalMaterial({color: red ? '#a71625' : '#20252c', roughness: .3, clearcoat: .5, clearcoatRoughness: .28});
  const rim = new THREE.MeshStandardMaterial({color: red ? '#d73e43' : '#596776', roughness: .4});
  const inset = new THREE.MeshStandardMaterial({color: red ? '#7e151f' : '#10151b', roughness: .5});
  for (let layer = 0; layer < (crowned ? 2 : 1); layer++) {
    const y = layer * .2;
    const disc = lathe([[0,0],[.37,0],[.43,.035],[.45,.07],[.45,.15],[.42,.195],[.35,.21],[.32,.19],[0,.19]],body);
    disc.position.y = y; root.add(disc, ring(.42,.015,y+.16,rim), ring(.29,.014,y+.195,inset), ring(.23,.009,y+.197,inset));
    for (let i=0;i<36;i++) {const a=i*Math.PI/18; const notch=mesh(new THREE.BoxGeometry(.015,.07,.015),rim,Math.cos(a)*.45,y+.105,Math.sin(a)*.45);notch.rotation.y=-a;root.add(notch);}
  }
  if (crowned) {
    const star = new THREE.Shape();
    for(let i=0;i<10;i++){const a=i*Math.PI/5,r=i%2?.095:.19,x=Math.sin(a)*r,z=Math.cos(a)*r;i?star.lineTo(x,z):star.moveTo(x,z);}star.closePath();
    const mark=mesh(new THREE.ShapeGeometry(star),rim,0,.408,0);mark.rotation.x=-Math.PI/2;root.add(mark);
  }
  root.name=red?'red-draught':'charcoal-draught';root.userData.crowned=crowned;root.userData.height=crowned?.42:.21;
  return batch(root);
}

export function morrisStone(value:number):THREE.Group {
  const root=new THREE.Group();
  const body=new THREE.MeshPhysicalMaterial({color:value>0?'#ece1c6':'#3c322d',roughness:.38,clearcoat:.2});
  const stone=orb(.4,body,0,.16,0,28);stone.scale.y=.4;root.add(stone);return root;
}

/** A true two-sided disc. Animate userData.flipPivot around X/Z; root stays at base y=0. */
export function reversiDisc(value: number): THREE.Group {
  const root = new THREE.Group();if (!value) return root;
  const light = finish(true), dark = finish(false), pivot = new THREE.Group();
  light.body.color.set('#f0eee5'); dark.body.color.set('#141a19'); light.body.clearcoat=dark.body.clearcoat=.18;
  const top = lathe([[0, 0], [.405, 0], [.427, .025], [.425, .065], [.4, .09], [.33, .1], [0, .103]], light.body, 48);
  const bottom = lathe([[0, 0], [.405, 0], [.427, .025], [.425, .065], [.4, .09], [.33, .1], [0, .103]], dark.body, 48);bottom.rotation.x = Math.PI;
  pivot.add(top, bottom);batch(pivot);
  pivot.position.y = .103;if (value < 0) pivot.rotation.x = Math.PI;
  root.add(pivot);root.name = value > 0 ? 'ivory-reversi' : 'ink-reversi';
  root.userData.flipPivot = pivot;root.userData.height = .206;return root;
}

/** A polished, irregular mancala seed. Base at y=0; approximately .25×.16×.18m. */
export function seed(color = '#b97c45'): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(1, 16, 10), positions = geometry.getAttribute('position');
  const colors: number[] = [], tint = new THREE.Color(color);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const irregularity = 1 + .055 * Math.sin(x * 5 + y * 3) * Math.cos(z * 4);
    positions.setXYZ(i, x * .125 * irregularity, y * .079 * irregularity + .08, z * .09 * irregularity);
    const seam = Math.exp(-(((z + Math.sin(x * 2) * .08) / .095) ** 2)) * .23;
    const grain = .9 + Math.sin(x * 28 + y * 5) * .04 - seam;
    colors.push(tint.r * grain, tint.g * grain, tint.b * grain);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));geometry.computeVertexNormals();geometry.computeBoundingBox();
  geometry.translate(0, -geometry.boundingBox!.min.y, 0);
  const result = mesh(geometry, new THREE.MeshPhysicalMaterial({vertexColors: true, roughness: .35, metalness: .04, clearcoat: .45, clearcoatRoughness: .28}));
  result.name = 'mancala-seed';return result;
}

/** Hollow, wood-grained pocket. The rim is y=0; the bowl descends below it. */
export function bowl(radius: number, depth: number): THREE.Mesh {
  if (!Number.isFinite(radius) || !Number.isFinite(depth) || radius <= 0 || depth <= 0) throw new RangeError('A bowl requires positive finite radius and depth.');
  const r = radius, d = depth, wall = Math.min(.07, r * .09);
  const profile: [number, number][] = [
    [0, -d - wall], [r * .2, -d - wall], [r * .42, -d * .96 - wall], [r * .63, -d * .8 - wall],
    [r * .78, -d * .58 - wall], [r * .9, -d * .3 - wall], [r * .98, -.065], [r, -.028],
    [r * .985, -.005], [r * .955, 0], [r * .92, -.012], [r * .895, -.045],
    [r * .85, -d * .26], [r * .73, -d * .53], [r * .56, -d * .74], [r * .35, -d * .9], [r * .16, -d * .97], [0, -d],
  ];
  const geometry = new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), 64);
  const positions = geometry.getAttribute('position'), vertexColors: number[] = [], wood = new THREE.Color('#8b6141');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i), a = Math.atan2(z, x);
    const grain = .83 + .07 * Math.sin(a * 23 + y * 15) + .035 * Math.sin(a * 57 - y * 24);
    vertexColors.push(wood.r * grain, wood.g * grain, wood.b * grain);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
  const result = mesh(geometry, new THREE.MeshStandardMaterial({vertexColors: true, roughness: .42, metalness: .02}));
  result.name = 'carved-mancala-pocket';result.userData.anchor = 'rim';result.userData.radius = radius;result.userData.depth = depth;return result;
}
