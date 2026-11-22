import { nearbyProps } from './SceneryCollision.js';

const TURNS = [26, 49, 73, 96, 122].map(degrees => {
  const angle = degrees * Math.PI / 180;
  return [Math.cos(angle), Math.sin(angle)];
});

function hitsCircle(x, z, dx, dz, radius) {
  const along = Math.max(0, Math.min(1, -(x * dx + z * dz) / Math.max(.000001, dx * dx + dz * dz)));
  const px = x + dx * along, pz = z + dz * along;
  return px * px + pz * pz < radius * radius - .00001;
}

function hitsBox(x, z, dx, dz, halfX, halfZ) {
  let enter = 0, leave = 1;
  if (Math.abs(dx) > .000001) {
    const near = (-halfX - x) / dx, far = (halfX - x) / dx;
    enter = Math.max(enter, Math.min(near, far));
    leave = Math.min(leave, Math.max(near, far));
  } else if (Math.abs(x) >= halfX) return false;
  if (Math.abs(dz) > .000001) {
    const near = (-halfZ - z) / dz, far = (halfZ - z) / dz;
    enter = Math.max(enter, Math.min(near, far));
    leave = Math.min(leave, Math.max(near, far));
  } else if (Math.abs(z) >= halfZ) return false;
  return enter < leave - .00001;
}

function hitsProp(x, z, dx, dz, prop, padding) {
  const px = x - prop.x, pz = z - prop.z;
  const extent = (prop.halfX === undefined ? prop.radius : prop.halfX + prop.halfZ) + padding;
  if (Math.min(px, px + dx) >= extent || Math.max(px, px + dx) <= -extent ||
      Math.min(pz, pz + dz) >= extent || Math.max(pz, pz + dz) <= -extent) return false;
  if (prop.halfX === undefined) return hitsCircle(px, pz, dx, dz, extent);
  const sin = prop.rotation ? Math.sin(prop.rotation) : 0, cos = prop.rotation ? Math.cos(prop.rotation) : 1;
  const localX = px * cos - pz * sin, localZ = px * sin + pz * cos;
  const localDX = dx * cos - dz * sin, localDZ = dx * sin + dz * cos;
  if (hitsBox(localX, localZ, localDX, localDZ, prop.halfX + padding, prop.halfZ)
    || hitsBox(localX, localZ, localDX, localDZ, prop.halfX, prop.halfZ + padding)) return true;
  for (let sideX = -1; sideX <= 1; sideX += 2) {
    for (let sideZ = -1; sideZ <= 1; sideZ += 2) {
      if (hitsCircle(localX - sideX * prop.halfX, localZ - sideZ * prop.halfZ, localDX, localDZ, padding)) return true;
    }
  }
  return false;
}

export function sceneryBlocksPath(run, x, z, targetX, targetZ, padding) {
  if (!run.props.length) return false;
  const dx = targetX - x, dz = targetZ - z;
  const probes = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 2));
  let previous;
  for (let i = 0; i <= probes; i++) {
    const t = i / probes;
    const props = nearbyProps(run, x + dx * t, z + dz * t);
    if (props === previous) continue;
    previous = props;
    for (const prop of props) {
      if (hitsProp(x, z, dx, dz, prop, padding)) return true;
    }
  }
  return false;
}

export class EnemyNavigation {
  constructor() {
    this.detours = new WeakMap();
    this.sightLines = new WeakMap();
    this.headings = new WeakMap();
  }

  seesPlayer(run, enemy, dt) {
    const { x, z } = run.player;
    const previous = this.sightLines.get(enemy);
    if (previous && previous.props === run.props && (previous.liveFor -= dt) > 0 &&
      Math.hypot(x - previous.x, z - previous.z) < .75 &&
      Math.hypot(enemy.x - previous.enemyX, enemy.z - previous.enemyZ) < .75) return previous.visible;
    const visible = !sceneryBlocksPath(run, enemy.x, enemy.z, x, z, .15);
    this.sightLines.set(enemy, {
      x, z, enemyX: enemy.x, enemyZ: enemy.z, liveFor: .13 + enemy.id % 5 * .012,
      visible, props: run.props,
    });
    return visible;
  }

  steer(run, enemy, heading, dt, clearance = .38) {
    const magnitude = Math.hypot(heading.x, heading.z);
    if (magnitude < .01 || !run.props.length) return heading;

    const x = heading.x / magnitude, z = heading.z / magnitude;
    const previous = this.headings.get(enemy);
    if (previous && previous.props === run.props && (previous.ttl -= dt) > 0 &&
        (x * previous.x + z * previous.z) > .976 &&
        (enemy.x - previous.startX) ** 2 + (enemy.z - previous.startZ) ** 2 < .24) {
      if (previous.straight) return heading;
      return { x: previous.outX * magnitude, z: previous.outZ * magnitude };
    }
    const result = this.findHeading(run, enemy, x, z, dt, clearance);
    if (result.x !== 0 || result.z !== 0) {
      const memo = previous ?? {};
      Object.assign(memo, { x, z, startX: enemy.x, startZ: enemy.z, props: run.props,
        ttl: .065 + enemy.id % 5 * .016, outX: result.x, outZ: result.z, straight: result.x === x && result.z === z });
      if (!previous) this.headings.set(enemy, memo);
    } else this.headings.delete(enemy);
    return { x: result.x * magnitude, z: result.z * magnitude };
  }

  findHeading(run, enemy, x, z, dt, clearance) {
    const span = 1.25 + enemy.speed * .36;
    const blocked = (dx, dz, distance = span) => sceneryBlocksPath(
      run, enemy.x, enemy.z, enemy.x + dx * distance, enemy.z + dz * distance, clearance,
    );
    const detour = this.detours.get(enemy);
    const preferred = detour?.side ?? (enemy.id % 2 ? 1 : -1);
    if (!blocked(x, z)) {
      if (!detour || (detour.releaseIn -= Math.max(dt, .06)) <= 0) {
        this.detours.delete(enemy);
        return { x, z };
      }
      const [cos, sin] = TURNS[0];
      const px = x * cos - z * sin * preferred, pz = z * cos + x * sin * preferred;
      return blocked(px, pz) ? { x, z } : { x: px, z: pz };
    }

    for (const side of [preferred, -preferred]) {
      for (const [cos, sin] of TURNS) {
        const px = x * cos - z * sin * side, pz = z * cos + x * sin * side;
        if (blocked(px, pz)) continue;
        this.detours.set(enemy, { side, releaseIn: .22 });
        return { x: px, z: pz };
      }
    }
    // At tight corners make a short move around the edge instead of trying to force a straight route.
    for (const side of [preferred, -preferred]) {
      const px = -z * side, pz = x * side;
      if (blocked(px, pz, .65)) continue;
      this.detours.set(enemy, { side, releaseIn: .22 });
      return { x: px, z: pz };
    }
    return { x: 0, z: 0 };
  }
}
