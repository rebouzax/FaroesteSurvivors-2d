export const TOWN_ROADS = [
  { axis: 'z', center: 0, from: -75, to: 63, half: 5.6, paved: true },
  { axis: 'x', center: 0, from: -86, to: 86, half: 4.5, paved: true },
  { axis: 'z', center: -62, from: -66, to: 0, half: 3.4 },
  { axis: 'x', center: -66, from: -70, to: 0, half: 3.25 },
  { axis: 'z', center: 41, from: -40, to: 41, half: 3.4 },
  { axis: 'x', center: -35, from: 0, to: 65, half: 3.25 },
  { axis: 'x', center: 40, from: -49, to: 65, half: 3.6 },
  { axis: 'z', center: -40, from: 0, to: 81, half: 3.45 },
  { axis: 'z', center: 35, from: 40, to: 94, half: 3.5 },
  { axis: 'x', center: 72, from: -40, to: 35, half: 3.3 },
];

export const TOWN_RAILS = [
  [[62, -110], [62, 51]],
  [[62, -57], [71, -46], [71, -10]],
];

// These pads tie each site to its use and provide space between props and streets.
export const TOWN_YARDS = [
  { x: -12, z: -3, halfX: 9, halfZ: 24, surface: 'trade' },
  { x: 14, z: -7, halfX: 9, halfZ: 17, surface: 'trade' },
  { x: 15, z: 15, halfX: 9, halfZ: 6, surface: 'trade' },
  { x: 53, z: -30, halfX: 9, halfZ: 24, surface: 'freight' },
  { x: 71, z: -31, halfX: 7, halfZ: 22, surface: 'freight' },
  { x: -62, z: -36, halfX: 21, halfZ: 21, surface: 'graveyard' },
  { x: -59, z: -9, halfX: 19, halfZ: 5, surface: 'graveyard' },
  { x: -18, z: 31, halfX: 16, halfZ: 11, surface: 'corral' },
  { x: 31, z: 56, halfX: 14, halfZ: 11, surface: 'ash' },
  { x: -19, z: -85, halfX: 10, halfZ: 8, surface: 'ash' },
];

const SHAPES = {
  Saloon: [132, 4.2, 3.5], Store: [114, 3.6, 3.2], Jail: [108, 3.2, 3.2],
  Chapel: [130, 3.8, 3.7], House: [120, 4, 3.4], Mortuary: [109, 3.2, 3.2],
  Stable: [133, 4.6, 3.5], Tower: [101, 1.5, 1.5],
  Hotel: [136, 3.8, 3.6], Forge: [106, 3.5, 2.8], Depot: [146, 4.2, 3.85],
  FreightShed: [126, 4.2, 3.7], RailCar: [112, 1.65, 4.4], RailStop: [37, .96, .72],
  Hearse: [61, 1.6, 1.05], IronGate: [71, 0, 0], Tomb: [30, .8, 1.05],
  Cross: [26, .36, .42], Hitch: [38, 1.15, .23], Crates: [39, 1.05, .76],
  Piano: [33, .92, .56], Sign: [30, .24, .24], Scrub: [22, 0, 0], Ruins: [89, 3.1, 2.35],
  Lamp: [39, .22, .22], Wagon: [48, 1.6, .8], Trough: [36, 1.3, .65],
  Fence: [36, 1.5, .19], Barricade: [40, 1.1, .45], Well: [38, .9, .9], Tree: [70, .62, .62],
  Debris: [26, 0, 0],
};

function onRoad(road, x, z) {
  const vertical = road.axis === 'z', across = vertical ? x : z, along = vertical ? z : x;
  const outsideEnd = Math.max(road.from - along, 0, along - road.to);
  const offset = Math.abs(across - road.center);
  return offset * offset + outsideEnd * outsideEnd < road.half * road.half;
}

export function townGroundAt(x, z) {
  let unpaved = false;
  for (const road of TOWN_ROADS) {
    if (!onRoad(road, x, z)) continue;
    if (road.paved) return 'paved';
    unpaved = true;
  }
  if (unpaved) return 'lane';
  for (const yard of TOWN_YARDS) {
    if (Math.abs(x - yard.x) < yard.halfX && Math.abs(z - yard.z) < yard.halfZ) return yard.surface;
  }
  return 'outskirts';
}

export const townSurfaceAt = (x, z) => {
  const ground = townGroundAt(x, z);
  return ground === 'paved' || ground === 'lane' ? 'trail' : 'rock';
};

export function createTownProps() {
  const props = [];
  const add = (x, z, name, { flip = false, scale = 1, acrossZ = false } = {}) => {
    const [width, a, b] = SHAPES[name];
    const halfX = (acrossZ ? b : a) * scale, halfZ = (acrossZ ? a : b) * scale;
    const building = width >= 89;
    props.push({
      x, z, visual: 'town' + name, width: width * scale, flip, halfX, halfZ,
      radius: Math.hypot(halfX, halfZ), dressing: halfX === 0, occludes: building || name === 'IronGate',
      visualX: x + (building ? halfX * .7 : 0),
      visualZ: z + (building ? halfZ * .7 : 0),
    });
  };
  const place = entries => entries.forEach(([x, z, name, options]) => add(x, z, name, options));

  // Main street: porch fronts, ties for horses, and supplies at the storefronts.
  place([
    [-12, -13, 'Saloon'], [-12, 10, 'Hotel'], [13, -14, 'Store'], [13, 14, 'Forge'],
    [12, 29, 'Jail'], [-8.15, -9, 'Piano'], [-7.35, -18, 'Hitch', { acrossZ: true }],
    [-8, 15.4, 'Hitch', { acrossZ: true }], [-8.3, 7, 'Sign'],
    [8.9, -11, 'Crates'], [12, -9.1, 'Crates', { scale: .73 }], [8, 18.9, 'Trough'],
    [17.4, 19, 'Debris'], [16.75, 26.7, 'Barricade'], [-19, 7, 'Well'],
    [-19, -8.6, 'Crates', { scale: .85 }], [-20, -17, 'Wagon'],
  ]);
  for (const [x, z] of [[-6.85,-24], [6.85,-17], [-6.85,-5.8], [6.85,6.2], [-6.85,21],
    [6.85,27], [-7.1,47], [26,-6], [39,5.9], [-23,5.9], [-48,5.9]]) add(x, z, 'Lamp');

  // Stockyard: an open pen, with breaks at the front and the far corner.
  place([
    [-20, 25, 'Stable'], [-17, 30, 'Trough'], [-26, 30, 'Wagon'],
    [-26, 27.5, 'Crates', { scale: .9 }], [-12.5, 31, 'Hitch'], [-20.6, 35, 'Debris'],
    [-28.2, 22, 'Lamp'], [-27.4, 33.8, 'Fence', { acrossZ: true, flip: true }],
    [-28.1, 27.6, 'Fence', { acrossZ: true, flip: true }], [-25.7, 35.2, 'Fence'],
    [-22.5, 35.2, 'Fence'], [-15, 35.2, 'Fence'], [-11.8, 35.2, 'Fence'],
    [-9.9, 32.5, 'Fence', { acrossZ: true, flip: true }], [-9.7, 27.9, 'Fence', { acrossZ: true, flip: true }],
  ]);

  // Chapel and undertaker flank the path to the two burial plots.
  place([
    [-53, -11, 'Chapel'], [-72, -11, 'Mortuary'], [-68, -6.8, 'Hearse'],
    [-62, -18, 'IronGate'], [-67, -17.1, 'Lamp'], [-57.1, -17.1, 'Lamp'],
    [-79, -23, 'Tree'], [-47, -25, 'Tree', { scale: .85 }],
    [-77, -35, 'Tree', { scale: .9 }], [-81, -47, 'Tree'],
    [-53, -51, 'Tree', { scale: .8 }], [-52, -46, 'Debris'],
    [-56.8, -19.9, 'Fence'], [-53.3, -19.9, 'Fence'], [-70.7, -19.9, 'Fence'], [-74.1, -19.9, 'Fence'],
  ]);
  for (const [x, z] of [[-64.5, -18], [-59.5, -18]]) {
    props.push({ x, z, hidden: true, radius: .46 });
  }
  for (const [row, z] of [-24, -31.5, -40, -47].entries()) {
    for (const x of [-73.8, -68.8, -55.4, -50.4]) {
      add(x + (row % 2 ? .55 : 0), z, (row + Math.round(x)) % 3 ? 'Tomb' : 'Cross', { scale: row % 2 ? .95 : 1.08 });
    }
  }

  // Railway freight. The boxcar occupies the dead-end siding beside the loading ramps.
  place([
    [51.5, -25, 'Depot'], [51.5, -44.5, 'FreightShed'], [71, -29, 'RailCar'], [71, -10, 'RailStop'],
    [76.5, -44.5, 'Tower'], [75, -36.1, 'Trough'], [54, -39.8, 'Crates'],
    [56.4, -40.3, 'Crates', { scale: .78 }], [56.1, -49.2, 'Crates'], [46.6, -47.7, 'Wagon'],
    [55.5, -29.5, 'Lamp'], [56, -19.8, 'Lamp'], [55.6, -48.5, 'Lamp'],
    [54.6, -13, 'Sign'], [67.1, 5.9, 'Sign'], [57.6, -6.2, 'Lamp'], [62, 51, 'RailStop', { scale: .85 }],
  ]);

  // The two burnt settlements give way to open, dry outskirts.
  place([
    [24, 53.8, 'House'], [39.8, 56, 'Ruins'], [42.5, 64.5, 'Tree'], [23, 60.6, 'Well'],
    [18, 53.9, 'Fence'], [16.7, 50.7, 'Barricade'], [26.6, 62, 'Debris'],
    [-20.4, -86, 'Ruins'], [-14, -91, 'Tree'], [-26, -83.8, 'Debris'], [-23.2, -76.8, 'Fence'],
    [-44.7, 81, 'Well'], [-50, 84.5, 'Tree'], [-46, 76.6, 'Trough'],
    [37.5, 93, 'Barricade'], [43.3, 97, 'Scrub', { scale: 1.3 }],
    [-29, -102, 'Scrub'], [-34, -99, 'Scrub'], [-72.7, -66.1, 'Sign'],
    [-84, -13, 'Scrub'], [-93, -16, 'Scrub', { scale: 1.3 }], [88, -47, 'Scrub'],
    [83, -41, 'Scrub'], [88, -20, 'Tree', { scale: .84 }], [-90, 36, 'Tree', { scale: .82 }],
    [-87, 38, 'Scrub'], [-73, 36, 'Scrub'], [68, 79, 'Scrub', { scale: 1.1 }],
  ]);
  return props;
}
