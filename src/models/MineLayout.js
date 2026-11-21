export const MINE_TRACKS = { northSouth: [0, -64, 64], eastWest: [-50, 14, 76] };

export function mineSurfaceAt(x, z) {
  return MINE_TRACKS.northSouth.some(track => Math.abs(track - x) < 2.25) ||
    MINE_TRACKS.eastWest.some(track => Math.abs(track - z) < 2.25) ? 'trail' : 'rock';
}

export function createMineProps() {
  const props = [];
  const add = (x, z, visual, width, radius) => props.push({ x, z, type: 'mine', visual, width, radius });
  for (const track of MINE_TRACKS.northSouth) {
    for (let i = 0; i < 12; i++) {
      const z = -107 + i * 19;
      if (MINE_TRACKS.eastWest.some(crossing => Math.abs(z - crossing) < 8)) continue;
      const side = i % 2 ? 1 : -1;
      const x = track + side * 6.2;
      add(x, z, i % 3 ? 'mineCart' : 'mineOre', i % 3 ? 34 : 27, 1.05);
      add(track - side * 5.2, z - 3, 'mineLamp', 19, .36);
    }
  }
  for (const track of MINE_TRACKS.eastWest) {
    for (let i = 0; i < 9; i++) {
      const x = -105 + i * 26;
      if (MINE_TRACKS.northSouth.some(crossing => Math.abs(x - crossing) < 7)) continue;
      props.push({ x, z: track + 2.35, type: 'mine', visual: 'mineBeam', visualZ: track, width: 53, radius: .55 });
      props.push({ x, z: track - 2.35, type: 'mine', hidden: true, radius: .55 });
      if (i % 2) add(x - 3.1, track - 4, 'mineLamp', 20, .38);
    }
  }
  // Broken pillars leave a wide route through each junction and between galleries.
  for (const x of [-106, -84, -39, -22, 29, 45, 85, 105]) {
    for (const z of [-100, -74, -26, 40, 58, 99]) {
      const offset = Math.sin(x * 2.71 + z) * 4;
      add(x + offset, z + offset * .67, 'mineOre', 27 + Math.abs(offset) * 4, 1.35 + Math.abs(offset) * .17);
    }
  }
  for (const [x, z, width] of [[-11, 1, 52], [-14, 4, 39], [11, -5, 57], [15, -3, 43], [7, 23, 49], [-10, 23, 47]]) {
    add(x, z, 'mineOre', width, width / 18);
  }
  add(-7, 4, 'mineLamp', 20, .35);
  add(6, -1, 'mineLamp', 21, .35);
  return props;
}
