import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RunModel } from '../src/models/RunModel.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { CHAMPION_CELLS, championPose } from '../src/views/ChampionAnimation.js';
import { CHAMPION_CARD_STYLES } from '../src/config/championCards.js';
import { localizedCardDescription } from '../src/services/I18n.js';

function setup(characterId, distance = 8, random = .5) {
  const run = new RunModel(() => random, 0, {}, { characterId });
  Object.assign(run.player, { x: 0, z: 0, dx: 1, dz: 0 });
  run.enemies.push({ id: 900, x: distance, z: 0, hp: 120, armor: 0 });
  run.cooldown = 5;
  return run;
}

test('The same deck and duplicate card work with the native weapon of all playable champions', () => {
  const combat = new CombatSystem();
  const deck = setup('joao').deck;
  const intervals = new Set();
  for (const id of CHAMPION_CELLS) {
    const run = setup(id, 3);
    run.enemies.push({ id: 901, x: -4, z: 0, hp: 120, armor: 0 });
    assert.deepEqual(run.deck, deck);
    Object.assign(run, { phase: 'upgrade', pendingChoices: 1, cardOffers: ['doubleShot'], cooldown: 0 });
    assert.ok(run.chooseAbility('doubleShot'));
    combat.update(run, .18);
    const [extra] = run.pendingCopies;
    assert.ok(extra);
    assert.ok(Math.cos(extra.heading) < -.99);
    assert.equal(extra.delay, CHAMPION_CARD_STYLES[id].echoInterval);
    intervals.add(extra.delay);
    combat.update(run, extra.delay);
    assert.ok(Math.cos(run.primaryEcho.angle) < -.99);
    assert.equal(championPose(id, { echoAge: 0 }).frame, id + 'Pose5');
  }
  assert.equal(intervals.size, CHAMPION_CELLS.length);
});

test('One pistol card follows the champion’s critical, range, cadence and movement rules', () => {
  const combat = new CombatSystem();
  const pistol = (characterId, { moving = false, random = .5, distance = 8 } = {}) => {
    const run = setup(characterId, distance, random);
    run.player.moving = moving;
    run.abilities.pistol = 1;
    combat.update(run, .02);
    return run;
  };
  assert.equal(pistol('maria', { random: .04 }).projectiles[0].damage, 15 * 1.7);
  assert.equal(pistol('joao', { random: .04 }).projectiles[0].damage, 15);
  assert.equal(pistol('ada').projectiles[0].damage, 18);
  assert.equal(pistol('ada', { moving: true }).projectiles[0].damage, 15);
  assert.equal(pistol('rosa').pistolTimer, 1.7 * .8);
  const elias = pistol('elias', { distance: 22 });
  assert.equal(elias.projectiles[0].lifetime, 1.2 * 1.3);
  assert.ok(pistol('elias', { distance: -22 }).projectiles[0].vx < 0);
  assert.ok(pistol('joao', { distance: -22 }).projectiles[0].vx > 0);
  const distantDamage = id => {
    const run = setup(id, 34);
    run.abilities.pistol = 1;
    for (let i = 0; i < 93; i++) combat.update(run, 1 / 60);
    return 120 - run.enemies[0].hp;
  };
  assert.equal(distantDamage('elias'), 15);
  assert.equal(distantDamage('joao'), 0);
});

test('Ada checks her stance again when the duplicate card projectile fires', () => {
  const combat = new CombatSystem();
  const run = setup('ada');
  Object.assign(run.abilities, { pistol: 1, doubleShot: 1 });
  combat.update(run, .02);
  run.player.moving = true;
  combat.update(run, .12);
  assert.equal(run.projectiles.find(shot => !shot.copy).damage, 18);
  assert.equal(run.projectiles.find(shot => shot.copy).damage, 15);
});

test('Ruth’s extra damage fades with projectile travel and Indigo’s bullet pierces another target', () => {
  const combat = new CombatSystem();
  const damage = distance => {
    const run = setup('ruth', distance);
    run.abilities.pistol = 1;
    for (let i = 0; i < 30; i++) combat.update(run, 1 / 60);
    return 120 - run.enemies[0].hp;
  };
  assert.equal(damage(3), 18.75);
  assert.equal(damage(9), 15);
  const indigo = setup('indigo');
  indigo.abilities.ghostShot = 1;
  combat.update(indigo, .02);
  assert.equal(indigo.ghostShots[0].pierce, 3);
});

test('Card affinity changes impact radius and defensive upgrades through the regular game actions', () => {
  const combat = new CombatSystem();
  const neco = setup('dynamite');
  neco.abilities.molotov = 1;
  combat.update(neco, .65);
  assert.equal(neco.fires[0].radius, 3.5);
  const joao = setup('joao', 4.8);
  joao.abilities.requiem = 1;
  combat.update(joao, .03);
  assert.ok(joao.enemies[0].hp < 120);
  assert.ok(joao.enemies[0].x > 6.9);
  const labuta = setup('labuta');
  Object.assign(labuta, { phase: 'upgrade', pendingChoices: 1, cardOffers: ['heart'] });
  assert.ok(labuta.chooseAbility('heart'));
  assert.equal(labuta.player.maxHp, 145);
  Object.assign(labuta, { phase: 'mission-card', missionOffers: ['ironWill'] });
  assert.ok(labuta.chooseMissionCard('ironWill'));
  assert.equal(labuta.playerArmor, 7);
  Object.assign(labuta, { phase: 'merchant', coins: 999 });
  assert.ok(labuta.buyRunUpgrade('heart'));
  assert.equal(labuta.player.maxHp, 170);
  assert.match(localizedCardDescription('pt', 'ironWill', 2, 1, 'labuta'), /\+4 de armadura.*8 da carta/);
});
