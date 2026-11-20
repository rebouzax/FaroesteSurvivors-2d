import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import clips from '../src/assets/audio/combat-foley.json' with { type: 'json' };
import { desertSurfaceAt } from '../src/models/DesertLayout.js';
import { RunModel } from '../src/models/RunModel.js';
import { RunAudio } from '../src/services/RunAudio.js';

test('Combat bank has independent, unclipped PCM takes with silence between slices', () => {
  const wav = readFileSync(new URL('../src/assets/audio/combat-foley.wav', import.meta.url));
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 16), 'WAVEfmt ');
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt16LE(34), 16);
  const rate = wav.readUInt32LE(24);
  const ranges = Object.values(clips).flat().sort((a, b) => a[0] - b[0]);
  assert.equal(ranges.length, 63);
  let previous = 0;
  for (const [start, duration] of ranges) {
    const offset = 44 + 2 * Math.round(start * rate);
    const end = offset + 2 * Math.round(duration * rate);
    assert.ok(offset >= previous);
    assert.ok(end < wav.length);
    let peak = 0;
    for (let byte = offset; byte < end; byte += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(byte)));
    assert.ok(peak > 18000 && peak < 32000);
    assert.ok(Math.abs(wav.readInt16LE(offset)) <= 1 && Math.abs(wav.readInt16LE(end - 2)) <= 1);
    assert.equal(wav.readInt16LE(end), 0);
    previous = end;
  }
});

test('Bootstep cadence follows travel and chooses the surface at the champion’s position', () => {
  const heard = [];
  const audio = new RunAudio((name, settings) => heard.push({ name, settings }));
  const run = new RunModel(() => .52, 0, {}, { characterId: 'joao' });
  const step = 1 / 60;
  run.phase = 'playing';
  run.player.z = 8;
  for (let tick = 0; tick < 20; tick++) audio.update(run, step);
  assert.equal(heard.length, 0);
  run.player.moving = true;
  for (let tick = 0; tick < 28; tick++) {
    run.player.z += .08;
    audio.update(run, step);
  }
  assert.deepEqual(heard.map(x => x.name), ['stepTrail', 'stepTrail']);
  assert.equal(heard[0].settings.pan, -heard[1].settings.pan);

  const foundSand = Array.from({ length: 16 }, (_, i) => -31 + i).find(x => desertSurfaceAt(x, 17) === 'sand');
  run.player.x = foundSand;
  run.player.z = 17;
  run.player.moving = false;
  for (let tick = 0; tick < 20; tick++) audio.update(run, step);
  assert.equal(heard.length, 2);
  run.player.moving = true;
  for (let tick = 0; tick < 8; tick++) {
    run.player.z += .08;
    audio.update(run, step);
  }
  assert.equal(heard[2].name, 'stepSand');
});

test('A champion attack, incoming axe and boss cue keep separate sounds and positions', () => {
  const heard = [];
  const audio = new RunAudio((name, settings) => heard.push({ name, settings }));
  const run = new RunModel(() => .52, 0, {}, { characterId: 'labuta' });
  const step = 1 / 60;
  run.phase = 'playing';
  run.enemies = [
    { x: -5, z: 8, bossId: 'shadowMarshal' },
    { x: 8, z: 8, type: 'dog', charge: { warning: .4 } },
  ];
  run.bossEncounter.active = true;
  run.bossEncounter.bossId = 'shadowMarshal';
  run.primaryShots.push({ age: step, kind: 'labuta' });
  run.enemyShots.push({ age: step, kind: 'axe', x: 6, z: 8 });
  run.events.push('boss-enter', 'shot', 'enemy-charge');
  audio.update(run, step);
  assert.deepEqual(heard.map(x => x.name), ['axe', 'shadowMarshal', 'shotgun', 'dog']);
  assert.ok(heard[0].settings.pan > 0 && heard[1].settings.pan < 0);
  assert.ok(heard[1].settings.priority > heard[0].settings.priority);
  assert.ok(heard[3].settings.pan > 0 && heard[3].settings.pitch < 1);
});
