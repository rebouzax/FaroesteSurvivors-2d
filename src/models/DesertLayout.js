import { CONFIG } from '../config/gameConfig.js';

export const MAIL_ROAD_WIDTH = 5.1;
export const CROSSING_WIDTH = 3.25;
export const WASH_WIDTH = 6.4;

export const mailRoadX = z => Math.sin((z - 8) * .041) * 12 + Math.sin((z - 8) * .097) * 1.75;
export const crossingZ = x => -6.5 + Math.sin((x + 8) * .048) * 6.7 - x * .16;
export const washX = z => -49 + Math.sin((z + 15) * .035) * 13 + Math.sin(z * .079) * 3.2;
export const mesaRimX = z => 58 + Math.sin(z * .037 + 1.7) * 12 + Math.sin(z * .091) * 4;

const mailStop = { x: 13.8, z: 17, floor: 'sand', radius: 10 };
const burialRidge = { x: 4.2, z: -27, floor: 'stone', radius: 10 };
const fordX = -43;
const wreckedFord = { x: fordX, z: crossingZ(fordX) + 7.8, floor: 'gravel', radius: 9 };
const stockCorral = { x: mailRoadX(40) + 15.5, z: 40, floor: 'dirt', radius: 12 };
export const DESERT_SITES = Object.freeze({ mailStop, burialRidge, wreckedFord, stockCorral });

// The turnouts join the mail road at its shoulder and stop at the entrance to each site.
export const DESERT_TURNOUTS = [
  { fromX: mailRoadX(16), fromZ: 16, toX: mailStop.x - 2.3, toZ: mailStop.z + 1.5, width: 1.45 },
  { fromX: mailRoadX(-24), fromZ: -24, toX: burialRidge.x - 4.7, toZ: burialRidge.z + 2, width: 1.35 },
  { fromX: mailRoadX(40), fromZ: 40, toX: stockCorral.x - 6, toZ: stockCorral.z, width: 1.65 },
];

export function turnoutDistance(x, z, turnout) {
  const { fromX, fromZ, toX, toZ } = turnout;
  const dx = toX - fromX, dz = toZ - fromZ;
  const along = Math.max(0, Math.min(1, ((x - fromX) * dx + (z - fromZ) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - fromX - along * dx, z - fromZ - along * dz);
}

export function isDesertTrail(x, z) {
  return Math.abs(x - mailRoadX(z)) < MAIL_ROAD_WIDTH ||
    Math.abs(z - crossingZ(x)) < CROSSING_WIDTH ||
    DESERT_TURNOUTS.some(turnout => turnoutDistance(x, z, turnout) < turnout.width);
}

export function desertSurfaceAt(x, z) {
  if (isDesertTrail(x, z)) return 'trail';
  return Math.abs(x - washX(z)) < WASH_WIDTH || Math.abs(x - mesaRimX(z)) < 4.25 ||
    Math.hypot(x - burialRidge.x, z - burialRidge.z) < burialRidge.radius * .62 ? 'rock' : 'sand';
}

const max = CONFIG.mapHalf - 4;
const insideMap = (x, z) => Math.abs(x) < max && Math.abs(z) < max;
const place = ({ x, z }, [dx, dz, type, width, radius, halfX, halfZ, rotation]) => ({
  x: x + dx, z: z + dz, type, width, radius,
  ...(halfX === undefined ? {} : { halfX, halfZ, rotation: rotation ?? 0 }),
  ...(type === 'fence' ? { flip: Math.abs(rotation ?? 0) < Math.PI / 4 } : {}),
});
const siteProps = [
  [mailStop, [
    [1.2, -4.3, 'tent', 67, 2.6, 2.2, 1.4],
    [6.4, -3.1, 'tent', 47, 1.8, 1.45, 1.3],
    [1.1, 2.9, 'waypost', 25, .38],
    [5, 1.5, 'fence', 28, 1.7, 1.63, .20],
    [8.35, 1.5, 'fence', 28, 1.7, 1.63, .20],
    [4.1, 7.0, 'tree', 43, .59],
  ]],
  [burialRidge, [
    [-2.4, -1.4, 'grave', 25, .7],
    [.6, -1.4, 'grave', 29, .8],
    [3.7, -1.4, 'grave', 28, .76],
    [-2.4, -4.4, 'grave', 27, .72],
    [.6, -4.4, 'grave', 25, .7],
    [3.7, -4.4, 'grave', 30, .84],
    [-3, -7.1, 'fence', 28, 1.7, 1.65, .20],
    [.5, -7.1, 'fence', 28, 1.7, 1.65, .20],
    [4, -7.1, 'fence', 28, 1.7, 1.65, .20],
    [6.8, -3.9, 'tree', 51, .65],
    [5.8, 2.6, 'rock', 46, 1.8],
  ]],
  [wreckedFord, [
    [0, 0, 'wagon', 72, 2.65, 2.15, 1.35, -.48],
    [-5.1, 3.5, 'tree', 42, .59],
    [4.5, 1.7, 'fence', 29, 1.45, 1.28, .25, -.6],
    [7, 3.2, 'rock', 50, 2.2],
  ]],
  [stockCorral, [
    [-3.4, -4.8, 'fence', 28, 1.7, 1.65, .20],
    [0, -4.8, 'fence', 28, 1.7, 1.65, .20],
    [3.4, -4.8, 'fence', 28, 1.7, 1.65, .20],
    [5.1, -3.1, 'fence', 28, 1.7, 1.65, .20, Math.PI / 2],
    [5.1, .3, 'fence', 28, 1.7, 1.65, .20, Math.PI / 2],
    [5.1, 3.7, 'fence', 28, 1.7, 1.65, .20, Math.PI / 2],
    [0, 5.4, 'fence', 28, 1.7, 1.65, .20],
    [-3.4, 5.4, 'fence', 28, 1.7, 1.65, .20],
    [-1, 1.8, 'waypost', 24, .34],
    [8, 5.9, 'tree', 42, .55],
  ]],
];

const desertSides = [
  // Alternating stretches of the dry wash hold scrub and saguaro stands.
  ['wash', -102, -1], ['wash', -79, 1], ['wash', -57, 1], ['wash', -31, -1],
  ['wash', 6, 1], ['wash', 30, -1], ['wash', 55, -1], ['wash', 84, 1], ['wash', 106, 1],
  // Thorn and aloe survive at the toe of each scree field.
  ['mesa', -96, -1], ['mesa', -63, -1], ['mesa', -28, 1], ['mesa', 0, -1],
  ['mesa', 34, -1], ['mesa', 68, -1], ['mesa', 94, 1],
];

const bankOffsets = [
  [-.1, -6.4], [1.8, -3.5], [-.4, -.8], [2.8, 1.2], [.5, 4.9], [2.6, 7.7],
];
const fanOffsets = [
  [-5.8, -6.8, 1.42], [-2.3, -4.9, 2.2], [.3, -.5, 2.7],
  [4.2, -3.1, 1.35], [6.7, -1.6, 1.1], [2.6, 4.2, 2.12],
  [5.8, 7.3, 1.48], [-.4, 7.8, 1.15], [-6, 3.7, 1.1],
];
const mesaFans = [-102, -78, -51, -23, 9, 43, 70, 101];

function usableLocation(x, z, radius) {
  return insideMap(x, z) && Math.hypot(x, z - 8) > radius + 5.5 &&
    Math.abs(x - mailRoadX(z)) > MAIL_ROAD_WIDTH + radius + .8 &&
    Math.abs(z - crossingZ(x)) > CROSSING_WIDTH + radius + .8 &&
    DESERT_TURNOUTS.every(turnout => turnoutDistance(x, z, turnout) > turnout.width + radius + .45);
}

const bankX = (landform, z) => landform === 'wash' ? washX(z) : mesaRimX(z);

export function createDesertProps() {
  const props = siteProps.flatMap(([site, objects]) => objects.map(object => place(site, object)));
  const add = (x, z, type, radius, width) => {
    if (usableLocation(x, z, radius) &&
      props.every(p => Math.hypot(x - p.x, z - p.z) > radius + p.radius + .65)) {
      props.push({ x, z, type, radius, width });
    }
  };

  // Poles line the west shoulder of the mail road. Openings mark the ford and turnouts.
  for (const z of [-106, -86, -65, -44, -22, 19, 41, 63, 85, 107]) {
    add(mailRoadX(z) - 7.4, z, 'telegraph', .5, 34);
  }
  add(mailRoadX(-1) + 8.8, 1.2, 'waypost', .38, 28);
  add(fordX - 8, crossingZ(fordX - 8) - 5.7, 'waypost', .35, 23);

  // Larger fallen rocks trace the mesa edge, with smaller stones fanning out at its foot.
  for (const [group, center] of mesaFans.entries()) {
    const side = group % 3 === 1 ? -1 : 1;
    for (const [offset, along, radius] of fanOffsets) {
      const z = center + along;
      const x = mesaRimX(z) + offset * side;
      add(x, z, 'rock', radius, 13 + radius * 18);
    }
  }
  for (const z of [-88, -65, -39, -13, 16, 42, 74, 98]) {
    add(washX(z) - 7.6, z - .8, 'rock', 1.7, 37);
    add(washX(z + 3) - 8.4, z + 3, 'rock', 1.2, 32);
  }
  for (const [landform, center, side] of desertSides) {
    for (const [offset, along] of [bankOffsets[1], bankOffsets[4]]) {
      const z = center + along;
      add(bankX(landform, z) + side * (8.6 + offset), z, 'cactus', .59 + offset * .1, 28 + offset * 3);
    }
  }
  return props;
}

export const desertRavenSites = Object.freeze([
  { x: wreckedFord.x + 3, z: wreckedFord.z + 6, rx: 24, rz: 17, phase: .1, count: 3 },
  { x: burialRidge.x, z: burialRidge.z, rx: 21, rz: 16, phase: 2.4, count: 3 },
  { x: washX(-54), z: -54, rx: 22, rz: 22, phase: 2.9, count: 2 },
  { x: stockCorral.x, z: stockCorral.z + 7, rx: 25, rz: 20, phase: .8, count: 2 },
  { x: washX(79), z: 79, rx: 21, rz: 21, phase: 4.3, count: 2 },
]);

export function createDesertDressing() {
  const dressing = [
    { x: mailStop.x - 1.8, z: mailStop.z + 4.7, name: 'campfire', width: 20 },
    { x: mailStop.x + 4.8, z: mailStop.z + 5.4, name: 'brush', width: 12 },
    { x: wreckedFord.x - 3, z: wreckedFord.z + 2, name: 'bones', width: 30 },
    { x: wreckedFord.x + 2.2, z: wreckedFord.z + 3.5, name: 'bones', width: 19 },
    { x: wreckedFord.x - 1.8, z: wreckedFord.z + 6.3, name: 'bones', width: 15 },
    { x: burialRidge.x + 3.8, z: burialRidge.z + 2, name: 'bones', width: 21 },
    { x: stockCorral.x + 2.5, z: stockCorral.z + 2.6, name: 'bones', width: 26 },
    { x: stockCorral.x + 3.4, z: stockCorral.z + .6, name: 'bones', width: 15 },
  ];
  for (const [landform, center, side] of desertSides) {
    for (const [index, [offset, along]] of bankOffsets.entries()) {
      const z = center + along;
      const x = bankX(landform, z) + side * (5.5 + offset);
      if (!insideMap(x, z) || isDesertTrail(x, z)) continue;
      dressing.push({ x, z, name: index % 3 ? 'brush' : 'agave', width: 8 + index % 4 * 2, flip: side < 0 });
    }
  }
  // Scavengers leave a small cluster on the exposed bank at a few bends of the wash.
  for (const [z, side] of [[-82, 1], [-48, -1], [58, -1], [94, 1]]) {
    const x = washX(z) + side * 4.8;
    dressing.push({ x, z, name: 'bones', width: 24, flip: side < 0 });
    dressing.push({ x: x - side * 2, z: z + 2.6, name: 'bones', width: 11, flip: side > 0 });
  }
  return dressing;
}
