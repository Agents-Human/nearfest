import * as T from 'three';

const period = 260;
const tau = Math.PI * 2;
const ridgeColors = [
  ['#7898b2', '#c1d5d5'],
  ['#5b8d96', '#9dbdb3'],
  ['#457e78', '#85aaa0'],
];

/** Continuous, tiled ridgelines: three static meshes, no per-frame geometry. */
export function createPlatformMountains() {
  const root = new T.Group();root.name = 'layered-mountain-ranges';
  const ranges: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>[] = [];
  const clear = new T.Color('#ffffff'), overcast = new T.Color('#8b9eb2'), weatherTint = new T.Color();
  for (let layer = 0; layer < 3; layer++) {
    const vertices: number[] = [], colors: number[] = [], indices: number[] = [];
    const columns = 192, rows = 6;
    const peak = new T.Color(ridgeColors[layer][0]), foot = new T.Color(ridgeColors[layer][1]);
    const snow = new T.Color('#dfe9e3'), color = new T.Color();
    for (let column = 0; column <= columns; column++) {
      const x = -period + column / columns * period * 3;
      const phase = x / period * tau + layer * 1.7;
      const crest = Math.pow(.5 + .5 * Math.sin(phase * 3), 1.3);
      const shoulder = .5 + .5 * Math.sin(phase * 7 + .8);
      const crag = Math.sin(phase * 11 + .6) * Math.sin(phase * 2);
      const top = [8, -5, -13][layer] + crest * [18, 13, 6][layer] + shoulder * [8, 4, 3][layer] + crag * [1.8, 1, .5][layer];
      for (let row = 0; row <= rows; row++) {
        const v = row / rows;
        const y = -36 + (top + 36) * v;
        const z = [-128, -98, -70][layer] + Math.sin(v * Math.PI) * Math.sin(phase * 3 + v * 5) * 5;
        vertices.push(x, y, z);
        color.copy(foot).lerp(peak, Math.pow(v, .75));
        // Broad rock faces and occasional pale summits, not repeated cone caps.
        const face = Math.sin(phase * 3 + v * 4) * .045 + Math.sin(phase * 5 - v * 3) * .025;
        color.multiplyScalar(1 + face);
        if (layer === 0) color.lerp(snow, T.MathUtils.smoothstep(y, 22 + Math.sin(phase * 5) * 2, 33) * T.MathUtils.smoothstep(v, .78, 1));
        colors.push(color.r, color.g, color.b);
        if (column < columns && row < rows) {
          const a = column * (rows + 1) + row, b = a + rows + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);geometry.computeBoundingSphere();
    const mesh = new T.Mesh(geometry, new T.MeshBasicMaterial({vertexColors: true, fog: true}));
    mesh.name = `mountain-range-${layer}`;root.add(mesh);ranges.push(mesh);
  }
  return {root, update(viewerX: number, weather: number, dt: number) {
    weatherTint.copy(clear).lerp(overcast, weather * .65);
    ranges.forEach((mesh, layer) => {
      // The wrap is exactly one period of the same silhouette, so no pop even
      // after kilometres of play. Distant ranges move more slowly.
      const travel = viewerX * [.12, .19, .28][layer];
      mesh.position.x = viewerX - ((travel % period) + period) % period;
      mesh.material.color.lerp(weatherTint, Math.min(1, dt * 2.4));
    });
  }};
}
