import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAMPAIGN, ENEMY_STAGE_GROUPS } from '../src/config/campaignConfig.js';
import { PLAYABLE_STAGES } from '../src/config/playableStages.js';
import { BESTIARY, bestiaryKnowledge, bestiaryPosition, discoveryState } from '../src/models/Bestiary.js';
import { ProfileService } from '../src/services/ProfileService.js';
import { RunModel } from '../src/models/RunModel.js';
import { bestiaryCatalog, bestiaryDossier } from '../src/views/BestiaryView.js';

const empty = () => ({ enemies: [], bosses: [], encounteredBosses: [] });

test('Every playable enemy and boss has a distinct portrait entry and category', () => {
  const { groups, found, total } = bestiaryCatalog(empty());
  assert.deepEqual(groups.map(group => group.label), ['Bestas', 'Mortos-vivos', 'Espíritos']);
  assert.ok(groups.every(group => group.items.length > 0));
  assert.equal(found, 0);
  assert.equal(total, 7 * PLAYABLE_STAGES.length);
  assert.ok(bestiaryPosition('shadowMarshal') >= 0);
  assert.notEqual(bestiaryPosition('boneSinger'), bestiaryPosition('zombieDeputy'));
  for (const stage of PLAYABLE_STAGES) {
    const entries = BESTIARY.filter(entry => entry.stage === stage);
    const ids = [...ENEMY_STAGE_GROUPS[stage], ...CAMPAIGN[stage].bosses.map(boss => boss.id)];
    assert.deepEqual(entries.map(entry => entry.id).sort(), ids.sort());
    assert.deepEqual(entries.map(entry => entry.tile).sort(), [0, 1, 2, 3, 4, 5, 6]);
  }
});

test('Unknown, encountered and defeated entries reveal the same information as the original', () => {
  const entry = BESTIARY.find(entry => entry.id === 'shovelMiner');
  const found = empty();
  assert.equal(discoveryState(entry, found), 'unknown');
  assert.deepEqual(bestiaryKnowledge(entry, 'unknown'), {});
  let html = bestiaryDossier(found, entry.id);
  assert.match(html, /Desconhecido/);
  assert.match(html, /portrait-unknown/);
  assert.doesNotMatch(html, /Mineiro da Pá|Fraqueza|Campeão recomendado|Vida/);
  found.encounteredBosses.push(entry.id);
  assert.equal(discoveryState(entry, found), 'encountered');
  assert.deepEqual(bestiaryKnowledge(entry, 'encountered'), { stats: { hp: entry.boss.hp }, pattern: entry.boss.pattern });
  html = bestiaryDossier(found, entry.id);
  assert.match(html, /Mineiro da Pá/);
  assert.match(html, /Padrão de ataque/);
  assert.doesNotMatch(html, /Fraqueza|Campeão recomendado|portrait-unknown/);
  found.bosses.push(entry.id);
  found.enemies.push('skeleton');
  assert.equal(discoveryState(entry, found), 'defeated');
  assert.equal(bestiaryCatalog(found).found, 2);
  assert.match(bestiaryDossier(found, entry.id), /Fraqueza.*Campeão recomendado.*Ada Morrow/s);
  assert.match(bestiaryDossier(found, 'skeleton'), /Fraqueza.*Coquetel Molotov/s);
  assert.equal(bestiaryDossier(found, 'invalid'), '');
});

test('Saved discoveries keep a defeated creature and a merely encountered boss distinct after reload', () => {
  const storage = new Map();
  const persisted = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
  const profile = new ProfileService(persisted);
  const run = new RunModel(Math.random, 0, {}, { mapId: 'mine' });
  run.time = 301;
  run.phase = 'defeat';
  run.defeatedTypes.add('mineSpider');
  run.encounteredBosses.add('shovelMiner');
  profile.recordRun(run);
  const restored = new ProfileService(persisted).data.discoveries;
  assert.equal(bestiaryCatalog(restored).found, 1);
  assert.equal(discoveryState(BESTIARY.find(entry => entry.id === 'mineSpider'), restored), 'defeated');
  assert.equal(discoveryState(BESTIARY.find(entry => entry.id === 'shovelMiner'), restored), 'encountered');
});
