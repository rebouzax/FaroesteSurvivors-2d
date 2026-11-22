import { CONFIG } from '../config/gameConfig.js';
import { TOWN_RAILS, townGroundAt } from '../models/TownLayout.js';

const TEXELS = 4;
const PALETTES = {
  paved: ['#424656', '#3d414f', '#484854', '#3c3f4d', '#494754'],
  lane: ['#51424a', '#4e4046', '#53464a', '#4b414a'],
  trade: ['#4a3e45', '#473d45', '#4e4044', '#493e42'],
  freight: ['#42404a', '#45404a', '#3f3e49', '#4a4249'],
  graveyard: ['#383e44', '#3c3d45', '#3c4147', '#363d44'],
  corral: ['#574640', '#54453e', '#53443f', '#564942'],
  ash: ['#353039', '#37313a', '#39343c', '#3b343b'],
  outskirts: ['#3e383e', '#423a40', '#40393f', '#3b363d'],
};

const BOARDWALKS = [
  [-7.3, -23, -5.4], [-7.3, 5.4, 19],
  [7.3, -22.5, -5.4], [7.3, 5.4, 32],
  [57.15, -32.5, -17], [57.15, -50, -39],
];
const PUDDLES = [
  [-2.1, 12, 2.8, 1.6], [3.4, -9, 1.9, 1.1], [-4.2, -23, 1.8, 1.25],
  [2, -33, 2.2, 1.2], [14, 1.4, 3.2, 1.05], [-21, -2.6, 3.4, 1.4],
  [-37.1, 2.4, 2.6, 1.1], [48, -1.5, 2.9, 1.25], [54, -30, 1.6, 2.65],
  [59.4, -36, 1.6, 4.25], [-59.2, -12, 1.6, 2.25], [-64.4, -29.1, 2.2, 1.5],
];

function paintBoardwalks(ctx) {
  for (const [x, from, to] of BOARDWALKS) {
    ctx.fillStyle = '#332930';
    ctx.fillRect(x - 1.16, from - .2, 2.32, to - from + .4);
    for (let z = from; z < to; z += .75) {
      ctx.fillStyle = Math.floor(z * 8) % 5 ? '#64504a' : '#73574d';
      ctx.fillRect(x - 1, z, 2, Math.min(.62, to - z));
      ctx.fillStyle = '#847061';
      ctx.fillRect(x - .95, z, 1.75, .13);
    }
  }
}

function line(ctx, x, z, toX, toZ, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, z);
  ctx.lineTo(toX, toZ);
  ctx.stroke();
}

function paintRailways(ctx) {
  for (const points of TOWN_RAILS) {
    for (let i = 1; i < points.length; i++) {
      const [x, z] = points[i - 1], [toX, toZ] = points[i];
      const length = Math.hypot(toX - x, toZ - z);
      const dx = (toX - x) / length, dz = (toZ - z) / length;
      const rightX = dz, rightZ = -dx;
      line(ctx, x, z, toX, toZ, '#32313d', 4.6);
      for (let step = .6; step < length; step += 1.44) {
        const tx = x + dx * step, tz = z + dz * step;
        const color = Math.round(step * 6.1) % 5 ? '#655049' : '#765a48';
        line(ctx, tx - rightX * 1.95, tz - rightZ * 1.95, tx + rightX * 1.95, tz + rightZ * 1.95, color, .52);
      }
      if (x === 62 && toX === 62) {
        for (let plank = -4.3; plank < 4.2; plank += .68) {
          ctx.fillStyle = '#65534e';
          ctx.fillRect(58.9, plank, 6.2, .55);
        }
      }
      for (const gauge of [-.95, .95]) {
        const ax = x + rightX * gauge, az = z + rightZ * gauge;
        const bx = toX + rightX * gauge, bz = toZ + rightZ * gauge;
        line(ctx, ax, az, bx, bz, '#262830', .63);
        line(ctx, ax - .15, az, bx - .15, bz, '#93848a', .24);
      }
    }
  }
}

let terrain;
export function townFloor() {
  if (terrain) return terrain;
  const half = CONFIG.mapHalf, size = half * 2 * TEXELS;
  const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#37333d';
  ctx.fillRect(0, 0, size, size);
  let seed = 93188;
  for (let row = 0; row < size; row += 4) {
    const offset = row % 8 ? 0 : -3;
    for (let col = offset; col < size; col += 6) {
      const x = (col + 3) / TEXELS - half, z = (row + 2) / TEXELS - half;
      const surface = townGroundAt(x, z);
      const palette = PALETTES[surface];
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const choice = (seed >>> 21) % palette.length;
      ctx.fillStyle = palette[choice];
      ctx.fillRect(col, row, surface === 'paved' ? 5 : 6, surface === 'paved' ? 3 : 4);
      if (surface !== 'paved' && seed % 14 === 0) {
        ctx.fillStyle = surface === 'graveyard' ? '#4f5059' : '#51474b';
        ctx.fillRect(col + 1, row + 1, 2, 1);
      }
    }
  }
  ctx.save();
  ctx.scale(TEXELS, TEXELS);
  ctx.translate(half, half);
  for (const [x, z, width, depth] of PUDDLES) {
    ctx.fillStyle = '#2b2e3b';
    ctx.fillRect(x, z + .2, width, depth - .4);
    ctx.fillRect(x + .45, z, width - .95, depth);
    ctx.fillStyle = '#596174';
    ctx.fillRect(x + .6, z + .25, width * .48, .22);
    ctx.fillStyle = '#80746b';
    ctx.fillRect(x + width * .27, z + depth * .68, width * .36, .18);
  }
  paintBoardwalks(ctx);
  paintRailways(ctx);
  ctx.restore();
  terrain = canvas;
  return terrain;
}
