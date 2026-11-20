const CELL = 4.5;
const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const BODY_RADIUS = {
  bat: .95, dog: 1.15, skeleton: 1, vulture: 1.3,
  giantBat: 1.85, fireChupacabra: 1.85, shadowMarshal: 1.32,
};

export const enemyBodyRadius = enemy => enemy.treasure ? 1.1 : BODY_RADIUS[enemy.bossId || enemy.type] ?? .95;
const weight = enemy => enemy.dash || enemy.charge?.warning === 0 ? 0 : enemy.bossId ? .24 : 1;
const cellKey = (x, z) => x * 128 + z;
const present = enemy => enemy.hp > 0 && enemy.type !== 'vulture';

export class EnemyCrowd {
  constructor(enemies) {
    this.cells = new Map();
    for (const enemy of enemies) {
      if (!present(enemy)) continue;
      const key = cellKey(Math.floor(enemy.x / CELL), Math.floor(enemy.z / CELL));
      if (!this.cells.has(key)) this.cells.set(key, []);
      this.cells.get(key).push(enemy);
    }
  }

  *neighbors(enemy) {
    const x = Math.floor(enemy.x / CELL), z = Math.floor(enemy.z / CELL);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const bucket = this.cells.get(cellKey(x + dx, z + dz));
        if (bucket) yield* bucket;
      }
    }
  }

  steer(enemy, heading) {
    const radius = enemyBodyRadius(enemy);
    for (const other of this.neighbors(enemy)) {
      if (enemy === other) continue;
      const x = enemy.x - other.x, z = enemy.z - other.z;
      const preferred = radius + enemyBodyRadius(other) + .75;
      const square = x * x + z * z;
      if (square >= preferred * preferred || square < 1e-6) continue;
      const distance = Math.sqrt(square);
      const strength = (1 - distance / preferred) * 2.4 / distance;
      heading.x += x * strength;
      heading.z += z * strength;
    }
    return heading;
  }

  resolve(enemies, move) {
    let overlaps = 0;
    for (const enemy of enemies) {
      if (!present(enemy)) continue;
      const radius = enemyBodyRadius(enemy);
      for (const other of this.neighbors(enemy)) {
        if (other.id <= enemy.id) continue;
        let x = enemy.x - other.x, z = enemy.z - other.z;
        const min = radius + enemyBodyRadius(other);
        const square = x * x + z * z;
        if (square >= min * min) continue;
        const first = weight(enemy), second = weight(other);
        if (!first && !second) continue;
        const distance = Math.sqrt(square);
        if (distance < .001) {
          const angle = (enemy.id * 11 + other.id) * GOLDEN_ANGLE % TAU;
          x = Math.cos(angle);
          z = Math.sin(angle);
        } else {
          x /= distance;
          z /= distance;
        }
        const shift = Math.min(.45, Math.max(0, min - distance - .035)) / (first + second);
        if (!shift) continue;
        if (first) move(enemy, x * shift * first, z * shift * first);
        if (second) move(other, -x * shift * second, -z * shift * second);
        overlaps++;
      }
    }
    return overlaps;
  }
}
