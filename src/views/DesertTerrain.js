import { CONFIG } from '../config/gameConfig.js';
import {
  CROSSING_WIDTH, DESERT_SITES, DESERT_TURNOUTS, MAIL_ROAD_WIDTH, WASH_WIDTH,
  crossingZ, mailRoadX, mesaRimX, turnoutDistance, washX,
} from '../models/DesertLayout.js';

const TEXELS = 4;
const EDGE = CONFIG.mapHalf;
const SIZE = EDGE * 2 * TEXELS;
const clamp = n => Math.max(0, Math.min(1, n));
const texel = n => (n + EDGE) * TEXELS;
const groundColors = {
  sand: [12, 6, 1], stone: [-7, -3, 3], gravel: [2, 2, 4], dirt: [-9, -10, -8],
};

let terrain;
export function desertFloor() {
  if (terrain) return terrain;
  const canvas = Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE });
  const ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(SIZE, SIZE);
  const { data } = pixels;
  const axis = Array.from({ length: SIZE }, (_, i) => i / TEXELS - EDGE);
  const crossing = Float32Array.from(axis, crossingZ);
  const borders = Float32Array.from(axis, n => clamp((EDGE - Math.abs(n)) / 6));
  const sites = Object.values(DESERT_SITES);
  // Only the rows near a turnout need to check its surface.
  const turnoutsByRow = axis.map(z => DESERT_TURNOUTS.filter(({ fromZ, toZ, width }) =>
    z > Math.min(fromZ, toZ) - width && z < Math.max(fromZ, toZ) + width));
  let seed = 1887;
  for (let row = 0; row < SIZE; row++) {
    const z = axis[row], mail = mailRoadX(z), wash = washX(z), rim = mesaRimX(z);
    const dryChannel = wash + Math.sin(z * .2) * 1.75;
    const crookedRut = Math.sin(z * .43) * .18;
    const turnouts = turnoutsByRow[row];
    const nearbySites = sites.filter(site => Math.abs(z - site.z) < site.radius);
    for (let col = 0; col < SIZE; col++) {
      const x = axis[col];
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const grain = (seed >>> 24) / 256;
      const mainDistance = Math.abs(x - mail);
      const crossingDistance = Math.abs(z - crossing[col]);
      const roadDistance = Math.min(mainDistance / MAIL_ROAD_WIDTH, crossingDistance / CROSSING_WIDTH);
      let shoulder = roadDistance;
      for (const turnout of turnouts) {
        if (x < Math.min(turnout.fromX, turnout.toX) - turnout.width ||
            x > Math.max(turnout.fromX, turnout.toX) + turnout.width) continue;
        shoulder = Math.min(shoulder, turnoutDistance(x, z, turnout) / turnout.width + .14);
      }
      const road = clamp((1 - shoulder) * 1.85 + (grain - .5) * .14);
      const creek = clamp((1 - Math.abs(x - wash) / WASH_WIDTH) * 1.5) * (1 - road);
      const channel = clamp((1 - Math.abs(x - dryChannel) / .95) * .73) * creek;
      const mesa = clamp((x - rim + 4) / 11) * (1 - road);
      const slope = clamp(1 - Math.abs(x - rim) / 4) * (1 - road);
      const seam = slope * Math.pow(.5 + .5 * Math.cos((x - rim) * 1.24 + z * .19), 5);

      const swells = Math.sin(x * .108 + z * .065) * 2 + Math.sin(x * .231 - z * .129) * .67;
      const eddy = Math.sin(z * .12 + Math.cos(x * .039) * 2.23);
      const windward = (x < wash - 9 ? 2.9 : 1.2) * eddy;
      const grit = (grain - .5) * 10 + swells + windward;
      const rut = (roadDistance < 1 && (Math.abs(mainDistance - 1.98 - crookedRut) < .2 ||
        Math.abs(crossingDistance - 1.39) < .17)) ? 9.5 : 0;
      const pebble = grain > .976 ? 9 * creek + 12 * slope : 0;
      const edge = Math.min(borders[row], borders[col]);

      let r = 34 + 36 * road - 11 * creek - 10 * channel + 10 * mesa - 24 * seam - rut + grit + pebble;
      let g = 19 + 25 * road - 2 * creek - 10 * channel - 3 * mesa - 17 * seam - rut * .74 + grit * .72 + pebble;
      let b = 12 + 11 * road + 8 * creek - 6 * channel - 2 * mesa - 9 * seam - rut * .4 + grit * .47 + pebble;
      for (const site of nearbySites) {
        const extent = (x - site.x) ** 2 + (z - site.z) ** 2;
        if (extent > site.radius ** 2) continue;
        const local = clamp((1 - extent / site.radius ** 2) * 1.5) * (1 - road);
        const [red, green, blue] = groundColors[site.floor];
        r += red * local; g += green * local; b += blue * local;
      }

      const offset = (row * SIZE + col) * 4;
      data[offset] = 45 + edge * r;
      data[offset + 1] = 31 + edge * g;
      data[offset + 2] = 35 + edge * b;
      data[offset + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  paintTraces(ctx);
  terrain = canvas;
  return terrain;
}

function hoof(ctx, x, z, angle, weight) {
  ctx.save();
  ctx.translate(Math.round(texel(x)), Math.round(texel(z)));
  ctx.rotate(angle);
  ctx.globalAlpha = weight;
  ctx.fillStyle = '#31232a';
  ctx.fillRect(-1.5, -.8, 1, 2.2);
  ctx.fillRect(.5, -.8, 1, 2.2);
  ctx.fillRect(-.75, -1.7, 1.5, 1);
  ctx.fillStyle = '#b68663';
  ctx.fillRect(-1.25, 1.1, 2.5, .65);
  ctx.restore();
}

function paintTraces(ctx) {
  for (const crossing of [false, true]) {
    const path = crossing ? crossingZ : mailRoadX;
    for (let n = 0; n < 80; n++) {
      if (n % 13 > 8) continue;
      const coordinate = -111 + n * 2.85 + Math.sin(n * 1.67) * .18;
      const tangent = (path(coordinate + .25) - path(coordinate - .25)) * 2;
      const side = (n % 2 ? .52 : -.52) + (crossing ? .33 : .15);
      const x = crossing ? coordinate : path(coordinate) + side;
      const z = crossing ? path(coordinate) + side : coordinate;
      const angle = (crossing ? Math.atan2(tangent, 1) : Math.atan2(1, tangent)) + Math.PI / 2;
      hoof(ctx, x, z, angle, .56);
      hoof(ctx, x + .56 * (crossing ? 1 : tangent), z + .56 * (crossing ? tangent : 1), angle, .38);
    }
  }

  const { mailStop, stockCorral } = DESERT_SITES;
  for (let n = 0; n < 19; n++) {
    const x = stockCorral.x - 8 + n * .55;
    const z = stockCorral.z + Math.sin(n * .46) * .85 + (n % 2 ? -.3 : .3);
    hoof(ctx, x, z, Math.PI / 2 + Math.sin(n) * .19, .63);
  }
  ctx.fillStyle = '#281c23';
  ctx.beginPath();
  ctx.ellipse(texel(mailStop.x - 1.8), texel(mailStop.z + 4.7), 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}
