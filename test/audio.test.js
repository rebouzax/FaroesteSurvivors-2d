import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import clips from '../src/assets/audio/combat-foley.json' with { type: 'json' };
import { CAMPAIGN, ENEMY_STAGE_GROUPS } from '../src/config/campaignConfig.js';
import { desertSurfaceAt } from '../src/models/DesertLayout.js';
import { actorCue, actorHurt } from '../src/models/ActorCues.js';
import { RunModel } from '../src/models/RunModel.js';
import { RunAudio } from '../src/services/RunAudio.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { EnemySystem } from '../src/systems/EnemySystem.js';
import { BossSystem } from '../src/systems/BossSystem.js';
import { CHAMPION_CELLS, championPose } from '../src/views/ChampionAnimation.js';
import { enemyPose } from '../src/views/EnemyAnimation.js';

const stageActors = [
  ...ENEMY_STAGE_GROUPS.desert, ...ENEMY_STAGE_GROUPS.mine,
  ...[...CAMPAIGN.desert.bosses, ...CAMPAIGN.mine.bosses].map(boss => boss.id),
  'treasure', 'treasureRat',
];

test('Combat bank covers every active animation with different unclipped takes and fast onsets', () => {
  const wav = readFileSync(new URL('../src/assets/audio/combat-foley.wav', import.meta.url));
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 16), 'WAVEfmt ');
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt16LE(34), 16);
  const rate = wav.readUInt32LE(24);
  for (const id of CHAMPION_CELLS)
    for (const action of ['step.sand', 'step.trail', 'step.rock', 'attack', 'hurt'])
      assert.equal(clips[id + '.' + action]?.length, 2, id + '.' + action);
  for (const id of stageActors)
    for (const action of ['move', 'attack', 'hurt'])
      assert.equal(clips[id + '.' + action]?.length, 2, id + '.' + action);
  const ranges = Object.values(clips).flat().sort((a, b) => a[0] - b[0]);
  assert.ok(wav.length < 3_200_000);
  let previous = 0;
  const fingerprints = new Set();
  for (const [start, duration] of ranges) {
    const offset = 44 + 2 * Math.round(start * rate);
    const end = offset + 2 * Math.round(duration * rate);
    assert.ok(offset >= previous);
    assert.ok(end < wav.length);
    let peak = 0, onset = -1, hash = 7;
    for (let byte = offset; byte < end; byte += 2) {
      const amplitude = wav.readInt16LE(byte);
      peak = Math.max(peak, Math.abs(amplitude));
      hash = Math.imul(hash ^ amplitude, 16777619);
      if (onset < 0 && Math.abs(amplitude) > 1500) onset = (byte - offset) / 2 / rate;
    }
    assert.ok(peak > 18000 && peak < 32000);
    assert.ok(onset >= 0 && onset < .012, 'Onset ' + onset + ' at ' + start);
    assert.ok(Math.abs(wav.readInt16LE(offset)) <= 1 && Math.abs(wav.readInt16LE(end - 2)) <= 1);
    assert.equal(wav.readInt16LE(end), 0);
    fingerprints.add(hash);
    previous = end;
  }
  assert.equal(fingerprints.size, ranges.length);
});

test('Champion footsteps are played only when the rendered foot lands and use that point’s terrain', () => {
  const heard = [];
  const audio = new RunAudio((name, mix) => heard.push({ name, mix }));
  const run = new RunModel(() => .52, 0, {}, { characterId: 'joao' });
  run.phase = 'playing';
  const p = run.player;
  const draw = () => {
    const { contact, frame } = championPose(run.characterId, { moving: p.moving, travel: p.travel, attack: run.attack });
    const contacts = contact === undefined ? [] : [{
      actor: p, player: true, id: run.characterId, x: p.x, z: p.z, index: contact, action: 'move',
    }];
    audio.present(run, { x: p.x, z: p.z, contacts });
    return frame;
  };
  audio.update(run);
  assert.equal(draw(), 'joaoPose0');
  assert.equal(heard.length, 0);
  p.moving = true;
  assert.equal(draw(), 'joaoPose1');
  draw();
  assert.equal(heard.length, 1);
  p.travel = .8;
  assert.equal(draw(), 'joaoPose2');
  assert.equal(heard.length, 1);
  const sand = Array.from({ length: 16 }, (_, i) => -31 + i).find(x => desertSurfaceAt(x, 17) === 'sand');
  Object.assign(p, { x: sand, z: 17, travel: 1.6 });
  run.attack = { hit: false };
  assert.equal(draw(), 'joaoPose4');
  assert.equal(heard.length, 1);
  run.attack = null;
  assert.equal(draw(), 'joaoPose3');
  assert.deepEqual(heard.map(sound => sound.name), ['joao.step.trail', 'joao.step.sand']);
  assert.equal(heard[0].mix.pan, -heard[1].mix.pan);
});

test('Champion impact, axe release and the boss attack are spatial sounds on the presentation frame', () => {
  const heard = [];
  const audio = new RunAudio((name, mix) => heard.push({ name, mix }));
  const run = new RunModel(() => .52, 0, {}, { characterId: 'labuta' });
  run.phase = 'playing';
  run.visualTime = 2;
  const enemy = { id: 7, x: 6, z: 8, type: 'skeleton' };
  const boss = { id: 8, x: -5, z: 8, bossId: 'shadowMarshal', damage: 20 };
  run.enemies.push(enemy, boss);
  run.cooldown = 0;
  new CombatSystem().update(run, .16);
  new BossSystem().resolve(run, boss, { pattern: 'volley', angle: 0 });
  actorCue(run, enemy, 'attack');
  actorHurt(run, run.player);
  actorHurt(run, run.player);
  audio.update(run);
  assert.equal(heard.length, 0);
  const frame = { ...run.player, contacts: [] };
  audio.present(run, frame);
  audio.present(run, frame);
  const get = name => heard.find(c => c.name === name);
  assert.equal(heard.length, 4);
  assert.ok(get('labuta.attack'));
  assert.ok(get('labuta.hurt').mix.priority > get('labuta.attack').mix.priority);
  assert.ok(get('skeleton.attack').mix.pan > 0);
  assert.ok(get('shadowMarshal.attack').mix.pan < 0);
});

test('Enemy contact, charge release and hit recoil share their animated states', () => {
  const run = new RunModel(() => .52);
  run.phase = 'playing';
  run.visualTime = 1;
  const enemy = { id: 1, x: 4, z: 8, type: 'dog', hitFlash: 0, charge: { vx: -7, vz: 0, warning: .07, left: .6 } };
  const system = new EnemySystem();
  assert.equal(enemyPose('dog', enemy, 1, 0, 4).frame, 'dog3');
  system.charge(run, enemy, 'chase', 4, .05);
  assert.equal(run.actorCues.length, 0);
  system.charge(run, enemy, 'chase', 4, .05);
  assert.equal(run.actorCues[0].action, 'attack');
  assert.equal(enemyPose('dog', enemy, 1, 0, 4).frame, 'dog7');
  actorHurt(run, enemy);
  assert.equal(run.actorCues[1].id, 'dog');
  assert.equal(run.actorCues[1].action, 'hurt');
  assert.equal(enemy.hitFlash, .12);
  const flap = enemyPose('bat', { id: 0 }, 4.2 / 23, 0, 4);
  assert.equal(flap.frame, 'bat2');
  assert.equal(flap.contact, 4);
  const dive = enemyPose('vulture', { id: 0, x: 1, z: 0, targetX: 0, targetZ: 0 }, .4, 0, 1);
  assert.equal(dive.frame, 'vulture3');
  assert.equal(dive.diveAttack, true);
});
