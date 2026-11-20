import { CanvasTexture, NearestFilter, SRGBColorSpace } from 'three';
import spritesUrl from '../assets/frontier-sprites.png';
import propsUrl from '../assets/desert-sprites.png';
import { CONFIG } from '../config/gameConfig.js';

const groups = [
  [spritesUrl, [
    'joao', 'maria', 'labuta', 'indigo', 'bat', 'dog', 'vulture', 'skeleton',
    'giantBat', 'fireChupacabra', 'shadowMarshal', 'crate', 'cactus', 'rock', 'wagon', 'grave',
  ], [0, 312, 633, 945, 1254]],
  [propsUrl, [
    'bento', 'treasure', 'rosa', 'ada', 'telegraph', 'waypost', 'fence', 'tree',
    'tent', 'brush', 'bones', 'agave', 'xp', 'coin', 'bandage', 'campfire',
  ], [0, 326, 653, 932, 1254]],
];
const raster = (width, height) => Object.assign(document.createElement('canvas'), { width, height });
const load = async (url) => {
  const art = new Image();
  art.src = url;
  await art.decode();
  return art;
};
export const pixelTexture = (canvas) => {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  return texture;
};

let sharedArt;
export function desertArt() {
  sharedArt ??= createArt().catch(error => {
    sharedArt = null;
    throw error;
  });
  return sharedArt;
}

async function createArt() {
  const atlas = raster(512, 256);
  const ctx = atlas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const frames = {};
  const portraits = {};
  const sheets = await Promise.all(groups.map(([url]) => load(url)));
  for (const [group, [, names, rows]] of groups.entries()) {
    const sheet = sheets[group];
    const source = raster(sheet.width, sheet.height).getContext('2d', { willReadFrequently: true });
    source.drawImage(sheet, 0, 0);
    for (const [i, name] of names.entries()) {
      const col = i % 4, row = Math.floor(i / 4);
      const x = Math.round(col * sheet.width / 4);
      const y = rows?.[row] ?? Math.round(row * sheet.height / 4);
      const w = Math.round((col + 1) * sheet.width / 4) - x;
      const h = (rows?.[row + 1] ?? Math.round((row + 1) * sheet.height / 4)) - y;
      const { data } = source.getImageData(x, y, w, h);
      let left = w, right = 0, top = h, bottom = 0;
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          if (data[(py * w + px) * 4 + 3] < 165) continue;
          left = Math.min(left, px); right = Math.max(right, px);
          top = Math.min(top, py); bottom = Math.max(bottom, py);
        }
      }
      const cw = right - left + 1, ch = bottom - top + 1;
      if (cw <= 0 || ch <= 0) throw new Error('Sprite vazio: ' + name);
      const index = group * 16 + i;
      const ax = index % 8 * 64 + 2, ay = Math.floor(index / 8) * 64 + 2;
      const scale = 59 / Math.max(cw, ch);
      const aw = Math.round(cw * scale), ah = Math.round(ch * scale);
      ctx.drawImage(sheet, x + left, y + top, cw, ch, ax, ay, aw, ah);
      frames[name] = { x: ax, y: ay, w: aw, h: ah };
      if (!['bento','joao','maria','labuta','indigo','rosa','ada','bat','dog','vulture','skeleton','giantBat','fireChupacabra','shadowMarshal','treasure'].includes(name)) continue;
      const portrait = raster(Math.round(cw * 158 / Math.max(cw, ch)), Math.round(ch * 158 / Math.max(cw, ch)));
      portrait.getContext('2d').drawImage(sheet, x + left, y + top, cw, ch, 0, 0, portrait.width, portrait.height);
      portraits[name] = portrait.toDataURL();
    }
  }
  ctx.fillStyle = '#fff';
  ctx.fillRect(509, 254, 2, 2);
  frames.white = { x: 509, y: 254, w: 2, h: 2 };
  return { atlas, frames, portraits };
}

const palette = [
  [32, 29, 43], [39, 33, 45], [45, 36, 46], [53, 40, 48], [60, 43, 47],
  [66, 47, 47], [73, 52, 49], [81, 57, 51], [90, 64, 55], [100, 72, 59],
  [109, 78, 62], [118, 85, 65], [134, 98, 71], [150, 111, 79],
];
let terrain;
export function desertFloor() {
  if (terrain) return terrain;
  const side = CONFIG.mapHalf * 2;
  const size = side * 5;
  const canvas = raster(size, size);
  const ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(size, size);
  const data = pixels.data;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  let seed = 1887;
  for (let row = 0; row < size; row++) {
    const z = row / 5 - CONFIG.mapHalf;
    const roadCenter = Math.sin(z * .047) * 12 + Math.sin(z * .12) * 3 - 6;
    for (let col = 0; col < size; col++) {
      const x = col / 5 - CONFIG.mapHalf;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const random = seed / 4294967296;
      const mainRoad = Math.abs(x - roadCenter);
      const sideRoad = Math.abs(z - 12 - 7 * Math.sin(x * .065) + x * .12);
      const road = clamp(1 - Math.min(mainRoad / 7, sideRoad / 4.25) + (random - .5) * .16, 0, 1);
      const ruts = mainRoad < 5.5 && Math.abs(mainRoad - 2.05) < .28 ? -.75 : 0;
      const broad = Math.sin((x + z) * .23) + .67 * Math.sin(x * .42 - z * .16);
      const detail = Math.sin(x * 1.29 + z * .39) * Math.cos(z * .86 - x * .23);
      const ridge = Math.sin(z * .62 + Math.cos(x * .12) * 3) > .89 ? .32 : 0;
      const edge = Math.min(1, (CONFIG.mapHalf - Math.max(Math.abs(x), Math.abs(z))) / 6);
      const index = clamp(Math.floor((6.4 + 3.2 * road + broad * .8 + detail * .9 + ruts + ridge + (random - .5) * 2.5) * edge), 0, palette.length - 1);
      const offset = (row * size + col) * 4;
      data.set(palette[index], offset);
      data[offset + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  terrain = canvas;
  return terrain;
}

export function desertDetails(props) {
  const details = [
    { x: -7, z: 5, name: 'campfire', width: 16 },
    { x: -9, z: 3, name: 'tent', width: 61 },
    { x: -3, z: 12, name: 'bones', width: 16 },
    { x: 7, z: -3, name: 'grave', width: 28 },
  ];
  for (const prop of props) {
    const { type, x, z, size, radius, halfX, halfZ, assetId } = prop;
    const name = assetId === 'waypost' ? 'waypost' : type !== 'visual-collider' ? type
      : halfZ > .5 ? 'wagon' : halfX ? 'fence' : x % 2 ? 'telegraph' : 'grave';
    const width = { wagon: 56, fence: 39, telegraph: 27, grave: 23, waypost: 26 }[name]
      ?? (type === 'rock' ? radius * 16 : 10 + size * 8);
    details.push({ x, z, name, width, flip: Math.sin(x) > 0 });
  }
  for (let i = 0; i < 575; i++) {
    const x = Math.sin(i * 71.13 + 6) * 116, z = Math.cos(i * 37.71 + 3) * 116;
    if (Math.abs(x - (Math.sin(z * .047) * 12 - 6)) < 4) continue;
    const name = ['brush', 'brush', 'agave', 'brush', 'bones', 'agave'][i % 6];
    details.push({ x, z, name, width: 6 + i % 11, flip: i % 2 });
  }
  for (const [x, z] of [[2, -16], [-27, 5], [-37, 28], [14, 24], [36, -21], [60, 43], [-54, -34]]) {
    details.push({ x, z, name: 'tree', width: 33 });
  }
  return details;
}
