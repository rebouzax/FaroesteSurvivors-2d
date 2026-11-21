import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RunModel } from '../src/models/RunModel.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';

function scene(hero = 'joao', rank = 1) {
  const run = new RunModel(() => .5, 0, {}, { characterId: hero });
  run.abilities.doubleShot = rank;
  run.player.x = 0;
  run.player.z = 0;
  run.enemies = [3, -4].map((x, id) => ({ id, x, z: 0, hp: 100, armor: 0 }));
  run.cooldown = 0;
  return run;
}

test('João hits opposing sides one after the other with the duplicate whip', () => {
  const system = new CombatSystem();
  const run = scene();
  system.update(run, .18);
  assert.ok(run.enemies[0].hp < 100);
  assert.equal(run.enemies[1].hp, 100);
  system.update(run, .1);
  assert.equal(run.enemies[1].hp, 100);
  system.update(run, .02);
  assert.ok(run.enemies[1].hp < 100);
  assert.equal(run.whipEchoes.length, 1);
  assert.ok(Math.cos(run.whipEchoes[0].angle) < -.99);
});

test('Champions and equipped projectile and throwing cards fire their own extras', () => {
  const system = new CombatSystem();
  const run = scene('maria');
  for (const id of ['pistol', 'ghostShot', 'molotov', 'returningBlade', 'pirateBomb', 'silverRain']) run.abilities[id] = 1;
  run.pirateBombTimer = 0;
  system.update(run, .17);
  assert.equal(run.pendingCopies.length, 7);
  system.update(run, .11);
  const primaryCopies = run.primaryShots.filter(shot => shot.copy);
  assert.deepEqual(primaryCopies.map(shot => shot.kind).sort(), ['boomerang', 'dynamite', 'maria']);
  for (const list of [primaryCopies, run.projectiles, run.ghostShots]) assert.ok(list.some(shot => shot.copy && shot.vx < 0));
  const bottle = run.bottles.find(shot => shot.copy);
  assert.equal(bottle.x, -4);
  assert.notEqual(bottle.id, run.bottles[0].id);
  const radial = run.silverShots.find(shot => shot.copy);
  assert.ok(Math.abs(Math.atan2(radial.vz, radial.vx) - Math.PI / 6) < 1e-9);
});

test('Maximum rank generates six distinct fallback directions without extra targets', () => {
  const system = new CombatSystem();
  const run = scene('rosa', 6);
  run.enemies.length = 0;
  system.update(run, .17);
  const directions = new Set(run.pendingCopies.map(shot => shot.heading.toFixed(4)));
  assert.equal(directions.size, 6);
  assert.equal(run.primaryShots.length, 2);
});
