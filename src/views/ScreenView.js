import logo from '../assets/logo-faroeste-survivors.webp';
import { abilityMaxLevel } from '../config/abilityConfig.js';
import { CAMPAIGN, HERO_REWARDS, MISSION_HERO_REWARDS, heroUnlocked, previousStage, stageUnlocked, unlockedGameplayCards } from '../config/campaignConfig.js';
import { CHARACTERS } from '../config/characterConfig.js';
import { championCardNote, CHAMPION_CARD_STYLES } from '../config/championCards.js';
import { BENTO_CARDS, DECK_MAX, DECK_MIN, FUSIONS, STARTER_CARDS, fusionUnlocked } from '../config/deckConfig.js';
import { CONFIG } from '../config/gameConfig.js';
import { bestiaryPosition } from '../models/Bestiary.js';
import { MAPS } from '../config/mapConfig.js';
import { PLAYABLE_STAGES, STAGE_PRESENTATION } from '../config/playableStages.js';
import { TREASURE_CREATURES } from '../config/treasureCreatures.js';
import { PERMANENT_UPGRADES, temporaryPrice, upgradeUnlocked } from '../config/shopConfig.js';
import { localizedCardDescription, t } from '../services/I18n.js';
import { CHAMPION_CELLS } from './ChampionAnimation.js';
import { MenuBackdrop } from './MenuBackdrop.js';
import { abilityCardArt } from './AbilityCardArt.js';
import { bestiaryCatalog, bestiaryDossier } from './BestiaryView.js';
import { menuPage } from './MenuPagination.js';

const weapons = { whip: 'Chicote vaqueiro', revolver: 'Revólver', shotgun: 'Escopeta', bow: 'Arco', dual: 'Dois revólveres', crossbow: 'Besta', rifle: 'Rifle', sawedoff: 'Escopeta serrada', dynamite: 'Dinamite', knives: 'Facas de arremesso', repeater: 'Carabina de repetição' };
const missionNames = { bat: 'Abata morcegos', crate: 'Recolha caixas de suprimentos', skeleton: 'Abata esqueletos', mineSpider: 'Abata aranhas das galerias', miner: 'Abata mineiros da noite', townGhoul: 'Abata ghouls foragidos', townZombie: 'Abata zumbis do saloon', headlessOutlaw: 'Abata pistoleiros sem cabeça' };
const weatherNames = { sand: 'Tempestade de areia', tornado: 'Tornados', rain: 'Tempestade elétrica', 'mission-failed': 'O prazo da missão acabou' };
const markerGlyphs = { crate: '▣', merchant: '◆', treasure: '✦' };
const button = (action, title, options = '') => `<button type="button" data-action="${action}" ${options}>${title}</button>`;
const money = (amount) => `<span class="money"><span aria-hidden="true">◉</span> ${amount}</span>`;
const nameOf = (id, kind = 'ability') => t('pt', `${kind}.${id}`);
const duration = (value) => {
  const seconds = Math.max(0, Math.ceil(value));
  return [Math.floor(seconds / 60), seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
};
const heroLock = (id) => MISSION_HERO_REWARDS[id]
  ? `Conclua a missão ${MISSION_HERO_REWARDS[id].split(':')[1]} do Deserto no modo História.`
  : `Conclua ${MAPS[HERO_REWARDS[id]]?.name ?? 'o Deserto'} no modo História.`;
const stageName = id => MAPS[id].name;
const statNumber = value => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const cardNote = (hero, id) => {
  const note = championCardNote(hero, id);
  return note ? `<span class="card-affinity">${note}</span>` : '';
};
const icon = glyph => `<span class="menu-icon" aria-hidden="true">${glyph}</span>`;
const fullscreenMessage = {
  available: '',
  active: '',
  standalone: 'O jogo já está aberto em tela cheia.',
  unsupported: 'Tela cheia indisponível nesta aba. No Safari, use Adicionar à Tela de Início.',
};

export class ScreenView {
  constructor(root, action, setting) {
    this.root = root;
    this.portraits = {};
    this.pageSize = 3;
    this.resetCatalog();
    root.addEventListener('click', event => {
      const target = event.target.closest('[data-action]');
      if (target && !target.disabled) action(target.dataset.action);
    });
    root.addEventListener('change', event => {
      const { setting: key } = event.target.dataset;
      if (key) setting(key, event.target.type === 'checkbox' ? event.target.checked : event.target.value);
    });
  }

  resetCatalog() {
    this.catalogTab = null;
    this.catalogOffset = 0;
    this.creatureId = null;
  }

  changeCatalog(action) {
    const [, kind, value] = action.split(':');
    if (kind === 'tab') {
      this.catalogTab = value;
      this.catalogOffset = 0;
    } else if (kind === 'offset' && Number.isFinite(Number(value))) {
      this.catalogDirection = Number(value) > this.catalogOffset ? 'next' : 'prev';
      this.catalogOffset = Number(value);
    }
    else return false;
    return true;
  }

  restoreCatalogFocus(action) {
    if (!action) return;
    const [, kind, value] = action.split(':');
    const selector = kind === 'tab' ? `[data-action="catalog:tab:${CSS.escape(value)}"]` : `[data-pager="${this.catalogDirection}"]`;
    const focus = this.root.querySelector(selector);
    (focus && !focus.disabled ? focus : this.root.querySelector('[data-pager]:not(:disabled)'))?.focus({ preventScroll: true });
  }

  catalog(groups, summary = '', status = '', size = this.pageSize) {
    const active = groups.find(group => group.id === this.catalogTab) ?? groups[0];
    const page = menuPage(active.items, this.catalogOffset, size);
    const tabs = groups.length > 1 ? `<nav class="catalog-tabs" aria-label="Categorias">${groups.map(group =>
      button('catalog:tab:' + group.id, group.label, `aria-pressed="${active === group}"`)).join('')}</nav>` : '';
    const pager = page.pages > 1 ? `<nav class="catalog-pager" aria-label="Páginas">
      ${button('catalog:offset:' + (page.index - 1) * size, '‹', `data-pager="prev" aria-label="Página anterior" ${page.index === 0 ? 'disabled' : ''}`)}
      <span aria-live="polite">${page.index + 1} / ${page.pages}</span>
      ${button('catalog:offset:' + (page.index + 1) * size, '›', `data-pager="next" aria-label="Próxima página" ${page.index + 1 >= page.pages ? 'disabled' : ''}`)}
    </nav>` : '';
    return `<div class="catalog">
      ${tabs || summary ? `<div class="catalog-bar">${tabs}${summary}</div>` : ''}
      <div class="item-list catalog-items">${page.items.join('') || '<p class="catalog-empty">Nenhum item nesta categoria.</p>'}</div>
      ${pager || status ? `<div class="catalog-footer">${pager}${status}</div>` : ''}
    </div>`;
  }

  portrait(id, alt = '') {
    return this.portraits[id] ? `<img src="${this.portraits[id]}" alt="${alt}" draggable="false">` : '';
  }

  menu(wind = true) {
    this.stopMenuMotion();
    this.root.className = 'menu-screen';
    this.root.innerHTML = `
      <div class="menu-landscape menu-landscape-motion" aria-hidden="true"><canvas class="menu-motion"></canvas></div>
      <section class="menu-panel" aria-label="Menu principal">
        <h1><img src="${logo}" alt="Faroeste Survivors"></h1>
        <nav class="main-nav" aria-label="Jogo">
          ${button('modes', `${icon('✦')}<span>Novo jogo</span><span class="menu-arrow" aria-hidden="true">›</span>`, 'class="primary"')}
          ${button('settings', `${icon('⚙')}<span>Configurações</span>`)}
          ${button('exit', `${icon('↪')}<span>Sair</span>`)}
        </nav>
      </section>`;
    this.menuBackdrop = new MenuBackdrop(this.root.querySelector('.menu-motion'), wind);
  }

  stopMenuMotion() {
    this.menuBackdrop?.dispose();
    this.menuBackdrop = null;
  }

  shell(title, content, back = 'menu', className = '', label = '') {
    this.root.className = `selection-screen selection-${className || 'default'}`;
    this.root.innerHTML = `
      <div class="menu-landscape" aria-hidden="true"></div>
      <section class="page-shell ${className}">
        <header class="sub-header">
          ${button(back, `${icon('‹')}<span>Voltar</span>`, 'class="back-button"')}
          <div class="page-heading"><h1 tabindex="-1">${title}</h1>${label ? `<span class="kicker">${label}</span>` : ''}</div>
        </header>
        <div class="page-content">${content}</div>
      </section>`;
    this.root.querySelector('h1').focus({ preventScroll: true });
  }

  modes(data) {
    const free = data.storyClears.desert;
    this.shell('Modo de jogo', `<div class="mode-grid">
      ${button('story', '<strong>História</strong><span>Missões, chefes e novos desbloqueios.</span>', 'class="option-tile mode-story"')}
      ${button('free', `<strong>Modo livre</strong><span>${free ? 'Sobreviva nas fases liberadas.' : 'Disponível após vencer o Deserto na História.'}</span>`, free ? 'class="option-tile mode-free"' : 'class="option-tile mode-free" disabled')}
    </div>`, 'menu', 'mode-shell');
  }

  heroes(data, selected, mode) {
    const hero = CHARACTERS[selected];
    const unlocked = heroUnlocked(data, selected);
    this.shell('Campeões', `
      <div class="hero-layout">
        <div class="hero-preview">${unlocked ? this.portrait(selected) : '<strong aria-hidden="true">?</strong>'}</div>
        <div class="hero-info">
          <span class="kicker">${unlocked ? weapons[hero.primary] : 'BLOQUEADO'}</span><h2>${hero.name}</h2>
          ${unlocked ? `<div class="hero-stats">
            <span><b>${hero.hp}</b> Vida</span><span><b>${hero.damage}</b> Dano base</span><span><b>${hero.armor ?? 0}</b> Armadura</span>
            <span><b>${statNumber(hero.speed)}</b> Velocidade</span><span><b>${hero.range} m</b> Alcance</span><span><b>${statNumber(hero.cooldown)} s</b> Intervalo</span>
            ${hero.crit ? `<span><b>${statNumber(hero.crit * 100)}%</b> Crítico</span>` : ''}
            ${hero.xp ? `<span><b>+${statNumber(hero.xp * 100)}%</b> Experiência</span>` : ''}
            ${hero.magnet ? `<span><b>+${statNumber(hero.magnet)} m</b> Coleta</span>` : ''}
          </div>${CHAMPION_CARD_STYLES[selected] ? `<p>${CHAMPION_CARD_STYLES[selected].description}</p>` : ''}` : `<p>${heroLock(selected)}</p>`}
        </div>
      </div>
      <div class="roster" aria-label="Campeões">${CHAMPION_CELLS.map(id => {
        const available = heroUnlocked(data, id);
        return button('hero:' + id, `${available ? this.portrait(id) : '<b aria-hidden="true">?</b>'}<span>${CHARACTERS[id].name.split(' ')[0]}</span>`,
          `aria-label="${CHARACTERS[id].name}${available ? '' : ' (bloqueado)'}" aria-pressed="${id === selected}"`);
      }).join('')}</div>
      <div class="page-actions">${button('stage', 'Escolher fase &nbsp; ›', unlocked ? 'class="primary"' : 'class="primary" disabled')}</div>`,
    'modes', 'hero-shell', mode === 'story' ? 'História' : 'Modo livre');
  }

  stage(mode, id, profile, mapId = 'desert') {
    const unlocked = profile.data.completedRuns > 0;
    const entry = stageUnlocked(profile.data, mapId);
    const preceding = previousStage(mapId);
    const spec = CAMPAIGN[mapId];
    this.shell('Fases', `
      <nav class="stage-picker" aria-label="Fases">${PLAYABLE_STAGES.map(stage => button('map:' + stage,
        `<small>${STAGE_PRESENTATION[stage].number}</small><span>${stageName(stage)}</span>`,
        `aria-pressed="${mapId === stage}"`)).join('')}</nav>
      <div class="stage-card">
        <div class="stage-picture stage-picture-${mapId}" aria-hidden="true"></div>
        <div class="stage-body">
          <div class="stage-meta"><span>◷ &nbsp; ${CONFIG.duration / 60} minutos</span><span>✷ &nbsp; ${spec.bosses.length} chefes</span>${mode === 'story' ? `<span>† &nbsp; ${spec.missions.length} missões</span>` : ''}</div>
          <p class="stage-desc">${STAGE_PRESENTATION[mapId].description}</p>
          ${entry ? '' : `<p class="stage-tool-note">Vença ${MAPS[preceding].name} na História para abrir esta fase.</p>`}
          <p class="stage-champion">Campeão <b>${CHARACTERS[id].name}</b></p>
        </div>
      </div>
      <nav class="stage-tools" aria-label="Preparação para a partida">
        ${button('arsenal', '<b aria-hidden="true">♠</b><span>Arsenal</span>', unlocked ? '' : 'disabled aria-describedby="arsenal-requirement"')}
        ${button('shop', '<b aria-hidden="true">◉</b><span>Loja do Bento</span>')}
        ${button('bestiary', '<b aria-hidden="true">†</b><span>Bestiário</span>')}
      </nav>
      ${unlocked ? '' : '<p class="stage-tool-note" id="arsenal-requirement">Termine uma partida para liberar o Arsenal.</p>'}
      <div class="page-actions">${button('begin', 'Iniciar fase &nbsp; ›', `class="primary" ${entry ? '' : 'disabled'}`)}</div>`, 'heroes', 'stage-shell');
  }

  settings(data, available, fullscreen) {
    const toggles = [['sound', 'Efeitos sonoros'], ['music', 'Música'], ['wind', 'Poeira']];
    const showControls = this.catalogTab === 'controls';
    const tabs = `<nav class="catalog-tabs" aria-label="Configurações">
      ${button('catalog:tab:general', 'Geral', `aria-pressed="${!showControls}"`)}
      ${button('catalog:tab:controls', 'Controles', `aria-pressed="${showControls}"`)}
    </nav>`;
    this.shell('Configurações', `${tabs}${showControls ? `<dl class="controls">
      <div><dt>Andar</dt><dd><kbd>WASD</kbd> ou <kbd>setas</kbd> · toque e arraste</dd></div>
      <div><dt>Atacar</dt><dd>Automático</dd></div>
      <div><dt>Pausar</dt><dd><kbd>Esc</kbd> ou botão de pausa</dd></div>
      </dl>` : `<div class="settings-list">
      ${toggles.map(([id, title]) => `<label>${title}<input type="checkbox" role="switch" data-setting="${id}" ${data[id] ? 'checked' : ''}></label>`).join('')}
      <label>Resolução <select data-setting="graphics"><option value="normal" ${data.graphics === 'normal' ? 'selected' : ''}>Automática</option><option value="high" ${data.graphics === 'high' ? 'selected' : ''}>Alta nitidez</option></select></label>
      <div class="fullscreen-setting">${button('fullscreen', `${icon('⛶')}<span id="fullscreen-label"></span>`, 'class="primary" aria-describedby="fullscreen-status"')}
        <p id="fullscreen-status" role="status"></p></div>
      </div>`}
      <p id="save-status" role="status">${available ? '' : 'O navegador bloqueou o salvamento local.'}</p>`, 'menu', 'settings-shell');
    this.updateFullscreen(fullscreen);
  }

  updateFullscreen(state, denied = false) {
    const label = this.root.querySelector('#fullscreen-label');
    if (!label) return;
    label.textContent = state === 'active' ? 'Sair da tela cheia' : state === 'standalone' ? 'Tela cheia' : 'Ativar tela cheia';
    label.closest('button').disabled = state === 'standalone' || state === 'unsupported';
    this.root.querySelector('#fullscreen-status').textContent = denied ? 'O navegador recusou o pedido de tela cheia.' : fullscreenMessage[state] ?? '';
  }

  shop(profile) {
    const data = profile.data;
    const list = Object.entries(PERMANENT_UPGRADES).filter(([, spec]) => !spec.after || PLAYABLE_STAGES.includes(spec.after));
    const upgrades = list.map(([id, spec]) => {
      const unlocked = upgradeUnlocked(data, id), price = profile.price(id);
      const note = unlocked ? (Number.isFinite(price) ? money(price) : 'Nível máximo')
        : spec.mission ? `Missão ${spec.mission.split(':')[1]}` : `Conclua ${stageName(spec.after)}`;
      return `<article class="list-item"><b class="item-icon">${spec.icon}</b><div><h3>${spec.name} <small> Nv. ${data[spec.field]}</small></h3><p>${spec.description}</p></div>${button('buy:' + id, note, unlocked && data.coins >= price ? '' : 'disabled')}</article>`;
    });
    const permanentCards = Object.entries(BENTO_CARDS).filter(([, spec]) => PLAYABLE_STAGES.includes(spec.after)).map(([id, spec]) =>
      `<article class="list-item illustrated-item">${abilityCardArt(id)}<div><h3>${nameOf(id)}</h3><p>${localizedCardDescription('pt', id, 1)}</p></div>${button('buy-card:' + id, data.bentoCards.includes(id) ? 'Comprada' : money(spec.price), data.storyClears[spec.after] && !data.bentoCards.includes(id) && data.coins >= spec.price ? '' : 'disabled')}</article>`);
    const groups = [{ id: 'upgrades', label: 'Melhorias', items: upgrades }, { id: 'cards', label: 'Cartas', items: permanentCards }];
    this.shell('Loja do Bento', this.catalog(groups, `<p class="balance" aria-label="Moedas do perfil">${money(data.coins)}</p>`), 'stage', 'list-shell');
  }

  arsenal(data, message = '', hero) {
    const canEdit = data.completedRuns > 0;
    const owned = [...new Set([...STARTER_CARDS, ...unlockedGameplayCards(data), ...data.forgedCards, ...data.bentoCards])];
    const cards = owned.map(id => `<article class="list-item illustrated-item">${abilityCardArt(id)}
      <div><h3>${nameOf(id)}</h3><p>${localizedCardDescription('pt', id, 1, 1, hero)}</p>${cardNote(hero, id)}</div>
      ${button('deck:' + id, data.deck.includes(id) ? 'Equipada' : 'Equipar', `aria-pressed="${data.deck.includes(id)}" ${canEdit ? '' : 'disabled'}`)}</article>`);
    const recipes = Object.entries(FUSIONS).filter(([, spec]) => !spec.after || PLAYABLE_STAGES.includes(spec.after)).map(([id, spec]) =>
      `<article class="list-item illustrated-item">${abilityCardArt(id)}<div><h3>${nameOf(id)}</h3><p>${spec.ingredients.map(card => nameOf(card)).join(' + ')}</p></div>
        ${button('forge:' + id, data.forgedCards.includes(id) ? 'Forjada' : 'Forjar', canEdit && fusionUnlocked(data, id) && spec.ingredients.every(card => data.deck.includes(card)) && !data.forgedCards.includes(id) ? '' : 'disabled')}</article>`);
    const groups = [{ id: 'cards', label: 'Cartas', items: cards }, { id: 'fusions', label: 'Fusões', items: recipes }];
    const summary = `<p class="catalog-summary" title="Mínimo ${DECK_MIN}, máximo ${DECK_MAX}">${data.deck.length}/${DECK_MAX} equipadas</p>`;
    const status = message ? `<p id="arsenal-status" class="inline-status" role="status">${message}</p>` : '';
    this.shell('Arsenal', this.catalog(groups, summary, status), 'stage', 'list-shell');
  }

  bestiary(data) {
    const { groups, found, total } = bestiaryCatalog(data.discoveries);
    const summary = `<p class="catalog-summary">${found}/${total} descobertos</p>`;
    const gallery = this.catalog(groups, summary, '', this.bestiaryPageSize ?? 4);
    this.shell('Bestiário', `${gallery}<dialog id="bestiary-detail" class="bestiary-detail" aria-labelledby="bestiary-title"></dialog>`,
      'stage', 'bestiary-shell');
    const dialog = this.root.querySelector('#bestiary-detail');
    dialog.addEventListener('close', () => {
      if (!dialog.isConnected || dialog.open) return;
      const id = this.creatureId;
      this.creatureId = null;
      if (id) this.root.querySelector(`[data-action="creature:${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
    });
    if (this.creatureId) this.openCreature(data, this.creatureId);
  }

  openCreature(data, id) {
    const dialog = this.root.querySelector('#bestiary-detail');
    const contents = bestiaryDossier(data.discoveries, id);
    if (!dialog || !contents) return;
    this.creatureId = id;
    // Keep this creature on the visible gallery page after rotation.
    this.catalogOffset = bestiaryPosition(id);
    dialog.innerHTML = contents;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('.bestiary-close').focus({ preventScroll: true });
  }

  closeCreature() {
    this.root.querySelector('#bestiary-detail')?.close();
  }

  game(run) {
    this.root.className = 'game-screen';
    this.root.innerHTML = `
      <canvas id="battlefield" aria-label="Campo de batalha isométrico"></canvas><div class="battle-vignette"></div>
      <div class="hud">
        <section class="vitals" aria-label="Campeão"><div class="hud-portrait">${this.portrait(run.characterId)}</div>
          <div class="vitals-text"><span class="hero-name">${run.hero.name}</span><div class="bar hp"><i id="hp-fill"></i></div>
            <span id="hp-value"></span><b id="level"></b></div>
        </section>
        <section class="clock" aria-label="Tempo restante"><span>${stageName(run.mapId)}</span><strong id="timer">15:00</strong><small id="story-track"></small></section>
        <div class="hud-right"><div class="counters"><span title="Eliminações">✕ <b id="kills">0</b></span><span title="Moedas" class="money">◉ <b id="coins">0</b></span></div>
          ${button('pause', 'Ⅱ', 'class="pause-button" aria-label="Pausar"')}
        </div>
        <section class="mission-box" id="mission-box" hidden><span>MISSÃO</span><strong id="mission-title"></strong><small id="mission-progress"></small></section>
        <section class="boss-box" id="boss-box" hidden><strong id="boss-title"></strong><div class="bar boss-health"><i id="boss-fill"></i></div></section>
      </div>
      <div class="weather-notice" id="weather" role="status" hidden></div>
      <div id="intro" class="intro-panel"><span>FASE ${STAGE_PRESENTATION[run.mapId].number}</span><strong>${stageName(run.mapId)}</strong><small id="countdown"></small></div>
      <div class="map-hints" id="map-hints" aria-label="Pontos de interesse"></div>
      <div class="bottom-hud"><div id="ability-bar"></div><span class="key-help">ATAQUES AUTOMÁTICOS <span>·</span> ESC PAUSA</span></div>
      <div class="bar xp" title="Experiência"><i id="xp-fill"></i></div>
      <div id="joystick" aria-hidden="true"><i></i></div>
      <dialog id="run-dialog" aria-labelledby="run-title"></dialog>`;
    this.refs = Object.fromEntries([...this.root.querySelectorAll('[id]')].map(node => [node.id, node]));
    this.keys = {};
    this.runCards = [...new Set([...run.deck, run.hero.startingCard].filter(Boolean))];
    this.lastCards = '';
    this.pendingDialog = '';
    return this.refs;
  }

  hud(run) {
    const { player: p, bossEncounter: encounter, mission } = run;
    const write = (id, value) => {
      if (this.keys[id] === value) return;
      this.keys[id] = value;
      this.refs[id].textContent = value;
    };
    const setBar = (id, ratio) => {
      const value = Math.round(Math.max(0, Math.min(1, ratio)) * 1000) / 1000;
      if (this.keys[id] !== value) this.refs[id].style.transform = `scaleX(${value})`;
      this.keys[id] = value;
    };
    setBar('hp-fill', p.hp / p.maxHp);
    setBar('xp-fill', p.xp / run.requiredXp);
    write('hp-value', `${Math.ceil(p.hp)} / ${p.maxHp}`);
    write('level', `NV. ${p.level}`);
    write('kills', run.kills);
    write('coins', run.coins);
    write('timer', duration(CONFIG.duration - run.time));
    const stage = CAMPAIGN[run.mapId];
    const bosses = `CHEFES ${encounter.nextBoss}/${stage.bosses.length}`;
    write('story-track', run.mode === 'story' ? `MISSÕES ${run.missionsCompleted}/${stage.missions.length} · ${bosses}` : bosses);
    this.refs.intro.hidden = run.phase !== 'intro';
    write('countdown', `A horda chega em ${Math.max(1, Math.ceil(CONFIG.intro - run.introTime))} s`);
    this.refs['mission-box'].hidden = !mission || encounter.active || mission.success;
    if (mission) {
      write('mission-title', missionNames[mission.kind]);
      write('mission-progress', `${mission.progress} / ${mission.target} · ${duration(mission.expiresAt - run.time)}`);
    }
    const boss = encounter.active && run.enemies.find(enemy => enemy.bossId);
    this.refs['boss-box'].hidden = !boss;
    if (boss) {
      write('boss-title', `${nameOf(boss.bossId, 'boss')} · Fase ${boss.phase}/3`);
      setBar('boss-fill', boss.hp / boss.maxHp);
    }
    const alert = run.weather.alertUntil > run.time
      ? run.weather.alert === 'treasure' ? `${TREASURE_CREATURES[run.mapId].name} à vista` : weatherNames[run.weather.alert] : '';
    const vultureWarning = run.enemies.some(e => e.type === 'vulture' && e.warning > 0);
    this.refs.weather.hidden = !alert && !vultureWarning;
    write('weather', alert || (vultureWarning ? 'Urubus em aproximação' : ''));
    const cards = this.runCards.filter(id => run.abilities[id]).map(id => [id, run.abilities[id]]);
    const cardKey = cards.map(([id, level]) => `${id}:${level}`).join(',');
    if (cardKey !== this.lastCards || !this.refs['ability-bar'].hasChildNodes()) {
      this.refs['ability-bar'].innerHTML = `<span title="${weapons[run.hero.primary]}">${run.hero.icon}</span>` + cards.map(([id, level]) =>
        `<span title="${nameOf(id)} · Nível ${level}">${abilityCardArt(id)}<small>${level}</small></span>`).join('');
      this.lastCards = cardKey;
    }
    this.hints(run);
  }

  hints(run) {
    const points = [];
    if (run.merchant) points.push(['merchant', run.merchant, 'Bento']);
    const crate = run.crates.reduce((nearest, current) =>
      !nearest || Math.hypot(current.x - run.player.x, current.z - run.player.z) < Math.hypot(nearest.x - run.player.x, nearest.z - run.player.z) ? current : nearest, null);
    if (crate && !run.bossEncounter.active) points.push(['crate', crate, 'Caixa']);
    const treasure = run.enemies.find(enemy => enemy.treasure);
    if (treasure) points.push(['treasure', treasure, 'Tesouro']);
    const items = points.map(([type, point, title]) => {
      const x = point.x - run.player.x, z = point.z - run.player.z;
      const direction = Math.round((Math.atan2((x + z) * .5, x - z) / (Math.PI / 4) + 8) % 8) % 8;
      const arrow = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'][direction];
      return `<span class="map-hint" title="${title}">${arrow} ${markerGlyphs[type]} <b>${title}</b> ${Math.round(Math.hypot(x, z))} m</span>`;
    }).join('');
    if (items !== this.keys.hints) {
      this.refs['map-hints'].innerHTML = items;
      this.keys.hints = items;
    }
  }

  overlay(vm, force = false) {
    const run = vm.model, dialog = this.refs['run-dialog'];
    const phase = vm.confirmExit ? 'confirm' : vm.paused ? 'pause' : run.phase;
    if (!force && this.pendingDialog === phase) return;
    if (phase === 'merchant' && this.pendingDialog !== phase) this.resetCatalog();
    this.pendingDialog = phase;
    if (['intro', 'playing'].includes(phase)) {
      if (dialog.open) dialog.close();
      return;
    }
    const card = (id, action) => {
      const level = run.abilities[id] + 1;
      return button(action + ':' + id, `${abilityCardArt(id)}<span class="card-copy"><span class="card-level">${level > 1 ? 'NÍVEL ' + level : 'NOVA CARTA'}</span>
        <strong>${nameOf(id)}</strong><span class="card-desc">${localizedCardDescription('pt', id, level, run.attackRate, run.characterId)}</span>${cardNote(run.characterId, id)}</span>`, 'class="upgrade-card illustrated-card"');
    };
    const heading = (label, title) => `<span class="kicker">${label}</span><h2 id="run-title">${title}</h2>`;
    if (phase === 'upgrade' || phase === 'mission-card') {
      const offers = phase === 'upgrade' ? run.cardOffers : run.missionOffers;
      if (this.offerSet !== offers) {
        this.offerSet = offers;
        this.resetCatalog();
      }
      const items = offers.map(id => card(id, phase === 'upgrade' ? 'choose' : 'mission-card'));
      const contents = this.singleOffer
        ? `<div class="single-offer">${this.catalog([{ id: 'offers', items }], '', '', 1)}</div>`
        : `<div class="card-grid">${items.join('')}</div>`;
      dialog.innerHTML = heading(phase === 'upgrade' ? `NÍVEL ${run.player.level}` : '', 'Escolha uma carta') + contents;
    } else if (phase === 'mission-reward') {
      dialog.innerHTML = heading('MISSÃO CUMPRIDA', 'Escolha sua recompensa') + `<div class="card-grid">
        ${button('reward:coins', '<b class="card-icon">◉</b><strong>25 moedas</strong>', 'class="upgrade-card"')}
        ${button('reward:health', '<b class="card-icon">♥</b><strong>Tônico</strong><p>+20 de vida máxima e recupera 40 de vida.</p>', 'class="upgrade-card"')}
        ${button('reward:card', '<b class="card-icon">♠</b><strong>Carta de combate</strong><p>Escolha uma carta para fortalecer sua partida.</p>', 'class="upgrade-card"')}</div>`;
    } else if (phase === 'merchant') {
      const items = run.merchantCards.map(id => {
        const price = temporaryPrice(run.shopPurchases[id]);
        const title = { whip: 'Arma principal', haste: 'Velocidade de ataque', spur: 'Velocidade de movimento' }[id] || nameOf(id);
        const cardArt = Object.hasOwn(run.abilities, id) ? abilityCardArt(id) : '';
        return `<article class="list-item ${cardArt ? 'illustrated-item' : ''}">${cardArt}<div><h3>${title}</h3><small>${run.abilities[id] ? `Nível ${run.abilities[id]} / ${abilityMaxLevel(id)}` : `Compras ${run.shopPurchases[id]}`}</small></div>${button('run-buy:' + id, money(price), run.coins >= price ? '' : 'disabled')}</article>`;
      });
      dialog.innerHTML = heading('', 'Loja do Bento') +
        this.catalog([{ id: 'merchant', items }], `<p class="balance">Moedas da partida ${money(run.coins)}</p>`, '', Math.min(3, this.pageSize)) +
        `<div class="page-actions">${button('leave-merchant', 'Voltar à partida', 'class="primary"')}</div>`;
    } else if (phase === 'pause') {
      dialog.innerHTML = heading(stageName(run.mapId), 'Partida pausada') + `<div class="dialog-buttons">
        ${button('pause', 'Continuar', 'class="primary"')}${button('ask-exit', 'Voltar ao menu')}</div>`;
    } else if (phase === 'confirm') {
      dialog.innerHTML = heading('PARTIDA EM ANDAMENTO', 'Abandonar a partida?') + `<p>Para registrar as moedas e descobertas, termine a partida.</p><div class="dialog-buttons">
        ${button('cancel-exit', 'Voltar à pausa', 'class="primary"')}${button('menu', 'Abandonar partida')}</div>`;
    } else {
      const victorious = phase === 'victory';
      const cleared = victorious && (run.mode === 'free' || run.campaignComplete());
      const unlocked = vm.profile.arsenalJustUnlocked ? '<p class="unlock-result">Arsenal liberado na seleção de fase.</p>' : '';
      dialog.innerHTML = heading(victorious ? 'FIM DA SOBREVIVÊNCIA' : 'FIM DA PARTIDA', cleared ? 'Fase conquistada' : victorious ? 'Você sobreviveu' : 'A fronteira venceu') +
        `<div class="result-stats"><span><b>${duration(run.time)}</b> Tempo</span><span><b>${run.kills}</b> Eliminações</span><span><b>${run.coins}</b> Moedas</span></div>
        ${victorious && !cleared ? '<p>Conclua as missões e derrote os chefes na mesma partida para avançar na História.</p>' : ''}
        ${unlocked}
        ${!vm.profile.available ? '<p>O navegador bloqueou o salvamento. O progresso vale nesta sessão.</p>' : ''}
        <div class="dialog-buttons">${button('retry', 'Jogar de novo', 'class="primary"')}${button('stage', 'Seleção de fase')}${button('menu', 'Menu principal')}</div>`;
    }
    dialog.className = ['upgrade', 'mission-card', 'mission-reward'].includes(phase) ? 'wide-dialog' : phase === 'merchant' ? 'merchant-dialog' : '';
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }
}
