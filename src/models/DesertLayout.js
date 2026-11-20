import { CONFIG } from '../config/gameConfig.js';

export const MAIL_ROAD_WIDTH = 5.1;
export const CROSSING_WIDTH = 3.25;
export const WASH_WIDTH = 6.4;

export const mailRoadX = z => Math.sin((z - 8) * .041) * 12 + Math.sin((z - 8) * .097) * 1.75;
export const crossingZ = x => -6.5 + Math.sin((x + 8) * .048) * 6.7 - x * .16;
export const washX = z => -49 + Math.sin((z + 15) * .035) * 13 + Math.sin(z * .079) * 3.2;

export function isDesertTrail(x, z) {
  return Math.abs(x - mailRoadX(z)) < MAIL_ROAD_WIDTH || Math.abs(z - crossingZ(x)) < CROSSING_WIDTH;
}

export function desertSurfaceAt(x, z) {
  if (isDesertTrail(x, z)) return 'trail';
  return Math.abs(x - washX(z)) < WASH_WIDTH ? 'rock' : 'sand';
}

const max = CONFIG.mapHalf - 4;
const visible = (x, z) => Math.abs(x) < max && Math.abs(z) < max;

function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Each site sits along a route so its purpose reads even before the player explores it.
const westernWreck = { x: -24, z: crossingZ(-24) + 5.8 };
const mailCamp = { x: 9.8, z: 12 };
const graveRidge = { x: mailRoadX(-27) + 13.4, z: -27 };
const stockPen = { x: mailRoadX(37) + 11.2, z: 37 };
const landmarks = [
  // Roadside camp. The front of the tent and the fire leave a clear passage.
  [mailCamp.x, mailCamp.z, 'tent', 61, 2.8, 2.2, 1.5],
  [mailCamp.x + 2.2, mailCamp.z + 3.6, 'waypost', 20, .30],
  [mailCamp.x + 4, mailCamp.z - 1.9, 'cactus', 30, .7],
  [mailCamp.x + 3.9, mailCamp.z + 6, 'fence', 36, 1.9, 1.65, .25, .24],
  [mailCamp.x + 7.1, mailCamp.z + 5.7, 'fence', 36, 1.9, 1.65, .25, .24],
  // The wagon broke off the creek crossing. Bones and scattered shrubs sit just downhill.
  [westernWreck.x, westernWreck.z, 'wagon', 65, 2.8, 2.3, 1.25, -.48],
  [westernWreck.x - 5.1, westernWreck.z + 3.2, 'tree', 36, .50],
  [westernWreck.x - 8.8, westernWreck.z + 4.8, 'rock', 51, 2.3],
  // Graves and the ridge shelter the south slope beside the old mail road.
  [graveRidge.x - 2.6, graveRidge.z + 2.1, 'grave', 27, .72],
  [graveRidge.x + .5, graveRidge.z + .1, 'grave', 29, .82],
  [graveRidge.x + 3.1, graveRidge.z - 1.7, 'grave', 25, .74],
  [graveRidge.x + 5, graveRidge.z - 4.6, 'tree', 45, .52],
  [graveRidge.x - .2, graveRidge.z - 6.2, 'rock', 63, 2.9],
  // Split rail stock pen and hitching point at the southern bend.
  [stockPen.x - 3.8, stockPen.z - 3.1, 'fence', 37, 1.8, 1.7, .20, .16],
  [stockPen.x - .35, stockPen.z - 3.65, 'fence', 37, 1.8, 1.7, .20, .16],
  [stockPen.x + 3.15, stockPen.z - 4.1, 'fence', 37, 1.8, 1.7, .20, .16],
  [stockPen.x + 4.4, stockPen.z - 1.7, 'fence', 36, 1.8, 1.6, .20, 1.5],
  [stockPen.x + 3.6, stockPen.z + 3.2, 'tree', 34, .45],
  // Junction sign and poles follow the route rather than forming a grid.
  [mailRoadX(-1) + 7.8, -.9, 'waypost', 26, .46],
  [mailRoadX(-52) - 6.5, -52, 'telegraph', 34, .52],
  [mailRoadX(-79) - 6.9, -79, 'telegraph', 32, .52],
  [mailRoadX(62) - 7.1, 62, 'telegraph', 32, .50],
  [mailRoadX(91) - 7.5, 91, 'telegraph', 33, .50],
];

const rockSites = [
  [-10, -13, 2, 5],
  [-34, 14, 4, 6],
  [27, -29, 5, 8],
  [33, 17, 3, 5],
  [-70, -71, 8, 11],
  [38, -75, 7, 10],
  [72, 22, 7, 11],
  [58, 73, 6, 10],
  [-74, 69, 7, 12],
  [-25, 88, 6, 9],
  [86, -53, 6, 11],
  [83, 82, 8, 11],
  [-86, -22, 7, 11],
  [18, -100, 5, 8],
];

export function createDesertProps() {
  const props = landmarks.map(([x, z, type, width, radius, halfX, halfZ, rotation]) => (
    { x, z, type, width, radius, ...(halfX === undefined ? {} : { halfX, halfZ, rotation: rotation ?? 0 }) }
  ));
  const random = seededRandom(1887);
  const clearFor = (x, z, radius) => visible(x, z)
    && Math.hypot(x, z - 8) > 6
    && Math.abs(x - mailRoadX(z)) > MAIL_ROAD_WIDTH + radius + 1
    && Math.abs(z - crossingZ(x)) > CROSSING_WIDTH + radius + .65
    && !props.some(p => Math.hypot(x - p.x, z - p.z) < radius + p.radius + 1.1);

  for (const [x, z, stones, spread] of rockSites) {
    let placed = 0;
    for (let i = 0; i < stones * 4 && placed < stones; i++) {
      const angle = random() * Math.PI * 2;
      const offset = spread * Math.sqrt(random());
      const px = x + Math.cos(angle) * offset, pz = z + Math.sin(angle) * offset * .71;
      const radius = .56 + random() * 1.95;
      if (!clearFor(px, pz, radius)) continue;
      props.push({ x: px, z: pz, type: 'rock', radius, width: 15 + radius * 16 });
      placed++;
    }
  }
  for (let i = 0; i < 58; i++) {
    // Saguaro banks grow near the wash and sunnier road shoulders.
    const z = -110 + i * 220 / 57 + (random() - .5) * 4;
    const x = (i % 3 === 0 ? washX(z) : mailRoadX(z)) + (-1) ** i * (8.9 + random() * 10);
    const radius = .49 + random() * .48;
    if (clearFor(x, z, radius)) props.push({ x, z, type: 'cactus', radius, width: 19 + radius * 11 });
  }
  return props;
}

export const desertRavenSites = Object.freeze([
  { x: westernWreck.x + 5, z: westernWreck.z + 8, rx: 28, rz: 19, phase: .1, count: 3 },
  { x: graveRidge.x + 1, z: graveRidge.z - 11, rx: 20, rz: 15, phase: 2.4, count: 3 },
  { x: -51, z: -52, rx: 21, rz: 21, phase: 2.9, count: 2 },
  { x: stockPen.x, z: stockPen.z + 11, rx: 26, rz: 19, phase: .8, count: 3 },
  { x: -61, z: 71, rx: 21, rz: 25, phase: 4.3, count: 3 },
  { x: 58, z: -50, rx: 24, rz: 20, phase: 1.3, count: 2 },
]);

export function createDesertDressing() {
  const result = [
    { x: mailCamp.x + 1.8, z: mailCamp.z + 1.65, name: 'campfire', width: 15 },
    { x: westernWreck.x + 1.7, z: westernWreck.z + 3.2, name: 'bones', width: 28 },
    { x: westernWreck.x - 6.2, z: westernWreck.z + 5.3, name: 'bones', width: 16 },
    { x: graveRidge.x + 4.2, z: graveRidge.z + 3.7, name: 'bones', width: 18 },
    { x: stockPen.x + 1, z: stockPen.z + .8, name: 'bones', width: 24 },
  ];
  const random = seededRandom(2127);
  for (let i = 0; i < 86; i++) {
    const z = -114 + i * 228 / 85 + random() * 3;
    const base = i % 2 ? mailRoadX(z) : washX(z);
    const x = base + (i % 3 ? 1 : -1) * (7.8 + random() * 12);
    if (!visible(x, z) || isDesertTrail(x, z)) continue;
    result.push({ x, z, name: i % 3 ? 'brush' : 'agave', width: 7 + random() * 9, flip: i % 2 === 1 });
  }
  for (const [x, z, stones, spread] of rockSites) {
    for (let i = 0; i < stones * 2; i++) {
      const px = x + (random() - .5) * spread * 2, pz = z + (random() - .5) * spread;
      if (!visible(px, pz) || isDesertTrail(px, pz)) continue;
      result.push({ x: px, z: pz, name: i % 4 ? 'brush' : 'agave', width: 6 + random() * 11, flip: i % 2 === 1 });
    }
  }
  for (const z of [-92, -48, 1, 28, 65, 91]) {
    const x = washX(z) + (z > 1 ? 4.5 : -4.5);
    result.push({ x, z, name: 'bones', width: 18 + random() * 9, flip: true });
    result.push({ x: x + 2.1, z: z + 1.7, name: 'bones', width: 8 + random() * 7 });
  }
  return result;
}
