export const ENEMY_CELLS = [
  'bat', 'dog', 'vulture', 'skeleton', 'giantBat', 'fireChupacabra', 'shadowMarshal', 'treasure',
];
export const ENEMY_FRAME_SIZE = 80;
const SIZE = {
  bat: 30, dog: 39, vulture: 50, skeleton: 42,
  giantBat: 112, fireChupacabra: 102, shadowMarshal: 69, treasure: 33,
};
const FLIGHT = {
  bat: { altitude: 15, shadow: 17 },
  vulture: { altitude: 28, shadow: 27 },
  giantBat: { altitude: 45, shadow: 61 },
};
const FLAP = [4, 0, 1, 5, 2, 6, 3, 7];
const GALLOP = [4, 1, 5, 2, 6, 0];
const VULTURE_FLAP = [0, 4, 2, 5, 1, 5, 6, 4];
const BOSS_FLAP = [4, 0, 1, 5, 2, 5, 1, 4];
const STRIDE = [0, 4, 1, 5];
const SKITTER = [0, 4, 1, 5, 2, 6, 3, 7];
const cycle = (frames, time) => frames[Math.floor(time) % frames.length];
const smooth = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export function enemyPose(name, enemy, time, travel, distance, bossTell, point = enemy) {
  const flight = FLIGHT[name];
  const seeded = enemy.id * .731;
  let frame, dive = 0;
  switch (name) {
    case 'bat':
      frame = cycle(FLAP, time * 23 + seeded);
      break;
    case 'dog':
      if (enemy.charge) frame = enemy.charge.warning > 0 ? 3 : enemy.charge.left > .25 ? 7 : 6;
      else frame = distance < 1.25 ? 3 : cycle(GALLOP, travel * 4.4 + seeded);
      break;
    case 'vulture': {
      const targetDistance = Math.hypot(point.x - (enemy.targetX ?? point.x), point.z - (enemy.targetZ ?? point.z));
      dive = enemy.warning > 0 ? 0 : smooth((10 - targetDistance) / 5);
      frame = dive > .68 ? 3 : dive > .3 ? 7 : cycle(VULTURE_FLAP, time * 12 + seeded);
      break;
    }
    case 'skeleton':
      if (enemy.throwRelease > 0) frame = enemy.throwRelease > .14 ? 3 : 7;
      else if (enemy.aimTimer > 0) frame = enemy.aimTimer > .28 ? 6 : 2;
      else frame = cycle(STRIDE, travel * 3.8 + seeded);
      break;
    case 'giantBat':
      if (bossTell) frame = bossTell.delay > .48 ? 6 : 3;
      else if (enemy.releaseFlash > 0) frame = enemy.releaseFlash > .23 ? 7 : 5;
      else frame = cycle(BOSS_FLAP, time * 11 + seeded);
      break;
    case 'fireChupacabra':
      if (bossTell) frame = bossTell.delay > .48 ? 2 : 6;
      else if (enemy.dash || enemy.releaseFlash > 0) frame = enemy.releaseFlash > .2 || enemy.dash?.left > .25 ? 7 : 3;
      else frame = cycle(STRIDE, travel * 2.7 + seeded);
      break;
    case 'shadowMarshal':
      if (enemy.releaseFlash > 0) frame = enemy.releaseFlash > .26 ? 3 : 7;
      else if (bossTell) frame = bossTell.delay > .44 ? 6 : 2;
      else frame = cycle(STRIDE, travel * 3 + seeded);
      break;
    case 'treasure':
      frame = cycle(SKITTER, travel * 5.3 + seeded);
      break;
    default:
      return { frame: name, size: 30, shadow: 24, lift: 0, anchorY: 0 };
  }
  const sweep = flight ? Math.sin(time * (name === 'bat' ? 9 : 4) + seeded) * 2 : 0;
  return {
    frame: name + frame,
    size: SIZE[name],
    shadow: flight?.shadow ?? SIZE[name] * .6,
    lift: (flight?.altitude ?? 0) + sweep - dive * 11,
    anchorY: flight ? .5 : .075,
  };
}
