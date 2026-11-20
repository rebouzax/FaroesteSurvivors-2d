import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAMPAIGN, heroUnlocked } from '../src/config/campaignConfig.js';
import { abilityStats } from '../src/config/abilityConfig.js';
import { CONFIG } from '../src/config/gameConfig.js';
import { RunModel } from '../src/models/RunModel.js';
import { ProfileService } from '../src/services/ProfileService.js';
import { CrateSystem } from '../src/systems/CrateSystem.js';
import { CombatSystem, horseshoePositions } from '../src/systems/CombatSystem.js';
import { MissionSystem } from '../src/systems/MissionSystem.js';
import { RunSystem } from '../src/systems/RunSystem.js';
import { GameViewModel } from '../src/viewmodels/GameViewModel.js';

const idle = { x: 0, z: 0 };
const newRun = () => new RunModel(() => .42, 0, {}, { mode: 'story' });

test('Deserto starts with an intro and attacks only during active play', () => {
  const run = newRun(), system = new RunSystem();
  system.update(run, 1, idle);
  assert.equal(run.phase, 'intro');
  assert.equal(run.time, 0);
  system.update(run, CONFIG.intro, idle);
  assert.equal(run.phase, 'playing');
  const { x, z } = run.player;
  run.enemies.push({ id: 81, type: 'bat', hp: 10, maxHp: 10, armor: 0, xp: 10, speed: 0, x: x + 3, z });
  for (let i = 0; i < 42; i++) system.update(run, 1 / 60, idle);
  assert.deepEqual([run.player.x, run.player.z], [x, z]);
  assert.equal(run.kills, 1);
  assert.equal(run.player.xp, 10);
});

test('The original three bosses enter in order and freeze the stage clock', () => {
  const run = newRun(), system = new RunSystem();
  run.phase = 'playing';
  for (const [i, expected] of CAMPAIGN.desert.bosses.entries()) {
    run.time = expected.at;
    system.update(run, 1 / 60, idle);
    const boss = run.enemies.find(enemy => enemy.bossId);
    assert.equal(boss.bossId, expected.id);
    assert.equal(boss.maxHp, expected.hp);
    assert.equal(run.bossEncounter.nextBoss, i);
    const clock = run.time;
    system.update(run, 1 / 60, idle);
    assert.equal(run.time, clock);
    boss.hp = 0;
    system.update(run, 1 / 60, idle);
    assert.equal(run.bossEncounter.active, false);
  }
  assert.equal(run.bossEncounter.nextBoss, 3);
  assert.equal(run.defeatedBosses.size, 3);
  run.time = CONFIG.duration - 1 / 120;
  system.update(run, 1 / 60, idle);
  assert.equal(run.phase, 'victory');
  assert.equal(run.campaignComplete(), false);
});

test('A mission can complete on the same update as a level, preserving both rewards', () => {
  const run = newRun(), missions = new MissionSystem();
  run.phase = 'playing';
  run.time = 45;
  missions.update(run);
  missions.update(run, Array(9).fill('bat'));
  run.addXp(100);
  assert.equal(run.phase, 'upgrade');
  missions.update(run, ['bat']);
  assert.equal(run.phase, 'mission-reward');
  assert.equal(run.pendingChoices, 1);
  assert.equal(run.chooseMissionReward('health'), true);
  assert.equal(run.phase, 'upgrade');
  assert.equal(run.player.maxHp, 120);
  assert.equal(run.chooseAbility(run.cardOffers[0]), true);
  assert.equal(run.pendingChoices, 0);
  assert.equal(run.phase, 'playing');
  assert.ok(run.completedMissionIds.has('desert:1'));
});

test('Crates are collected by touch and count toward the supply mission', () => {
  const run = newRun(), missions = new MissionSystem(), crates = new CrateSystem();
  const drops = [];
  run.phase = 'playing';
  run.time = 250;
  run.missionIndex = 1;
  missions.update(run);
  const { x, z } = run.player;
  for (let i = 0; i < 2; i++) {
    run.crates = [{ x, z }];
    crates.update(run, 1 / 60, (...drop) => drops.push(drop));
    missions.update(run);
  }
  assert.equal(drops.length, 2);
  assert.equal(run.phase, 'mission-reward');
  assert.equal(run.chooseMissionReward('coins'), true);
  assert.equal(run.coins, 25);
});

test('Horseshoes keep orbiting and damaging the boss while the stage clock is frozen', () => {
  const run = newRun(), combat = new CombatSystem();
  run.time = 180;
  run.bossEncounter.active = true;
  run.abilities.horseshoe = 1;
  const stats = abilityStats('horseshoe', 1);
  const enemy = { hp: 100, armor: 0, ...horseshoePositions(run.player, 180, stats)[0] };
  run.enemies = [enemy];
  run.visualTime = 180;
  combat.horseshoes(run);
  assert.equal(enemy.hp, 100 - stats.damage);
  run.visualTime += .6;
  Object.assign(enemy, horseshoePositions(run.player, run.visualTime, stats)[0]);
  combat.horseshoes(run);
  assert.equal(enemy.hp, 100 - stats.damage * 2);
  assert.equal(run.time, 180);
});

test('Run settlement saves coins and unlocks once using the standalone profile', () => {
  const data = new Map([['faroeste:profile:v2', '{"coins":8000}']]);
  let writes = 0;
  const storage = {
    getItem: key => data.get(key),
    setItem: (key, value) => { writes++; data.set(key, value); },
  };
  const profile = new ProfileService(storage);
  assert.equal(profile.data.coins, 0);
  const vm = new GameViewModel(profile, {}, { mode: 'story' });
  Object.assign(vm.model, {
    time: CONFIG.duration, phase: 'victory', missionsCompleted: 3, coins: 260,
    completedMissionIds: new Set(['desert:1', 'desert:2', 'desert:3']),
  });
  vm.model.bossEncounter.nextBoss = 3;
  vm.settle();
  vm.settle();
  assert.equal(writes, 1);
  const restored = new ProfileService(storage);
  assert.equal(restored.data.coins, 260);
  assert.equal(restored.data.completedRuns, 1);
  assert.equal(restored.data.storyClears.desert, true);
  for (const id of ['maria', 'labuta', 'indigo', 'rosa', 'ada']) assert.equal(heroUnlocked(restored.data, id), true);
  assert.equal(restored.buyUpgrade('health'), true);
  assert.equal(restored.data.healthRank, 1);
});
