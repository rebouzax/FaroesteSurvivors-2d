// The main shaft serves every working level. The western return and the
// eastern service spur leave two circuits open when the main shaft gets crowded.
export const MINE_TRACKS = [
  { id: 'shaft', width: 6.7, points: [[0, 61], [0, -103]] },
  { id: 'westVein', width: 5.8, points: [[0, 14], [-12, 14], [-28, 23], [-62, 23], [-74, 18], [-101, 18]] },
  { id: 'haulage', width: 5.8, points: [[0, -24], [12, -24], [24, -31], [55, -31], [69, -42], [96, -42]] },
  { id: 'service', width: 5.2, worn: true, points: [[0, 35], [10, 35], [21, 42], [38, 42], [51, 34], [51, -31]] },
  { id: 'westReturn', width: 5.7, worn: true, points: [[-74, 18], [-74, -44], [-61, -58], [-36, -58], [-23, -68], [0, -68]] },
  { id: 'abandoned', width: 5, worn: true, points: [[0, -81], [11, -81], [23, -90], [46, -90]] },
];

// Drainage, broken sleepers and parked carts belong along these short sidings.
export const MINE_SIDINGS = [
  { width: 4.5, worn: true, points: [[0, 17], [6, 11], [16, 11]] },
  { width: 4.5, worn: true, points: [[-61, 23], [-55, 29], [-35, 29]] },
  { width: 4.5, points: [[29, -31], [39, -23], [64, -23]] },
];

// The texture and the props share the same footprint for each working area.
export const MINE_ROOMS = [
  { x: 0, z: 49, rx: 28, rz: 27, color: '#ab734d' }, // Entrance and forecourt
  { x: 0, z: 10, rx: 23, rz: 28, color: '#946b53' }, // Working junction
  { x: -48, z: 25, rx: 30, rz: 21, color: '#745486' }, // Amethyst cut and loading siding
  { x: -74, z: -25, rx: 18, rz: 35, color: '#63518a' }, // Western return
  { x: 42, z: 12, rx: 22, rz: 27, color: '#426d6e' }, // Flooded pump chamber
  { x: 54, z: -27, rx: 31, rz: 19, color: '#946442' }, // Sorting yard
  { x: 88, z: -43, rx: 24, rz: 18, color: '#596b66' }, // Mineral stores
  { x: 26, z: -89, rx: 29, rz: 19, color: '#72536f' }, // Unstable workings
];

export const MINE_LIGHTS = [
  [-5.6, 49, 0], [5.4, 43, 2], [-4.8, 34, 3], [-5.8, 19, 0],
  [-4.6, 7, 2], [5.2, -7, 1], [-4.5, -18, 0], [5.1, -34, 3],
  [-4.8, -53, 2], [5.1, -72, 1], [-4.9, -93, 3],
  [-18, 14, 1], [-34, 17, 2], [-47, 33, 0], [-65, 12, 3], [-87, 13, 2],
  [-79, -7, 3], [-69, -27, 0], [-80, -43, 1], [-50, -63, 3],
  [46, 27, 0], [55, 5, 3], [45, -12, 1], [28, -36, 2],
  [40, -18.3, 0], [56, -18.5, 2], [73, -36, 1], [91, -36.5, 3], [34, -94, 1],
];

export const MINE_PLATFORMS = [
  { x: 7, z: 46, width: 7, depth: 13, crosswise: true },
  { x: 8, z: 14, width: 13, depth: 5 },
  { x: -47, z: 33, width: 24, depth: 5 },
  { x: 50, z: -19, width: 21, depth: 6 },
  { x: 88, z: -48, width: 11, depth: 5 },
];

const trackSegments = [...MINE_TRACKS, ...MINE_SIDINGS].flatMap(track => track.points.slice(1).map(([endX, endZ], i) => {
  const [x, z] = track.points[i];
  const dx = endX - x, dz = endZ - z;
  return {
    x, z, dx, dz, inverseLength: 1 / (dx * dx + dz * dz),
    minX: Math.min(x, endX) - 2.25, maxX: Math.max(x, endX) + 2.25,
    minZ: Math.min(z, endZ) - 2.25, maxZ: Math.max(z, endZ) + 2.25,
  };
}));

export function mineSurfaceAt(x, z) {
  for (const { x: sx, z: sz, dx, dz, inverseLength, minX, maxX, minZ, maxZ } of trackSegments) {
    if (x < minX || x > maxX || z < minZ || z > maxZ) continue;
    const px = x - sx, pz = z - sz;
    const along = Math.max(0, Math.min(1, (px * dx + pz * dz) * inverseLength));
    if ((px - dx * along) ** 2 + (pz - dz * along) ** 2 < 2.25 ** 2) return 'trail';
  }
  return MINE_PLATFORMS.some(p => Math.abs(x - p.x) < p.width / 2 && Math.abs(z - p.z) < p.depth / 2) ? 'trail' : 'rock';
}

export function createMineProps() {
  const props = [];
  const add = (x, z, visual, width, radius, variant = 0, options = {}) =>
    props.push({ x, z, type: 'mine', visual, width, radius, variant, ...options });
  const debris = (x, z, width, variant = 0) => add(x, z, 'mineOre', width, 0, variant, { dressing: true });
  const ore = (x, z, width, variant = 0) => add(x, z, 'mineOre', width, width / 27, variant);
  const cart = (x, z, variant, flip = false) => add(x, z, 'mineCart', 38, 1.15, variant, { flip });
  const portal = (x, z, alongZ, variant = 0, width = 63, halfSpan = 3.3) => {
    const dx = alongZ ? halfSpan : 0, dz = alongZ ? 0 : halfSpan;
    add(x + dx, z + dz, 'mineBeam', width, .52, variant, {
      visualX: x + (alongZ ? .7 : .15), visualZ: z + (alongZ ? .15 : .7), flip: alongZ,
    });
    props.push({ x: x - dx, z: z - dz, type: 'mine', hidden: true, radius: .52 });
  };

  // Timber sizes and spacing change as the main gallery leaves the entrance.
  portal(0, 52, true, 1, 76, 4.1);
  portal(0, 32, true, 0);
  portal(0, 4, true, 1);
  portal(0, -11, true, 0);
  portal(0, -42, true, 2);
  portal(0, -58, true, 3);
  portal(0, -91, true, 2, 60);
  for (const x of [-34, -50, -58]) portal(x, 23, false, x === -50 ? 3 : 1);
  for (const x of [29, 42]) portal(x, -31, false, 1);
  for (const z of [-12, -34]) portal(-74, z, true, 3);
  portal(51, 12, true, 2);
  portal(37, -90, false, 2, 58, 3);

  // Entrance cribbing and the first shunting point flank the starting lane.
  cart(10, 11, 0);
  cart(15, 11, 2);
  cart(8.6, 51, 1, true);
  for (const [x, z, width] of [[-8, 55, 55], [-13, 48, 51], [13, 55, 43], [18, 53, 52],
    [-11, 2, 43], [-14, -2, 32], [9.5, 19, 31], [12.5, -5, 37]]) ore(x, z, width);
  for (const [x, z, width] of [[-9, 51, 19], [-14, 53, 15], [16, 55, 20], [15.5, 14, 15], [-9, 2.5, 19]]) debris(x, z, width);

  // Mined crystals line one rock face. The carts wait on the timber loading side.
  cart(-48, 29, 3);
  cart(-42, 29, 2);
  for (const [x, z, width, variant] of [
    [-27, 12, 49, 1], [-32, 11, 60, 3], [-38, 12, 48, 1], [-43, 10, 57, 0],
    [-49, 11, 63, 1], [-56, 9, 49, 3], [-60, 10, 39, 1], [-88, 24, 46, 0],
    [-94, 24, 61, 1], [-100, 23, 42, 3], [-79, -16, 61, 1], [-79, -21, 49, 2],
    [-82, -26, 59, 1], [-82, -31, 48, 0], [-62, -48, 54, 3], [-57, -51, 44, 1],
  ]) ore(x, z, width, variant);
  for (const [x, z, width, variant] of [[-36, 15, 21, 1], [-47, 15, 24, 3], [-55, 13, 19, 1],
    [-92, 22, 15, 3], [-81, -19, 17, 1], [-47, 33, 19, 0], [-43, 32, 16, 2]]) debris(x, z, width, variant);

  // The crossing stays open from the main gallery to the sorting yard.
  cart(42, -23, 1);
  cart(47.8, -23, 0);
  cart(57, -23, 2);
  cart(86, -47, 3);
  for (const [x, z, width, variant] of [
    [32, -41, 46, 0], [37.5, -41.5, 42, 2], [45, -42, 47, 2],
    [62, -17, 31, 0], [67, -18, 37, 0], [85, -54, 48, 2], [91, -52, 37, 3],
    [99, -45, 51, 0], [101, -39, 42, 2],
    [27, 12, 50, 2], [28.5, 18.8, 62, 2], [33, 22, 43, 0], [34, 4, 42, 3], [36, -1, 54, 2],
    [60, 24, 50, 2], [64, 27, 50, 0], [62, 15, 40, 0],
  ]) ore(x, z, width, variant);
  for (const [x, z, width, variant] of [[42, -16, 17, 2], [49, -16, 20, 0], [63, -15, 19, 0],
    [28, 16, 21, 2], [35, 21, 19, 2], [35, 1, 23, 2]]) debris(x, z, width, variant);

  // Broken timbers lead toward the falls of stone at each abandoned heading.
  for (const [x, z, width, variant] of [
    [-8, -97, 55, 0], [-7, -103, 61, 3], [-6, -108, 69, 0], [-.5, -109, 71, 0],
    [5, -109, 67, 1], [9, -106, 52, 0], [11, -101, 51, 0], [9, -95, 39, 0],
    [27, -96, 46, 3], [33, -98, 52, 0], [39, -97, 38, 0], [49, -93, 58, 0], [52, -88, 52, 0],
  ]) ore(x, z, width, variant);
  for (const [x, z, width] of [[-2.5, -103, 23], [4.6, -105, 19], [2.3, -100, 21], [43, -94, 22], [46, -95, 18]]) debris(x, z, width);

  // Bedrock shelves border large open chambers and mark usable gaps between them.
  for (const [x, z, width, variant] of [
    [-109, -39, 69, 0], [-104, -45, 58, 0], [-97, -49, 57, 1], [-93, -54, 46, 0],
    [-92, -88, 62, 0], [-86, -94, 49, 0], [-80, -98, 60, 3], [-73, -102, 57, 0],
    [-39, -96, 65, 0], [-35, -101, 58, 3], [-28, -106, 65, 0],
    [58, -71, 61, 0], [63, -74, 68, 0], [68, -81, 58, 0],
    [86, 21, 69, 0], [93, 18, 67, 0], [97, 12, 55, 2], [103, 7, 52, 0],
    [53, 74, 53, 0], [58, 78, 67, 0], [66, 82, 68, 0], [73, 87, 57, 0],
    [-37, 69, 61, 0], [-42, 75, 63, 0], [-50, 79, 65, 0], [-57, 84, 58, 0],
  ]) ore(x, z, width, variant);

  for (const [x, z, variant] of MINE_LIGHTS) add(x, z, 'mineLamp', 21, .36, variant);
  return props;
}
