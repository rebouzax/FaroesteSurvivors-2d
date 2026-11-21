import { CAMPAIGN, ENEMY_STAGE_GROUPS, ENEMY_WEAKNESSES } from '../config/campaignConfig.js';
import { enemyStats } from '../config/abilityConfig.js';
import { PLAYABLE_STAGES } from '../config/playableStages.js';

const beasts = new Set(['bat', 'dog', 'vulture', 'giantBat', 'fireChupacabra', 'mineSpider', 'blindCrawler', 'giantMoth']);
const groupOf = id => beasts.has(id) ? 'beasts' : id === 'mineSkull' ? 'spirits' : 'undead';
const portraitOrder = {
  desert: ['bat', 'dog', 'vulture', 'skeleton', 'giantBat', 'fireChupacabra', 'shadowMarshal'],
  mine: ['miner', 'mineSpider', 'mineSkull', 'blindCrawler', 'shovelMiner', 'giantMoth', 'minerGeneral'],
};
const entryFor = (stage, id, boss) => ({ stage, id, boss, tile: portraitOrder[stage].indexOf(id), group: groupOf(id) });

const stages = PLAYABLE_STAGES.map(stage => ({ stage, enemies: ENEMY_STAGE_GROUPS[stage], bosses: CAMPAIGN[stage].bosses }));
// Tile order matches the portrait sheets for each stage.
export const BESTIARY = Object.freeze([
  ...stages.flatMap(({ stage, enemies }) => enemies.map(id => entryFor(stage, id))),
  ...stages.flatMap(({ stage, bosses }) => bosses.map(boss => entryFor(stage, boss.id, boss))),
]);

export function bestiaryPosition(id) {
  const entry = BESTIARY.find(creature => creature.id === id);
  if (!entry) return null;
  const group = BESTIARY.filter(creature => creature.group === entry.group);
  return group.indexOf(entry);
}

export function discoveryState(entry, discoveries) {
  if ((entry.boss ? discoveries.bosses : discoveries.enemies).includes(entry.id)) return 'defeated';
  return entry.boss && discoveries.encounteredBosses.includes(entry.id) ? 'encountered' : 'unknown';
}

export function bestiaryKnowledge(entry, state) {
  if (state === 'unknown') return {};
  const { id, boss } = entry;
  if (state === 'encountered') return { stats: { hp: boss.hp }, pattern: boss.pattern };
  return {
    stats: boss ?? enemyStats(id, 0),
    pattern: boss?.pattern,
    weakness: boss?.weakness ?? ENEMY_WEAKNESSES[id],
    counter: boss?.counter,
  };
}
