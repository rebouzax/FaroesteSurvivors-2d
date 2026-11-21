import spritesUrl from '../assets/frontier-sprites.webp';
import propsUrl from '../assets/desert-sprites.webp';
import actorAnimationUrl from '../assets/desert-actor-animation.webp';
import mineUrl from '../assets/mine-sprites.webp';
import { CONFIG } from '../config/gameConfig.js';
import { createDesertDressing, crossingZ, CROSSING_WIDTH, mailRoadX, MAIL_ROAD_WIDTH, washX, WASH_WIDTH } from '../models/DesertLayout.js';
import { paintRavenFrames } from './DesertRavens.js';
import { ENEMY_CELLS, ENEMY_FRAME_SIZE } from './EnemyAnimation.js';
import { DESERT_CHAMPIONS, MINE_CHAMPIONS } from './ChampionAnimation.js';
import { MINE_TRACKS } from '../models/MineLayout.js';

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
let sharedArt, sharedMine;
const battleAtlases = new Map();
export function baseArt(withMine = false) {
  sharedArt ??= createArt().catch(error => {
    sharedArt = undefined;
    throw error;
  });
  if (!withMine) return sharedArt;
  return Promise.all([sharedArt, mineArt()]).then(([base, mine]) => ({ ...base, portraits: { ...base.portraits, ...mine.portraits } }));
}

export function desertArt(withMine = false) {
  if (!battleAtlases.has(withMine)) battleAtlases.set(withMine, Promise.all([baseArt(), load(actorAnimationUrl), withMine && mineArt()]).then(([base, actorArt, mine]) => {
    const cell = ENEMY_FRAME_SIZE;
    const rows = [...DESERT_CHAMPIONS.map(id => id + 'Pose'), ...ENEMY_CELLS];
    const columns = 8;
    if (actorArt.width !== columns * cell || actorArt.height !== rows.length * cell) {
      throw new Error('Folha de animações do Deserto tem dimensões inválidas.');
    }
    const offsetY = base.atlas.height;
    const mineY = offsetY + actorArt.height;
    const atlas = raster(actorArt.width, mineY + (mine?.sheet.height ?? 0));
    const ctx = atlas.getContext('2d');
    ctx.drawImage(base.atlas, 0, 0);
    ctx.drawImage(actorArt, 0, offsetY);
    const frames = { ...base.frames };
    rows.forEach((name, row) => {
      for (let i = 0; i < columns; i++) frames[name + i] = { x: i * cell, y: offsetY + row * cell, w: cell, h: cell };
    });
    paintRavenFrames(ctx, frames, base.atlas.width + 5, 5);
    if (mine) {
      ctx.drawImage(mine.sheet, 0, mineY);
      for (const [id, frame] of Object.entries(mine.frames)) frames[id] = { ...frame, y: frame.y + mineY };
    }
    return { atlas, frames, portraits: { ...base.portraits, ...mine?.portraits } };
  }).catch(error => {
    battleAtlases.delete(withMine);
    throw error;
  }));
  return battleAtlases.get(withMine);
}

function mineArt() {
  sharedMine ??= load(mineUrl).then(sheet => {
    const cell = ENEMY_FRAME_SIZE;
    if (sheet.width !== cell * 8 || sheet.height !== cell * 8) throw new Error('Folha de sprites da mina inválida.');
    const frames = {}, portraits = {};
    const register = (id, row, offset, count, champion = false) => {
      for (let i = 0; i < count; i++) {
        frames[id + (champion ? 'Pose' : '') + i] = { x: (offset + i) * cell, y: row * cell, w: cell, h: cell };
      }
      const portrait = raster(cell, cell);
      portrait.getContext('2d').drawImage(sheet, offset * cell, row * cell, cell, cell, 0, 0, cell, cell);
      portraits[id] = portrait.toDataURL();
    };
    MINE_CHAMPIONS.forEach((id, row) => register(id, row, 0, 8, true));
    register('miner', 3, 0, 4);
    register('mineSpider', 3, 4, 4);
    register('mineSkull', 4, 0, 2);
    register('blindCrawler', 4, 2, 2);
    register('shovelMiner', 4, 4, 4);
    register('giantMoth', 5, 0, 4);
    register('minerGeneral', 5, 4, 4);
    ['mineBeam', 'mineCart', 'mineOre', 'mineLamp'].forEach((id, i) => {
      for (let j = 0; j < 4; j++) frames[id + j] = { x: (i % 2 * 4 + j) * cell, y: (6 + Math.floor(i / 2)) * cell, w: cell, h: cell };
    });
    return { sheet, frames, portraits };
  }).catch(error => {
    sharedMine = undefined;
    throw error;
  });
  return sharedMine;
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

let mineTerrain;
export function mineFloor() {
  if (mineTerrain) return mineTerrain;
  const scale = 3;
  const size = CONFIG.mapHalf * 2 * scale;
  const canvas = raster(size, size);
  const ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(size, size);
  const data = pixels.data;
  const lights = MINE_TRACKS.northSouth.flatMap(x => MINE_TRACKS.eastWest.map(z => [x, z]));
  let seed = 947;
  for (let row = 0; row < size; row++) {
    const z = row / scale - CONFIG.mapHalf;
    for (let col = 0; col < size; col++) {
      const x = col / scale - CONFIG.mapHalf;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = (seed >>> 27) - 14;
      const structure = Math.sin(x * .21 + z * .09) * 3 + Math.sin(z * .51 - x * .14) * 3;
      const seam = Math.sin(x * .28 + Math.sin(z * .09) * 2) * Math.sin(z * .19);
      const rock = seam > .48 ? 7 : seam < -.57 ? -6 : 0;
      let pool = 0;
      for (const [lx, lz] of lights) {
        const dx = x - lx, dz = z - lz;
        pool = Math.max(pool, 1 - (dx * dx + dz * dz) / 512);
      }
      const offset = (row * size + col) * 4;
      const edge = clamp((CONFIG.mapHalf - Math.max(Math.abs(x), Math.abs(z))) / 8, 0, 1);
      data[offset] = 21 + edge * (27 + structure + rock + noise * .48 + pool * 20);
      data[offset + 1] = 18 + edge * (26 + structure + rock + noise * .48 + pool * 11);
      data[offset + 2] = 29 + edge * (27 + structure + rock + noise * .64 - pool * 7);
      data[offset + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  for (const [rotation, tracks] of [[false, MINE_TRACKS.northSouth], [true, MINE_TRACKS.eastWest]]) {
    ctx.save();
    if (rotation) ctx.transform(0, 1, 1, 0, 0, 0);
    for (const track of tracks) {
      const center = (track + CONFIG.mapHalf) * scale;
      ctx.fillStyle = '#15142270';
      ctx.fillRect(center - 9, 0, 18, size);
      for (let y = 0; y < size; y += 7) {
        const hash = Math.abs(Math.imul(y + 11, 421) ^ Math.imul(track + 7, 103));
        if (hash % 27 === 0) continue;
        const left = center - 8 + hash % 3 - 1;
        ctx.fillStyle = hash % 4 ? '#614439' : '#765041';
        ctx.fillRect(left, y, 16, 3);
        ctx.fillStyle = '#2d2431';
        ctx.fillRect(left, y + 2, 16, 1);
      }
      for (const rail of [center - 5, center + 4]) {
        ctx.fillStyle = '#30313d';
        ctx.fillRect(rail, 0, 3, size);
        ctx.fillStyle = '#83747a';
        ctx.fillRect(rail, 0, 1, size);
        for (let y = 9; y < size; y += 21) {
          ctx.fillStyle = '#a98c73';
          ctx.fillRect(rail, y, 2, 1);
        }
      }
    }
    ctx.restore();
  }
  mineTerrain = canvas;
  return canvas;
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

export function desertDetails(props, mine = false) {
  const details = mine ? [] : createDesertDressing();
  for (const prop of props) {
    if (prop.hidden) continue;
    const { type, x, z, size, radius, visual, assetId } = prop;
    const family = visual ?? assetId ?? type;
    const name = mine ? family + Math.abs(Math.floor(x * 11 + z * 17)) % 4 : family;
    const width = prop.width ?? { wagon: 56, fence: 39, telegraph: 32, grave: 23, waypost: 26, tent: 61, tree: 33 }[name]
      ?? (type === 'rock' ? radius * 16 : 10 + size * 8);
    details.push({ x, z: prop.visualZ ?? z, name, width, flip: family !== 'mineBeam' && Math.sin(x) > 0,
      anchorY: mine ? .075 : undefined, lamp: family === 'mineLamp' });
  }
  return details;
}
