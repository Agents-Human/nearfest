import * as T from 'three';

/** Small, deterministic material maps; every returned material owns its textures. */
export function woodMaterial(color: string, repeat = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const pixels = ctx.createImageData(canvas.width, canvas.height);
  const rgb = new T.Color(color).convertLinearToSRGB();
  for (let y = 0; y < 512; y++) for (let x = 0; x < 1024; x++) {
    const bend = Math.sin(x * .004 + Math.sin(y * .012)) * 7 + Math.sin(x * .011) * 1.5;
    const grain = y + bend;
    const streak = Math.sin(grain * .13 + Math.sin(grain * .041) * 4);
    const fine = Math.sin(grain * .9 + x * .002);
    const pore = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    const noise = pore - Math.floor(pore);
    const tone = .94 + streak * .035 + fine * .012 + (noise - .5) * .03;
    const i = (y * 1024 + x) * 4;
    pixels.data[i] = rgb.r * 255 * tone;
    pixels.data[i + 1] = rgb.g * 255 * tone;
    pixels.data[i + 2] = rgb.b * 255 * tone;
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.repeat.set(repeat, repeat); map.anisotropy = 8;
  return new T.MeshStandardMaterial({map, roughness: .48, metalness: 0});
}

export function fabricMaterial(color: string) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = color; ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 2) {
    ctx.fillStyle = '#ffffff06'; ctx.fillRect(i, 0, 1, 128);
    ctx.fillStyle = '#00000009'; ctx.fillRect(0, i, 128, 1);
  }
  const map = new T.CanvasTexture(canvas); map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping; map.repeat.set(12, 12); map.anisotropy = 8;
  return new T.MeshStandardMaterial({map, roughness: 1});
}
