import spritesUrl from '../assets/frontier-sprites.webp';
import propsUrl from '../assets/desert-sprites.webp';
import actorAnimationUrl from '../assets/desert-actor-animation.webp';
import mineUrl from '../assets/mine-sprites.webp';
import townUrl from '../assets/town-sprites.webp';
import townDistrictUrl from '../assets/town-district-props.webp';
import { createDesertDressing } from '../models/DesertLayout.js';
import { paintRavenFrames } from './DesertRavens.js';
import { ENEMY_CELLS, ENEMY_FRAME_SIZE } from './EnemyAnimation.js';
import { DESERT_CHAMPIONS, MINE_CHAMPIONS, TOWN_CHAMPIONS } from './ChampionAnimation.js';

export { desertFloor } from './DesertTerrain.js';
export { mineFloor } from './MineTerrain.js';
export { townFloor } from './TownTerrain.js';

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
let sharedArt, sharedActors, sharedMine, sharedTown, currentAtlas;
export function baseArt(withMine = false, withTown = false) {
  sharedArt ??= createArt().catch(error => {
    sharedArt = undefined;
    throw error;
  });
  if (!withMine && !withTown) return sharedArt;
  return Promise.all([sharedArt, withMine ? mineArt() : null, withTown ? townArt() : null])
    .then(([base, mine, town]) => ({ ...base, portraits: { ...base.portraits, ...mine?.portraits, ...town?.portraits } }));
}

export function desertArt(withMine = false, withTown = false) {
  const key = Number(withMine) + 2 * Number(withTown);
  if (currentAtlas?.key === key) return currentAtlas.promise;
  sharedActors ??= load(actorAnimationUrl).catch(error => {
    sharedActors = undefined;
    throw error;
  });
  const promise = Promise.all([
    baseArt(), sharedActors, withMine ? mineArt() : null, withTown ? townArt() : null,
  ]).then(([base, actorArt, mine, town]) => {
    const cell = ENEMY_FRAME_SIZE;
    const rows = [...DESERT_CHAMPIONS.map(id => id + 'Pose'), ...ENEMY_CELLS];
    const columns = 8;
    if (actorArt.width !== columns * cell || actorArt.height !== rows.length * cell) {
      throw new Error('Folha de animações do Deserto tem dimensões inválidas.');
    }
    const offsetY = base.atlas.height;
    const mineY = offsetY + actorArt.height;
    const atlas = raster(actorArt.width + (town?.sheet.width ?? 0), mineY + (mine?.sheet.height ?? 0));
    const ctx = atlas.getContext('2d');
    ctx.drawImage(base.atlas, 0, 0);
    ctx.drawImage(actorArt, 0, offsetY);
    const frames = { ...base.frames };
    rows.forEach((name, row) => {
      for (let i = 0; i < columns; i++) frames[name + i] = { x: i * cell, y: offsetY + row * cell, w: cell, h: cell };
    });
    paintRavenFrames(ctx, frames, base.atlas.width + 5, 5);
    paintAtmosphere(ctx, frames, base.atlas.width, 100);
    if (mine) {
      ctx.drawImage(mine.sheet, 0, mineY);
      for (const [id, frame] of Object.entries(mine.frames)) frames[id] = { ...frame, y: frame.y + mineY };
    }
    if (town) {
      ctx.drawImage(town.sheet, actorArt.width, 0);
      for (const [id, frame] of Object.entries(town.frames)) frames[id] = { ...frame, x: frame.x + actorArt.width };
    }
    return { atlas, frames, portraits: { ...base.portraits, ...mine?.portraits, ...town?.portraits } };
  }).catch(error => {
    if (currentAtlas?.promise === promise) currentAtlas = undefined;
    throw error;
  });
  // Keep only the latest combined canvas. The decoded sprite sheets are shared across runs.
  currentAtlas = { key, promise };
  return promise;
}

function paintAtmosphere(ctx, frames, x, y) {
  const size = 96;
  const spot = ctx.createRadialGradient(x + size / 2, y + size / 2, 0, x + size / 2, y + size / 2, size / 2);
  spot.addColorStop(0, '#fff');
  spot.addColorStop(.45, '#ffffffe6');
  spot.addColorStop(.78, '#ffffff80');
  spot.addColorStop(1, '#ffffff00');
  ctx.fillStyle = spot;
  ctx.fillRect(x, y, size, size);
  frames.haze = { x, y, w: size, h: size };
}

function townArt() {
  sharedTown ??= Promise.all([load(townUrl), load(townDistrictUrl)]).then(([actors, district]) => {
    const cell = ENEMY_FRAME_SIZE;
    if (actors.width !== cell * 8 || actors.height !== cell * 8 || district.width !== cell * 8 || district.height !== cell * 2)
      throw new Error('Folhas de sprites da cidade com dimensões inválidas.');
    const sheet = raster(actors.width, actors.height + district.height);
    const ctx = sheet.getContext('2d');
    ctx.drawImage(actors, 0, 0);
    ctx.drawImage(district, 0, actors.height);
    const frames = {}, portraits = {};
    const frame = slot => ({ x: slot % 8 * cell, y: Math.floor(slot / 8) * cell, w: cell, h: cell });
    TOWN_CHAMPIONS.forEach((id, row) => {
      for (let i = 0; i < 8; i++) frames[id + 'Pose' + i] = frame(row * 8 + i);
      const portrait = raster(cell, cell);
      const { x, y } = frames[id + 'Pose0'];
      portrait.getContext('2d').drawImage(sheet, x, y, cell, cell, 0, 0, cell, cell);
      portraits[id] = portrait.toDataURL();
    });
    ['wraith', 'townZombie', 'townGhoul', 'headlessOutlaw', 'boneHound', 'boneSinger', 'zombieDeputy', 'treasureZombie']
      .forEach((id, index) => {
        for (let i = 0; i < 4; i++) frames[id + i] = frame(16 + index * 4 + i);
      });
    ['Saloon', 'Store', 'Jail', 'Chapel', 'House', 'Mortuary', 'Stable', 'Tower',
      'Lamp', 'Wagon', 'Debris', 'Trough', 'Fence', 'Barricade', 'Well', 'Tree',
      'Hotel', 'Forge', 'Depot', 'FreightShed', 'RailCar', 'RailStop', 'Hearse', 'IronGate',
      'Tomb', 'Cross', 'Hitch', 'Crates', 'Piano', 'Sign', 'Scrub', 'Ruins']
      .forEach((id, index) => { frames['town' + id] = frame(48 + index); });
    return { sheet, frames, portraits };
  }).catch(error => {
    sharedTown = undefined;
    throw error;
  });
  return sharedTown;
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

export function desertDetails(props, stage = 'desert') {
  const mine = stage === 'mine', town = stage === 'town';
  const details = stage === 'desert' ? createDesertDressing() : [];
  for (const prop of props) {
    if (prop.hidden) continue;
    const { type, x, z, size, radius, visual, assetId } = prop;
    const family = visual ?? assetId ?? type;
    const name = mine ? family + (prop.variant ?? Math.abs(Math.floor(x * 11 + z * 17)) % 4) : family;
    const width = prop.width ?? { wagon: 56, fence: 39, telegraph: 32, grave: 23, waypost: 26, tent: 61, tree: 33 }[name]
      ?? (type === 'rock' ? radius * 16 : 10 + size * 8);
    details.push({ x: prop.visualX ?? x, z: prop.visualZ ?? z, name, width,
      flip: prop.flip ?? (!town && family !== 'mineBeam' && Math.sin(x) > 0), occludes: prop.occludes,
      shearY: family === 'townRailCar' ? .34 : undefined,
      anchorY: mine || town ? .075 : undefined, lamp: family === 'mineLamp' || family === 'townLamp' });
  }
  return details;
}
