import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RunModel } from '../src/models/RunModel.js';
import { enemyBodyRadius } from '../src/systems/EnemyCrowd.js';
import { EnemySystem } from '../src/systems/EnemySystem.js';
import { ENEMY_CELLS, enemyPose } from '../src/views/EnemyAnimation.js';

const pairDistances = enemies => enemies.flatMap((a, i) => enemies.slice(i + 1).map(b =>
  Math.hypot(a.x - b.x, a.z - b.z) / (enemyBodyRadius(a) + enemyBodyRadius(b))));

test('A crowded desert wave spreads around the player without blocking contact attacks', () => {
  const run = new RunModel(() => .42);
  const system = new EnemySystem();
  run.props = [];
  run.time = 22;
  run.spawnTimer = run.specialSpawnTimer = 1000;
  run.player.x = run.player.z = 0;
  run.enemies = Array.from({ length: 48 }, (_, i) => ({
    id: i + 1, type: ['bat', 'dog', 'skeleton'][i % 3],
    hp: 30, maxHp: 30, speed: 3.3, x: 8, z: 7,
  }));

  for (let i = 0; i < 180; i++) system.update(run, 1 / 60);

  assert.ok(Math.min(...pairDistances(run.enemies)) >= .94);
  const directions = new Set(run.enemies.filter(e => Math.hypot(e.x, e.z) < 10)
    .map(e => Math.floor((Math.atan2(e.z, e.x) + Math.PI) * 4 / Math.PI)));
  assert.ok(directions.size >= 6);
  assert.ok(run.enemies.some(e => Math.hypot(e.x, e.z) < .85));
});

test('Ground spawns near the map edge have room to move and vulture lanes stay separated', () => {
  const run = new RunModel(() => .42);
  const system = new EnemySystem();
  run.player.x = run.player.z = 118;
  run.props = [{ x: 92, z: 96, radius: 2.8 }];
  for (let i = 0; i < 20; i++) system.spawn(run, 'dog');
  assert.equal(run.enemies.length, 20);
  assert.ok(Math.min(...pairDistances(run.enemies)) > 1.4);
  assert.ok(run.enemies.every(e => Math.hypot(e.x - 92, e.z - 96) > 3.4));
  assert.ok(run.enemies.every(e => Math.abs(e.x) <= 119 && Math.abs(e.z) <= 119));

  system.spawnVultures(run);
  const vultures = run.enemies.filter(e => e.type === 'vulture');
  assert.equal(vultures.length, 6);
  const normal = [vultures[0].vz / 10, -vultures[0].vx / 10];
  const lanes = vultures.map(e => e.x * normal[0] + e.z * normal[1]).sort((a, b) => a - b);
  assert.ok(lanes.slice(1).every((lane, i) => lane - lanes[i] >= 2.59));
  assert.equal(new Set(vultures.map(e => (e.x * e.vx + e.z * e.vz).toFixed(3))).size, 3);
});

test('Every desert creature uses a frame sequence and attack poses follow combat state', () => {
  const enemy = { id: 3, x: 0, z: 0, targetX: 20, targetZ: 20 };
  for (const type of ENEMY_CELLS) {
    const poses = new Set(Array.from({ length: 24 }, (_, i) => enemyPose(type, enemy, i / 10, i / 5, 5, false).frame));
    assert.ok(poses.size >= 2, type);
    assert.ok([...poses].every(pose => pose.startsWith(type)));
  }
  assert.equal(enemyPose('skeleton', { ...enemy, aimTimer: .3 }, 0, 2, 8, false).frame, 'skeleton6');
  assert.equal(enemyPose('skeleton', { ...enemy, aimTimer: .2 }, 0, 2, 8, false).frame, 'skeleton2');
  assert.equal(enemyPose('skeleton', { ...enemy, throwRelease: .2 }, 0, 2, 8, false).frame, 'skeleton3');
  assert.equal(enemyPose('vulture', { ...enemy, targetX: 1, targetZ: 1 }, 0, 2, 8, false).frame, 'vulture3');
  assert.equal(enemyPose('giantBat', enemy, 0, 2, 8, { delay: .2 }).frame, 'giantBat3');
  assert.equal(enemyPose('giantBat', enemy, 0, 2, 8, { delay: .7 }).frame, 'giantBat6');
  assert.equal(enemyPose('fireChupacabra', enemy, 0, 2, 8, { delay: .7 }).frame, 'fireChupacabra2');
  assert.equal(enemyPose('fireChupacabra', enemy, 0, 2, 8, { delay: .2 }).frame, 'fireChupacabra6');
  assert.equal(enemyPose('shadowMarshal', { ...enemy, releaseFlash: .4 }, 0, 2, 8, false).frame, 'shadowMarshal3');
});

test('Vulture altitude closes in smoothly on the attack lane', () => {
  const sample = x => enemyPose('vulture', { id: 1, x, z: 0, targetX: 0, targetZ: 0 }, 1, 0, x).lift;
  const heights = [11, 9, 7, 5].map(sample);
  assert.ok(heights.every((height, i) => i === 0 || height < heights[i - 1]));
  assert.ok(heights.slice(1).every((height, i) => heights[i] - height < 7));
});
