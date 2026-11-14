import * as T from 'three';
import {woodMaterial} from './table-materials';

export type MancalaPit = {x: number; z: number; rx: number; rz: number; depth: number};
export const mancalaPits: MancalaPit[] = Array.from({length: 14}, (_, i) => ({
  x: i < 12 ? ((i < 6 ? i : 11 - i) - 2.5) * 2.3 : i === 12 ? -8.3 : 8.3,
  z: i < 6 ? 1.55 : i < 12 ? -1.55 : 0,
  rx: i < 12 ? .96 : 1.15, rz: i < 12 ? 1.04 : 2.35, depth: i < 12 ? .68 : .61,
}));
export function pitFloor(pit: MancalaPit, x: number, z: number) {
  const r = Math.hypot((x - pit.x) / pit.rx, (z - pit.z) / pit.rz);
  return .12 - (r < 1 ? pit.depth * Math.sqrt(1-r*r) : 0);
}

/** One continuous carved surface: wood grain runs through every hollow. */
export function mancalaBoard() {
  const root = new T.Group(); root.name = 'carved-oware-board';
  const nx = 400, nz = 128, halfWidth = 10, halfDepth = 3.2, radius = 1.25;
  const positions: number[] = [], uvs: number[] = [], colors: number[] = [], indices: number[] = [];
  function edge(x: number) {
    const inset = Math.max(0, Math.abs(x) - (halfWidth - radius));
    return halfDepth - radius + Math.sqrt(Math.max(0, radius * radius - inset * inset));
  }
  for (let ix = 0; ix <= nx; ix++) {
    const x = (ix / nx * 2 - 1) * halfWidth, limit = edge(x);
    for (let iz = 0; iz <= nz; iz++) {
      const z = (iz / nz * 2 - 1) * limit;
      let y = .12;
      for (const pit of mancalaPits) y = Math.min(y, pitFloor(pit, x, z));
      positions.push(x, y, z); uvs.push((x + halfWidth) / 20, (z + halfDepth) / 6.4);
      const shade = 1 - (.12 - y) * .58; colors.push(shade, shade, shade);
      if (ix < nx && iz < nz) {
        const a = ix * (nz + 1) + iz, b = a + nz + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const topMaterial = woodMaterial('#784723'); topMaterial.vertexColors = true;
  const top = new T.Mesh(geometry, topMaterial); top.castShadow = top.receiveShadow = true; root.add(top);
  // The side follows the exact carved top outline; there are no separate inset bowls.
  const perimeter: T.Vector2[] = [];
  for (let ix = 0; ix <= nx; ix++) {const x = ix / nx * 20 - 10; perimeter.push(new T.Vector2(x, -edge(x)));}
  for (let iz = 1; iz <= nz; iz++) perimeter.push(new T.Vector2(10, -edge(10) + iz / nz * edge(10) * 2));
  for (let ix = nx - 1; ix >= 0; ix--) {const x = ix / nx * 20 - 10; perimeter.push(new T.Vector2(x, edge(x)));}
  for (let iz = nz - 1; iz > 0; iz--) perimeter.push(new T.Vector2(-10, -edge(10) + iz / nz * edge(10) * 2));
  const sidePositions: number[] = [], sideUvs: number[] = [], sideIndices: number[] = [];
  for (let i = 0; i <= perimeter.length; i++) {
    const p = perimeter[i % perimeter.length];
    sidePositions.push(p.x, .12, p.y, p.x * .99, -.78, p.y * .96);
    sideUvs.push(i / perimeter.length * 3, .9, i / perimeter.length * 3, 0);
    if (i < perimeter.length) {const a = i * 2; sideIndices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);}
  }
  const sideGeometry = new T.BufferGeometry();
  sideGeometry.setAttribute('position', new T.Float32BufferAttribute(sidePositions, 3));
  sideGeometry.setAttribute('uv', new T.Float32BufferAttribute(sideUvs, 2));
  sideGeometry.setIndex(sideIndices); sideGeometry.computeVertexNormals();
  const sideMaterial = woodMaterial('#694023'); sideMaterial.side = T.DoubleSide;
  const side = new T.Mesh(sideGeometry, sideMaterial); side.castShadow = side.receiveShadow = true; root.add(side);
  return root;
}
