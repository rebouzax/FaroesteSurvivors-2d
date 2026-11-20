import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createDesertDressing, crossingZ, desertRavenSites, desertSurfaceAt, isDesertTrail, mailRoadX,
} from '../src/models/DesertLayout.js';
import { RunModel } from '../src/models/RunModel.js';
import { createWorld } from '../src/models/WorldModel.js';
import { EnemySystem } from '../src/systems/EnemySystem.js';
import { sceneryBlocksPath } from '../src/systems/EnemyNavigation.js';

function duel(type, enemy, player, props) {
  const run = new RunModel(() => .42);
  const system = new EnemySystem();
  run.props = props;
  run.time = 22;
  run.spawnTimer = run.specialSpawnTimer = 1000;
  Object.assign(run.player, player);
  const foe = { id: 2, type, hp: 40, maxHp: 40, speed: 3.3, ...enemy };
  run.enemies = [foe];
  return { run, system, foe };
}

test('Desert roads use the same layout for landmarks, traversable routes and footstep surfaces', () => {
  const props = createWorld('desert');
  assert.deepEqual(props, createWorld('desert'));
  for (const landmark of ['tent', 'wagon', 'grave', 'fence', 'waypost', 'telegraph']) {
    assert.ok(props.some(prop => prop.type === landmark));
  }
  for (let coordinate = -105; coordinate <= 105; coordinate += 3) {
    const roadX = mailRoadX(coordinate), roadZ = crossingZ(coordinate);
    assert.ok(isDesertTrail(roadX, coordinate));
    assert.ok(isDesertTrail(coordinate, roadZ));
    assert.equal(desertSurfaceAt(roadX, coordinate), 'trail');
    assert.ok(props.every(prop => Math.hypot(roadX - prop.x, coordinate - prop.z) > prop.radius + .4));
    assert.ok(props.every(prop => Math.hypot(coordinate - prop.x, roadZ - prop.z) > prop.radius + .4));
  }
  assert.ok(createDesertDressing().filter(prop => prop.name === 'bones').length > 10);
  assert.ok(desertRavenSites.length > 2);
  assert.equal(new RunModel(() => .42).enemies.length, 0);
});

test('Chasers skirt a large obstacle instead of walking against its center', () => {
  const rock = { x: 0, z: 0, radius: 3.15 };
  const { run, system, foe } = duel('bat', { x: -9, z: 0 }, { x: 9, z: 0 }, [rock]);
  let widest = 0;
  for (let i = 0; i < 500; i++) {
    system.update(run, 1 / 60);
    widest = Math.max(widest, Math.abs(foe.z));
    assert.ok(Math.hypot(foe.x, foe.z) >= rock.radius - .001);
  }
  assert.ok(widest >= 3.15);
  assert.ok(Math.hypot(run.player.x - foe.x, run.player.z - foe.z) < 2);
});

test('Skeletons withhold an axe when the target is behind a fence, and cover stops airborne axes', () => {
  const fence = { x: -2, z: 1, radius: 4.1, halfX: .3, halfZ: 4, rotation: .15 };
  const { run, system, foe } = duel('skeleton', { x: -8, z: 1, speed: 0, shotTimer: 0 }, { x: 3, z: 1 }, [fence]);
  assert.equal(sceneryBlocksPath(run, -8, 1, 3, 1, .15), true);
  for (let i = 0; i < 100; i++) system.update(run, 1 / 60);
  assert.equal(foe.aimTimer ?? 0, 0);
  assert.equal(run.enemyShots.length, 0);
  run.enemyShots.push({ x: -4, z: 1, vx: 8, vz: 0, age: 0, damage: 30, kind: 'axe' });
  system.updateShots(run, .45);
  assert.equal(run.enemyShots.length, 0);

  run.props = [];
  for (let i = 0; i < 45; i++) system.update(run, 1 / 60);
  assert.equal(run.enemyShots.length, 1);
});

test('A chupacabra leads a moving player and telegraphs a fixed charge before moving', () => {
  const { run, system, foe } = duel('dog', { x: 0, z: 0, chargeTimer: 0 }, { x: 6, z: 0, dx: 0, dz: 1, moving: true }, []);
  system.update(run, 1 / 60);
  assert.ok(foe.charge?.vz > 0);
  assert.equal(run.events.includes('enemy-charge'), true);
  assert.equal(foe.x, 0);
  assert.equal(foe.z, 0);
  const originalVz = foe.charge.vz;
  run.player.dz = -1;
  for (let i = 0; i < 42; i++) system.update(run, 1 / 60);
  assert.ok(foe.x > 1.5 && foe.z > 0);
  assert.equal(foe.charge.vz, originalVz);
});
