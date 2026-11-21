import { CHARACTERS } from '../config/characterConfig.js';
import { MAPS } from '../config/mapConfig.js';
import { BESTIARY, bestiaryKnowledge, discoveryState } from '../models/Bestiary.js';
import { t } from '../services/I18n.js';

const labels = [['beasts', 'Bestas'], ['undead', 'Mortos-vivos'], ['spirits', 'Espíritos']];
const stateLabels = { unknown: 'Desconhecido', encountered: 'Encontrado', defeated: 'Derrotado' };
const topFramed = new Set(['skeleton', 'shadowMarshal', 'miner', 'shovelMiner', 'minerGeneral']);
const titleOf = (entry, state) => state === 'unknown' ? stateLabels.unknown : t('pt', (entry.boss ? 'boss.' : 'enemy.') + entry.id);
const statLabels = [['hp', 'Vida'], ['damage', 'Dano'], ['armor', 'Armadura'], ['speed', 'Velocidade']];
const mineLore = {
  mineSpider: 'As aranhas das galerias avançam pelos lados. O brilho das pedras nas costas denuncia sua posição.',
  mineSkull: 'A chama azul paira nas galerias e dispara orbes à distância.',
  blindCrawler: 'O rato não enxerga, mas fareja quem passa. Depois de se encolher, investe em linha reta.',
};

function portrait({ id, stage, tile }, unknown) {
  const row = Math.floor(tile / 4);
  const x = tile % 4 * 100 / 3, y = row * 100;
  const silhouetteY = (row + (stage === 'mine' ? 2 : 0)) * 100 / 3;
  const framing = unknown ? 'portrait-unknown' : topFramed.has(id) ? 'portrait-top' : '';
  return `<span class="bestiary-portrait portrait-${stage} ${framing}" aria-hidden="true"
    style="--portrait-x:${x}%;--portrait-y:${y}%;--silhouette-y:${silhouetteY}%"><i></i>${unknown ? '<b>?</b>' : ''}</span>`;
}

export function bestiaryCatalog(discoveries) {
  let found = 0;
  const entries = BESTIARY.map(entry => {
    const state = discoveryState(entry, discoveries);
    if (state === 'defeated') found++;
    return { entry, state };
  });
  const groups = labels.map(([id, label]) => ({
    id, label,
    items: entries.filter(({ entry }) => entry.group === id).map(({ entry, state }) => `
      <button type="button" class="bestiary-card entry-${state}" data-action="creature:${entry.id}">
        ${portrait(entry, state === 'unknown')}
        <span class="bestiary-card-copy"><strong>${titleOf(entry, state)}</strong>
          ${state === 'unknown' ? '' : `<small>${entry.boss ? 'Chefe · ' : ''}${stateLabels[state]}</small>`}</span>
      </button>`),
  }));
  return { groups, found, total: entries.length };
}

export function bestiaryDossier(discoveries, id) {
  const entry = BESTIARY.find(creature => creature.id === id);
  if (!entry) return '';
  const state = discoveryState(entry, discoveries);
  const title = titleOf(entry, state);
  const { stats, pattern, weakness, counter } = bestiaryKnowledge(entry, state);
  const lore = state === 'defeated' ? mineLore[id] ?? t('pt', 'lore.' + id)
    : state === 'encountered' ? t('pt', 'encounteredBoss')
    : entry.boss ? 'Encontre este chefe para revelar seu nome e seu padrão de ataque.'
    : 'Derrote esta criatura para revelar sua ficha.';
  const details = [
    pattern && ['Padrão de ataque', t('pt', 'pattern.' + pattern)],
    weakness && ['Fraqueza', t('pt', 'ability.' + weakness)],
    counter && ['Campeão recomendado', CHARACTERS[counter].name],
  ].filter(Boolean);
  return `
    <header class="dossier-header">
      <div>${state !== 'unknown' ? `<p class="kicker">${MAPS[entry.stage].name} · ${stateLabels[state]}</p>` : ''}
        <h2 id="bestiary-title">${title}</h2></div>
      <button type="button" class="bestiary-close" data-action="close-creature" aria-label="Fechar ficha">×</button>
    </header>
    <div class="dossier-content">
      ${portrait(entry, state === 'unknown')}
      <div class="dossier-copy">
        <p>${lore}</p>
        ${stats ? `<dl class="dossier-stats">${statLabels.map(([key, label]) =>
          `<div><dt>${label}</dt><dd>${stats[key]?.toLocaleString('pt-BR') ?? '—'}</dd></div>`).join('')}</dl>` : ''}
        ${details.length ? `<dl class="dossier-details">${details.map(([label, value]) =>
          `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>` : ''}
      </div>
    </div>`;
}
