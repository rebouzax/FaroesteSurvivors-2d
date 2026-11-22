export const ENEMY_CELLS = [
  'bat', 'dog', 'vulture', 'skeleton', 'giantBat', 'fireChupacabra', 'shadowMarshal', 'treasure',
];
export const ENEMY_FRAME_SIZE = 80;
const SIZE = {
  bat: 30, dog: 39, vulture: 50, skeleton: 42,
  giantBat: 112, fireChupacabra: 102, shadowMarshal: 69, treasure: 33,
  miner: 47, mineSpider: 43, mineSkull: 38, blindCrawler: 38, treasureRat: 43,
  shovelMiner: 99, giantMoth: 112, minerGeneral: 95,
  wraith: 46, townZombie: 46, townGhoul: 43, headlessOutlaw: 56,
  boneHound: 108, boneSinger: 101, zombieDeputy: 88, treasureZombie: 43,
};
const FLIGHT = {
  bat: { altitude: 15, shadow: 17 },
  vulture: { altitude: 28, shadow: 27 },
  giantBat: { altitude: 45, shadow: 61 },
  mineSkull: { altitude: 15, shadow: 19 },
  giantMoth: { altitude: 37, shadow: 53 },
  wraith: { altitude: 23, shadow: 22 },
};
const FLAP = [4, 0, 1, 5, 2, 6, 3, 7];
const GALLOP = [4, 1, 5, 2, 6, 0];
const VULTURE_FLAP = [0, 4, 2, 5, 1, 5, 6, 4];
const BOSS_FLAP = [4, 0, 1, 5, 2, 5, 1, 4];
const STRIDE = [0, 4, 1, 5];
const SKITTER = [0, 4, 1, 5, 2, 6, 3, 7];
const WALK = [0, 1, 2, 3];
const TWO_STEP = [0, 1];
const MOTH_FLAP = [0, 1, 2, 1];
// Each mask marks the exact sprite slots where feet land or wings push down.
const GAIT = {
  bat: [FLAP, 23, 1 << 4],
  vulture: [VULTURE_FLAP, 12, 1 << 4],
  giantBat: [BOSS_FLAP, 11, 1 << 4],
  dog: [GALLOP, 4.4, 0b001001],
  skeleton: [STRIDE, 3.8, 0b0101],
  fireChupacabra: [STRIDE, 2.7, 0b0101],
  shadowMarshal: [STRIDE, 3, 0b0101],
  treasure: [SKITTER, 5.3, 0b00010001],
  miner: [WALK, 3, 0b0101],
  mineSpider: [WALK, 6, 0b0101],
  mineSkull: [TWO_STEP, 5, 0b10],
  blindCrawler: [TWO_STEP, 4.5, 0b01],
  treasureRat: [TWO_STEP, 4.5, 0b01],
  shovelMiner: [TWO_STEP, 1.9, 0b11],
  minerGeneral: [TWO_STEP, 1.9, 0b11],
  giantMoth: [MOTH_FLAP, 11, 1 << 2],
  wraith: [TWO_STEP, 7, 0b10],
  townZombie: [TWO_STEP, 2.8, 0b01],
  townGhoul: [TWO_STEP, 5.5, 0b11],
  headlessOutlaw: [TWO_STEP, 2.9, 0b01],
  boneHound: [TWO_STEP, 4.6, 0b11],
  boneSinger: [TWO_STEP, 1.9, 0b01],
  zombieDeputy: [TWO_STEP, 2.45, 0b11],
  treasureZombie: [WALK, 5.3, 0b0101],
};
const smooth = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export function enemyPose(name, enemy, time, travel, distance, bossTell, point = enemy, visual = time) {
  const flight = FLIGHT[name];
  const seeded = enemy.id * .731;
  const strike = visual < (enemy.attackCueUntil ?? -Infinity);
  let frame, contact, dive = 0;
  switch (name) {
    case 'bat':
      if (strike) frame = 6;
      break;
    case 'dog':
      if (enemy.charge) frame = enemy.charge.warning > 0 ? 3 : enemy.charge.left > .25 ? 7 : 6;
      else if (strike || distance < 1.25) frame = 3;
      break;
    case 'vulture': {
      const targetDistance = Math.hypot(point.x - (enemy.targetX ?? point.x), point.z - (enemy.targetZ ?? point.z));
      dive = enemy.warning > 0 ? 0 : smooth((10 - targetDistance) / 5);
      if (strike || dive > .3) frame = strike || dive > .68 ? 3 : 7;
      break;
    }
    case 'skeleton':
      if (enemy.throwRelease > 0) frame = enemy.throwRelease > .14 ? 3 : 7;
      else if (strike) frame = 3;
      else if (enemy.aimTimer > 0) frame = enemy.aimTimer > .28 ? 6 : 2;
      break;
    case 'giantBat':
      if (bossTell) frame = bossTell.delay > .48 ? 6 : 3;
      else if (enemy.releaseFlash > 0) frame = enemy.releaseFlash > .23 ? 7 : 5;
      else if (strike) frame = 7;
      break;
    case 'fireChupacabra':
      if (bossTell) frame = bossTell.delay > .48 ? 2 : 6;
      else if (enemy.dash || enemy.releaseFlash > 0) frame = enemy.releaseFlash > .2 || enemy.dash?.left > .25 ? 7 : 3;
      else if (strike) frame = 7;
      break;
    case 'shadowMarshal':
      if (enemy.releaseFlash > 0 || strike) frame = strike || enemy.releaseFlash > .26 ? 3 : 7;
      else if (bossTell) frame = bossTell.delay > .44 ? 6 : 2;
      break;
    case 'miner':
      if (strike || enemy.attackFlash > .3) frame = 3;
      break;
    case 'mineSpider':
      if (strike) frame = 3;
      break;
    case 'mineSkull':
      if (strike || enemy.aimTimer > 0) frame = 1;
      break;
    case 'blindCrawler':
      if (strike || enemy.charge?.launched) frame = 1;
      break;
    case 'shovelMiner':
    case 'minerGeneral':
      if (bossTell) frame = 2;
      else if (strike || enemy.releaseFlash > 0 || enemy.dash) frame = 3;
      break;
    case 'giantMoth':
      if (bossTell || strike || enemy.dash) frame = 3;
      break;
    case 'wraith':
    case 'townZombie':
      if (strike) frame = 2;
      else if (enemy.hitFlash > .04) frame = 3;
      break;
    case 'townGhoul':
      if (enemy.charge) frame = enemy.charge.warning > 0 ? 2 : 3;
      else if (strike) frame = 3;
      break;
    case 'headlessOutlaw':
      if (strike || enemy.throwRelease > 0) frame = 3;
      else if (enemy.aimTimer > 0) frame = 2;
      break;
    case 'boneHound':
    case 'boneSinger':
    case 'zombieDeputy':
      if (bossTell) frame = 2;
      else if (strike || enemy.releaseFlash > 0 || enemy.dash) frame = 3;
      break;
  }
  if (frame === undefined) {
    const gait = GAIT[name];
    if (!gait) return { frame: name, size: 30, shadow: 24, lift: 0, anchorY: 0 };
    const [frames, rate, accents] = gait;
    const step = Math.floor((flight ? time : travel) * rate + seeded);
    const slot = step % frames.length;
    frame = frames[slot];
    if (accents & (1 << slot)) contact = step;
  }
  const sweep = flight ? Math.sin(time * (name === 'bat' ? 9 : 4) + seeded) * 2 : 0;
  return {
    frame: (name === 'treasureRat' ? 'blindCrawler' : name) + frame,
    contact, airborne: Boolean(flight), diveAttack: name === 'vulture' && dive > .68,
    size: SIZE[name],
    shadow: flight?.shadow ?? SIZE[name] * .6,
    lift: (flight?.altitude ?? 0) + sweep - dive * 11,
    anchorY: flight ? .5 : .075,
  };
}
