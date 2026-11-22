import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAMPAIGN, heroUnlocked, stageUnlocked } from '../src/config/campaignConfig.js';
import { ENEMY_WAVES } from '../src/config/playableStages.js';
import { RunModel } from '../src/models/RunModel.js';
import { ProfileService } from '../src/services/ProfileService.js';
import { EnemySystem } from '../src/systems/EnemySystem.js';
import { RunSystem } from '../src/systems/RunSystem.js';
import { AppViewModel } from '../src/viewmodels/AppViewModel.js';

test('The second stage needs the desert story clear and awards all three mine champions', () => {
  const profile = new ProfileService({ getItem: () => null, setItem() {} });
  const audio = { setMusic() {}, setPaused() {}, stopEffects() {} };
  const app = new AppViewModel(profile, audio, ['joao', 'elias', 'ruth', 'dynamite']);
  app.subscribe(() => {});
  for (const action of ['modes', 'story', 'stage', 'map:mine', 'begin']) app.action(action);
  assert.equal(app.run, null);
  const clear = mapId => {
    const run = new RunModel(Math.random, 0, {}, { mapId, mode: 'story' });
    Object.assign(run, { time: 900, phase: 'victory', missionsCompleted: CAMPAIGN[mapId].missions.length });
    run.bossEncounter.nextBoss = CAMPAIGN[mapId].bosses.length;
    profile.recordRun(run);
  };
  clear('desert');
  assert.equal(stageUnlocked(profile.data, 'mine'), true);
  app.action('begin');
  assert.equal(app.run.model.mapId, 'mine');
  assert.ok(app.run.model.props.some(prop => prop.visual === 'mineCart'));
  assert.equal(heroUnlocked(profile.data, 'elias'), false);
  clear('mine');
  for (const id of ['elias', 'ruth', 'dynamite']) assert.equal(heroUnlocked(profile.data, id), true, id);
});

test('Stage introductions and ordinary populations follow the timed waves', () => {
  const system = new EnemySystem();
  for (const [map, opening] of [['desert', 'bat'], ['mine', 'miner'], ['town', 'wraith']]) {
    const run = new RunModel(() => .75, 0, {}, { mapId: map });
    const spawned = [];
    system.spawn = (state, type) => {
      spawned.push(type);
      state.enemies.push({ type });
    };
    for (const wave of ENEMY_WAVES[map]) {
      spawned.length = 0;
      run.time = wave.at;
      run.spawnTimer = 0;
      run.enemies = [];
      system.spawnWaves(run, 1 / 60);
      assert.ok(spawned.length && spawned.every(id => id in wave.weights));
      if (!wave.at) assert.deepEqual(spawned, [opening]);
      if (map === 'desert' && wave.at === 60) assert.ok(spawned.includes('dog'));
      if (map === 'desert' && wave.at === 180) assert.ok(spawned.includes('skeleton'));
      run.spawnTimer = 0;
      run.enemies.length = wave.population;
      spawned.length = 0;
      system.spawnWaves(run, 1 / 60);
      assert.equal(spawned.length, 0);
    }
  }
});

test('Mine bosses enter on the story schedule and the stage timer pauses during the fight', () => {
  const run = new RunModel(Math.random, 0, {}, { mapId: 'mine', mode: 'story' });
  const system = new RunSystem();
  run.phase = 'playing';
  for (const boss of CAMPAIGN.mine.bosses) {
    run.time = boss.at;
    system.update(run, 1 / 60, { x: 0, z: 0 });
    assert.equal(run.enemies.find(enemy => enemy.bossId)?.bossId, boss.id);
    const elapsed = run.time;
    system.update(run, 1 / 60, { x: 0, z: 0 });
    assert.equal(run.time, elapsed);
    run.enemies.find(enemy => enemy.bossId).hp = 0;
    system.update(run, 1 / 60, { x: 0, z: 0 });
  }
  assert.equal(run.bossEncounter.completed, true);
});
