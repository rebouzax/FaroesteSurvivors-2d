import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RunModel } from '../src/models/RunModel.js';
import { actorHurt } from '../src/models/ActorCues.js';
import { BattlefieldMotion } from '../src/views/BattlefieldMotion.js';
import { CHAMPION_CELLS, championPose } from '../src/views/ChampionAnimation.js';

test('Every playable champion uses its own idle, stride, attack and hurt frames', () => {
  for (const id of CHAMPION_CELLS) {
    const idle = { moving: false, travel: 0 };
    const name = state => championPose(id, { ...idle, ...state }).frame;
    assert.equal(name(), id + 'Pose0');
    assert.equal(name({ moving: true }), id + 'Pose1');
    assert.equal(name({ moving: true, travel: .8 }), id + 'Pose2');
    assert.equal(name({ moving: true, travel: 1.6 }), id + 'Pose3');
    assert.equal(name({ attack: { hit: false }, attackAge: .12 }), id + 'Pose4');
    assert.equal(name({ attack: { hit: true }, attackAge: .19 }), id + 'Pose5');
    assert.equal(name({ attack: { hit: true }, attackAge: .33 }), id + 'Pose6');
    assert.equal(name({ hurt: true }), id + 'Pose7');
  }
});

test('Interpolating an actor leaves game coordinates alone and snaps replacements and teleports', () => {
  const run = new RunModel(() => .5);
  const motion = new BattlefieldMotion();
  const enemy = { x: 4, z: -1 };
  const shot = { x: 2, z: 5, age: 0 };
  run.enemies.push(enemy);
  run.primaryShots.push(shot);
  const playerStart = run.player.x;
  motion.capture(run);
  run.player.x += .16;
  run.player.travel += .16;
  run.visualTime += 1 / 60;
  enemy.x += 25;
  shot.x += .4;
  shot.age += 1 / 60;
  const effect = motion.actor(shot, .5, {});
  assert.equal(effect.age, 1 / 120);
  assert.equal(effect.x, 2.2);
  assert.equal(motion.actor(run.player, .5, {}).x, playerStart + .08);
  assert.equal(run.player.x, playerStart + .16);
  assert.equal(motion.actor(enemy, .5, {}), enemy);
  const newcomer = { ...enemy };
  assert.equal(motion.actor(newcomer, .5, {}), newcomer);
  assert.equal(motion.clock(run, .5).visual, 1 / 120);
  assert.equal(motion.clock(run, .5).travel, .08);
  motion.reset();
  assert.equal(motion.actor(run.player, .5, {}), run.player);
});

test('Damage is retained through catch-up updates without confusing invulnerability with a hit', () => {
  const run = new RunModel(() => .5);
  const motion = new BattlefieldMotion();
  run.player.invulnerable = 1.5;
  motion.capture(run);
  assert.equal(motion.clock(run, 1).hurt, false);

  actorHurt(run, run.player);
  run.events = [];
  run.visualTime += .1;
  motion.capture(run);
  assert.equal(motion.clock(run, 1).hurt, true);
  run.visualTime += .18;
  assert.equal(motion.clock(run, 1).hurt, false);
});
