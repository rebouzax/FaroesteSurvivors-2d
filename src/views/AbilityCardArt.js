import { ABILITIES } from '../config/abilityConfig.js';

const illustrations = [
  ['doubleShot'], ['pistol', 'deadeye', 'longshot', 'saltedRounds'], ['molotov', 'inferno', 'marshfire'], ['heart', 'bloodOath', 'blueTonic', 'health'],
  ['horseshoe', 'crowstorm'], ['ghostShot', 'bentoGhostLead', 'railbreaker'], ['requiem', 'dustWaltz', 'windwardOath'], ['silverRain', 'silverStorm', 'saloonTempest'],
  ['lantern'], ['soulHarvest'], ['boneStorm'], ['ironWill', 'bulwark', 'ironCharm', 'ironRosary'],
  ['lastStand'], ['returningBlade', 'lunarReturn'], ['pirateBomb'], ['coins', 'card'],
];
const byId = new Map(illustrations.flatMap((ids, tile) => ids.map(id => [id, tile])));
const theme = { steel: 'steel', fire: 'ember', heart: 'crimson' };

export function abilityCardArt(id) {
  const spec = ABILITIES[id];
  const palette = id === 'doubleShot' || spec?.suit === 'ALMA' ? 'spirit' : theme[spec?.color] ?? 'ember';
  const tile = byId.get(id) ?? { steel: 1, fire: 6, heart: 3 }[spec?.color] ?? 15;
  return `<span class="ability-art tone-${palette}" aria-hidden="true" style="--art-x:${tile % 4 * 100 / 3}%;--art-y:${Math.floor(tile / 4) * 100 / 3}%"><i></i></span>`;
}
