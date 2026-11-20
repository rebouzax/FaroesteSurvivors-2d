import spritesUrl from '../assets/frontier-sprites.webp';
import propsUrl from '../assets/desert-sprites.webp';
import actorAnimationUrl from '../assets/desert-actor-animation.webp';
import { CONFIG } from '../config/gameConfig.js';
import { createDesertDressing, crossingZ, CROSSING_WIDTH, mailRoadX, MAIL_ROAD_WIDTH, washX, WASH_WIDTH } from '../models/DesertLayout.js';
import { paintRavenFrames } from './DesertRavens.js';
import { ENEMY_CELLS, ENEMY_FRAME_SIZE } from './EnemyAnimation.js';
import { CHAMPION_CELLS } from './ChampionAnimation.js';

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
let sharedArt, sharedBattleArt;
export function baseArt() {
  sharedArt ??= createArt().catch(error => {
    sharedArt = undefined;
    throw error;
  });
  return sharedArt;
}

export function desertArt() {
  sharedBattleArt ??= Promise.all([baseArt(), load(actorAnimationUrl)]).then(([base, actorArt]) => {
    const cell = ENEMY_FRAME_SIZE;
    const rows = [...CHAMPION_CELLS.map(id => id + 'Pose'), ...ENEMY_CELLS];
    const columns = 8;
    if (actorArt.width !== columns * cell || actorArt.height !== rows.length * cell) {
      throw new Error('Folha de animações do Deserto tem dimensões inválidas.');
    }
    const offsetY = base.atlas.height;
    const atlas = raster(actorArt.width, offsetY + actorArt.height);
    const ctx = atlas.getContext('2d');
    ctx.drawImage(base.atlas, 0, 0);
    ctx.drawImage(actorArt, 0, offsetY);
    const frames = { ...base.frames };
    rows.forEach((name, row) => {
      for (let i = 0; i < columns; i++) frames[name + i] = { x: i * cell, y: offsetY + row * cell, w: cell, h: cell };
    });
    paintRavenFrames(ctx, frames, base.atlas.width + 5, 5);
    return { atlas, frames, portraits: base.portraits };
  }).catch(error => {
    sharedBattleArt = undefined;
    throw error;
  });
  return sharedBattleArt;
}

async function createArt() {
  const atlas = raster(512, 256);
  const ctx = atlas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const frames = {};
  const portraits = {};
  const sheets = await Promise.all(groups.map(([url]) => load(url)));
  let index = 0;
  const columns = 4;
  for (const [group, [, names, rows]] of groups.entries()) {
    const sheet = sheets[group];
    const source = raster(sheet.width, sheet.height).getContext('2d', { willReadFrequently: true });
    source.drawImage(sheet, 0, 0);
    for (const [i, name] of names.entries()) {
      const col = i % columns, row = Math.floor(i / columns);
      const x = Math.round(col * sheet.width / columns);
      const y = rows?.[row] ?? Math.round(row * sheet.height / columns);
      const w = Math.round((col + 1) * sheet.width / columns) - x;
      const h = (rows?.[row + 1] ?? Math.round((row + 1) * sheet.height / columns)) - y;
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
      const ax = index % 8 * 64 + 2, ay = Math.floor(index / 8) * 64 + 2;
      index++;
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
  ctx.fillRect(atlas.width - 3, atlas.height - 3, 2, 2);
  frames.white = { x: atlas.width - 3, y: atlas.height - 3, w: 2, h: 2 };
  return { atlas, frames, portraits };
}

const TEXELS = 4;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
let terrain;
export function desertFloor() {
  if (terrain) return terrain;
  const size = CONFIG.mapHalf * 2 * TEXELS;
  const canvas = raster(size, size);
  const ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(size, size);
  const data = pixels.data;
  const axis = Array.from({ length: size }, (_, i) => i / TEXELS - CONFIG.mapHalf);
  const crossings = Float32Array.from(axis, crossingZ);
  const dunes = Float32Array.from(axis, x => Math.sin(x * .115) * 2.1 + Math.sin(x * .27) * .42);
  let seed = 1887;
  for (let row = 0; row < size; row++) {
    const z = axis[row], mail = mailRoadX(z), dryWash = washX(z);
    const band = Math.sin(z * .092) * 2.2 + Math.sin(z * .27) * .67;
    const rutWaver = Math.sin(z * .47) * .14;
    for (let col = 0; col < size; col++) {
      const x = axis[col];
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const random = seed / 4294967296;
      const primary = Math.abs(x - mail);
      const branch = Math.abs(z - crossings[col]);
      const road = clamp((1 - Math.min(primary / MAIL_ROAD_WIDTH, branch / CROSSING_WIDTH)) * 1.88 + (random - .5) * .19, 0, 1);
      const wash = clamp((1 - Math.abs(x - dryWash) / WASH_WIDTH) * 1.7, 0, 1) * (1 - road);
      const wheel = Math.abs(primary - 1.93 - rutWaver) < .19 || Math.abs(branch - 1.45) < .14;
      const dirt = Math.round((band + dunes[col]) * 1.8 + (random - .5) * (11 - road * 4));
      const smallStone = wash > .15 && random > .96 ? 18 : 0;
      const rut = wheel ? 9 : 0;
      const edge = clamp((CONFIG.mapHalf - Math.max(Math.abs(x), Math.abs(z))) / 5, 0, 1);
      const offset = (row * size + col) * 4;
      data[offset] = 45 + edge * (31 + 35 * road - 11 * wash - rut + dirt + smallStone);
      data[offset + 1] = 32 + edge * (17 + 25 * road - 4 * wash - rut * .73 + dirt * .69 + smallStone);
      data[offset + 2] = 35 + edge * (11 + 12 * road + 6 * wash - rut * .39 + dirt * .48 + smallStone);
      data[offset + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  paintHoofTracks(ctx);
  terrain = canvas;
  return terrain;
}

function paintHoofTracks(ctx) {
  for (const crossing of [false, true]) {
    const path = crossing ? crossingZ : mailRoadX;
    for (let n = 0; n < 80; n++) {
      if (n % 13 > 8) continue;
      const coordinate = -111 + n * 2.85 + Math.sin(n * 1.67) * .18;
      const tangent = (path(coordinate + .25) - path(coordinate - .25)) * 2;
      const side = (n % 2 ? .52 : -.52) + (crossing ? .33 : .15);
      const x = crossing ? coordinate : path(coordinate) + side;
      const z = crossing ? path(coordinate) + side : coordinate;
      for (let print = 0; print < 2; print++) {
        const stride = print * .56;
        const pixelX = Math.round((x + CONFIG.mapHalf + stride * (crossing ? 1 : tangent)) * TEXELS);
        const pixelY = Math.round((z + CONFIG.mapHalf + stride * (crossing ? tangent : 1)) * TEXELS);
        ctx.save();
        ctx.translate(pixelX, pixelY);
        ctx.rotate((crossing ? Math.atan2(tangent, 1) : Math.atan2(1, tangent)) + Math.PI / 2);
        ctx.globalAlpha = print ? .36 : .52;
        ctx.fillStyle = '#34242a';
        ctx.fillRect(-1.5, -.75, 1, 2);
        ctx.fillRect(.5, -.75, 1, 2);
        ctx.fillRect(-.75, -1.75, 1.5, 1);
        ctx.fillStyle = '#b68760';
        ctx.fillRect(-1.25, 1.25, 2.5, .65);
        ctx.restore();
      }
    }
  }
}

export function desertDetails(props) {
  const details = createDesertDressing();
  for (const prop of props) {
    const { type, x, z, size, radius, visual, assetId } = prop;
    const name = visual ?? assetId ?? type;
    const width = prop.width ?? { wagon: 56, fence: 39, telegraph: 32, grave: 23, waypost: 26, tent: 61, tree: 33 }[name]
      ?? (type === 'rock' ? radius * 16 : 10 + size * 8);
    details.push({ x, z, name, width, flip: Math.sin(x) > 0 });
  }
  return details;
}
