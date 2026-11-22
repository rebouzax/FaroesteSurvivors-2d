import { CONFIG } from '../config/gameConfig.js';
import { MINE_LIGHTS, MINE_PLATFORMS, MINE_ROOMS, MINE_SIDINGS, MINE_TRACKS } from '../models/MineLayout.js';

const SCALE = 3;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
let terrain;

export function mineFloor() {
  if (terrain) return terrain;
  const half = CONFIG.mapHalf, size = half * 2 * SCALE;
  const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size });
  const ctx = canvas.getContext('2d');
  paintRock(ctx, size, half);
  ctx.setTransform(SCALE, 0, 0, SCALE, half * SCALE, half * SCALE);

  for (const { x, z, rx, rz, color } of MINE_ROOMS) paintPool(ctx, x, z, rx, rz, color, .4);
  paintStandingWater(ctx);
  for (const [x, z] of MINE_LIGHTS) paintPool(ctx, x, z, 10.5, 8.2, '#cb8751', .22);

  const tracks = [...MINE_SIDINGS, ...MINE_TRACKS];
  for (const track of tracks) paintTrackBed(ctx, track);
  for (const platform of MINE_PLATFORMS) paintPlatform(ctx, platform);
  for (const track of tracks) paintRails(ctx, track);
  terrain = canvas;
  return terrain;
}

function paintRock(ctx, size, half) {
  const image = ctx.createImageData(size, size);
  const { data } = image;
  const columns = Array.from({ length: size }, (_, col) => {
    const x = col / SCALE - half;
    return Math.sin(x * .155) * 3.3 + Math.cos(x * .29) * 1.8;
  });
  let seed = 947;
  for (let row = 0; row < size; row++) {
    const z = row / SCALE - half;
    const bank = Math.sin(z * .075) * 2.8 + Math.cos(z * .43) * 2.2;
    for (let col = 0; col < size; col++) {
      const x = col / SCALE - half;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = (seed >>> 27) - 14;
      const grain = Math.sin((x + z * .35) * .37 + bank * .34);
      const fracture = Math.sin((x * .32 + z * .4) + Math.sin(z * .23) * 1.2);
      const vein = grain > .69 ? 4 : grain < -.73 ? -4 : 0;
      const seam = fracture > .985 && grain > .2 ? -7 : 0;
      const edge = clamp((half - Math.max(Math.abs(x), Math.abs(z))) / 11, 0, 1);
      const value = (columns[col] + bank + vein + seam + noise * .42) * edge;
      const i = (row * size + col) * 4;
      data[i] = 27 + 19 * edge + value;
      data[i + 1] = 23 + 18 * edge + value * .87;
      data[i + 2] = 34 + 20 * edge + value * 1.12;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function paintPool(ctx, x, z, rx, rz, color, alpha) {
  ctx.save();
  ctx.translate(x, z);
  ctx.scale(rx, rz);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, color);
  gradient.addColorStop(.48, color + 'a6');
  gradient.addColorStop(1, color + '00');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gradient;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

function paintStandingWater(ctx) {
  // Water collects below the pump chamber's service lines.
  const ponds = [
    [[38, 5], [41, 8], [45, 7], [47, 11], [45, 17], [41, 20], [39, 18], [36, 15], [36, 9]],
    [[57, 11], [61, 9], [64, 11], [65, 15], [61, 18], [55, 17]],
    [[38, -8], [41, -8], [45, -5], [44, 0], [41, 2], [37, -1]],
  ];
  for (const points of ponds) {
    trace(ctx, points);
    ctx.closePath();
    ctx.fillStyle = '#273237';
    ctx.fill();
    ctx.lineWidth = .6;
    ctx.strokeStyle = '#4560618c';
    ctx.stroke();
    ctx.save();
    ctx.clip();
    for (let i = 0; i < 9; i++) {
      const [x, z] = points[0];
      ctx.fillStyle = i % 3 === 0 ? '#71908772' : '#435e5f6e';
      ctx.fillRect(x - 2 + (i * 5.2) % 12, z + i * 1.75, 1.1 + i % 3, .27);
    }
    ctx.restore();
  }
}

function paintPlatform(ctx, { x, z, width, depth, crosswise }) {
  ctx.save();
  ctx.translate(x, z);
  if (crosswise) ctx.rotate(Math.PI / 2);
  const length = crosswise ? depth : width, across = crosswise ? width : depth;
  ctx.fillStyle = '#261e28';
  ctx.fillRect(-length / 2 - .35, -across / 2 - .3, length + .7, across + .6);
  for (let i = 0, row = -across / 2; row < across / 2; i++, row += 1.05) {
    const left = -length / 2 + (i % 3) * .22;
    const w = length - (i % 2) * .38, h = Math.min(.92, across / 2 - row);
    ctx.fillStyle = i % 2 ? '#4f3b35' : '#58453d';
    ctx.fillRect(left, row, w, h);
    ctx.fillStyle = '#745847';
    ctx.fillRect(left, row + .07, w, Math.min(.19, h));
    ctx.fillStyle = '#332730';
    ctx.fillRect(left + length / 3 + i * .48, row + .15, 1.6, .22);
  }
  ctx.restore();
}

function trace(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
}

function stroke(ctx, points, width, color) {
  trace(ctx, points);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function paintTrackBed(ctx, { points, width, worn }) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  stroke(ctx, points, width + 3.7, worn ? '#1b1a2450' : '#17152270');
  stroke(ctx, points, width, worn ? '#373039bd' : '#3b343c');
  stroke(ctx, points, width - 1, '#4b3d374f');
}

function railPoints(points, offset) {
  const normals = points.slice(1).map(([x, z], i) => {
    const [px, pz] = points[i], length = Math.hypot(x - px, z - pz);
    return [(pz - z) / length, (x - px) / length];
  });
  return points.map(([x, z], i) => {
    const before = normals[i - 1] ?? normals[i];
    const after = normals[i] ?? before;
    const dot = before[0] * after[0] + before[1] * after[1];
    return [x + offset * (before[0] + after[0]) / (1 + dot), z + offset * (before[1] + after[1]) / (1 + dot)];
  });
}

function paintRails(ctx, { points, worn = false }) {
  let nextSleeper = .45, distance = 0, sleeper = 0;
  for (let i = 1; i < points.length; i++) {
    const [fromX, fromZ] = points[i - 1], [toX, toZ] = points[i];
    const dx = toX - fromX, dz = toZ - fromZ;
    const length = Math.hypot(dx, dz), normalX = -dz / length, normalZ = dx / length;
    while (nextSleeper <= distance + length) {
      const t = (nextSleeper - distance) / length;
      const x = fromX + dx * t, z = fromZ + dz * t;
      const extent = worn && sleeper % 7 === 2 ? 1.3 : 2.35;
      const endX = normalX * extent, endZ = normalZ * extent;
      const tie = [[x - endX, z - endZ], [x + endX, z + endZ]];
      ctx.lineCap = 'butt';
      stroke(ctx, tie, 1.23, '#2b212a');
      stroke(ctx, tie, .75, sleeper % 3 ? '#684b40' : '#775747');
      nextSleeper += worn ? 2.6 : 2.18;
      sleeper++;
    }
    distance += length;
  }
  ctx.lineCap = 'butt';
  for (const offset of [-1.4, 1.4]) {
    const rail = railPoints(points, offset);
    stroke(ctx, rail, .94, '#24212c');
    stroke(ctx, rail, .59, worn ? '#655a60' : '#857475');
    stroke(ctx, railPoints(points, offset + .11), .24, worn ? '#827172' : '#ae8e7e');
  }
}
