import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAMPAIGN, heroUnlocked, stageUnlocked, unlockedGameplayCards } from '../src/config/campaignConfig.js';
import { abilityStats } from '../src/config/abilityConfig.js';
import { championAbilityStats } from '../src/config/championCards.js';
import { RunModel } from '../src/models/RunModel.js';
import { TOWN_RAILS, TOWN_ROADS, townGroundAt, townSurfaceAt } from '../src/models/TownLayout.js';
import { ProfileService } from '../src/services/ProfileService.js';
import { BossSystem } from '../src/systems/BossSystem.js';
import { sceneryBlocksPath } from '../src/systems/EnemyNavigation.js';
import { RunSystem } from '../src/systems/RunSystem.js';
import { enemyPose } from '../src/views/EnemyAnimation.js';

test('Cidade Fantasma follows Mina and saves the original champion and card rewards', () => {
  const profile = new ProfileService({ getItem: () => null, setItem() {} });
  profile.data.storyClears.desert = true;
  assert.equal(stageUnlocked(profile.data, 'town'), false);
  profile.data.storyClears.mine = true;
  assert.equal(stageUnlocked(profile.data, 'town'), true);
  assert.equal(heroUnlocked(profile.data, 'silas'), false);
  const run = new RunModel(() => .4, 0, {}, { mapId: 'town', mode: 'story' });
  Object.assign(run, { phase: 'victory', time: 900, missionsCompleted: 4 });
  run.bossEncounter.nextBoss = 3;
  run.completedMissionIds.add('town:1');
  run.completedMissionIds.add('town:2');
  profile.recordRun(run);
  for (const id of ['silas', 'teo']) assert.equal(heroUnlocked(profile.data, id), true);
  for (const id of ['boneStorm', 'lastStand']) assert.ok(unlockedGameplayCards(profile.data).includes(id));
});

test('The two new champions carry different card bonuses into combat', () => {
  assert.equal(championAbilityStats('silas', 'ghostShot', 1).useCritical, true);
  assert.equal(championAbilityStats('silas', 'returningBlade', 1).cooldown, abilityStats('returningBlade', 1).cooldown * .8);
  assert.equal(championAbilityStats('teo', 'silverRain', 1).count, abilityStats('silverRain', 1).count + 2);
  assert.equal(championAbilityStats('teo', 'pistol', 1).flightScale, 1.18);
});

test('City streets are open and all three bosses enter with their own tells and frames', () => {
  const run = new RunModel(() => .4, 0, {}, { mapId: 'town', mode: 'story' });
  assert.equal(townSurfaceAt(0, 11), 'trail');
  assert.equal(townSurfaceAt(13, 13), 'rock');
  assert.equal(sceneryBlocksPath(run, -24, 0, 24, 0, .4), false);
  assert.equal(sceneryBlocksPath(run, -23, -13, -7, -13, .4), true);
  const system = new RunSystem();
  Object.assign(run, { phase: 'playing', playerArmor: 300 });
  run.player.z = 0;
  for (const spec of CAMPAIGN.town.bosses) {
    run.time = spec.at;
    system.update(run, 1 / 60, { x: 0, z: 0 });
    const boss = run.enemies.find(enemy => enemy.bossId);
    assert.equal(boss.bossId, spec.id);
    boss.attackTimer = 0;
    const elapsed = run.time;
    system.update(run, 1 / 60, { x: 0, z: 0 });
    assert.equal(run.time, elapsed);
    assert.equal(run.bossTelegraph.pattern, spec.pattern);
    assert.equal(enemyPose(spec.id, boss, run.time, 0, 5, run.bossTelegraph).frame, spec.id + '2');
    boss.hp = 0;
    system.update(run, 1 / 60, { x: 0, z: 0 });
  }
  assert.equal(run.bossEncounter.completed, true);
});

test('Town roads connect the districts and freight stays on the siding', () => {
  const run = new RunModel(() => .4, 0, {}, { mapId: 'town' });
  for (const { axis, center, from, to } of TOWN_ROADS) {
    const [ax, az, bx, bz] = axis === 'z' ? [center, from, center, to] : [from, center, to, center];
    assert.equal(sceneryBlocksPath(run, ax, az, bx, bz, .95), false, `${axis} = ${center}`);
    assert.equal(townSurfaceAt(ax, az), 'trail');
    assert.equal(townSurfaceAt(bx, bz), 'trail');
  }
  const tombs = run.props.filter(prop => prop.visual === 'townTomb');
  assert.ok(tombs.length && tombs.every(tomb => townGroundAt(tomb.x, tomb.z) === 'graveyard'));
  const boxcar = run.props.find(prop => prop.visual === 'townRailCar');
  const [[sidingX, sidingStart], [, sidingEnd]] = TOWN_RAILS[1].slice(-2);
  assert.equal(boxcar.x, sidingX);
  assert.ok(boxcar.z > sidingStart && boxcar.z < sidingEnd);
  assert.equal(townGroundAt(boxcar.x, boxcar.z), 'freight');
});

test('A boss lunge stops at cover and cannot damage a player through it', () => {
  const run = new RunModel(() => .4, 0, {}, { mapId: 'town' });
  const system = new BossSystem();
  run.time = 300;
  system.start(run);
  const boss = run.enemies.find(enemy => enemy.bossId);
  Object.assign(boss, { x: -4, z: 0, attackTimer: 10 });
  Object.assign(run.player, { x: 1.1, z: 0 });
  run.props = [{ x: 0, z: 0, halfX: .25, halfZ: 3, radius: 3.1 }];
  const health = run.player.hp;
  system.resolve(run, boss, { pattern: 'lunge', angle: 0 });
  for (let i = 0; i < 50; i++) system.updateArena(run, 1 / 60);
  assert.ok(boss.x <= -1.14);
  assert.equal(boss.dash, null);
  assert.equal(run.player.hp, health);
});

test('Bone Singer summons skeletons outside the player’s immediate reach', () => {
  const run = new RunModel(() => .4, 0, {}, { mapId: 'town' });
  const system = new BossSystem();
  run.player.z = 0;
  run.bossEncounter.nextBoss = 1;
  run.time = CAMPAIGN.town.bosses[1].at;
  system.start(run);
  const boss = run.enemies.find(enemy => enemy.bossId);
  system.resolve(run, boss, { pattern: 'summonSkeleton', angle: Math.PI });
  const minions = run.enemies.filter(enemy => enemy.summoned);
  assert.equal(minions.length, 3);
  assert.ok(minions.every(enemy => enemy.type === 'skeleton' &&
    Math.hypot(enemy.x - run.player.x, enemy.z - run.player.z) >= 2.5));
});
