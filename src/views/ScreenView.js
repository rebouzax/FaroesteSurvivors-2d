import logo from '../assets/logo-faroeste-survivors.webp';
import { ABILITIES, abilityMaxLevel, enemyStats } from '../config/abilityConfig.js';
import { CAMPAIGN, ENEMY_WEAKNESSES, MISSION_HERO_REWARDS, heroUnlocked, unlockedGameplayCards } from '../config/campaignConfig.js';
import { CHARACTERS } from '../config/characterConfig.js';
import { BENTO_CARDS, DECK_MAX, DECK_MIN, FUSIONS, STARTER_CARDS, fusionUnlocked } from '../config/deckConfig.js';
import { CONFIG } from '../config/gameConfig.js';
import { PERMANENT_UPGRADES, temporaryPrice, upgradeUnlocked } from '../config/shopConfig.js';
import { localizedCardDescription, t } from '../services/I18n.js';
import { CHAMPION_CELLS } from './ChampionAnimation.js';
import { MenuBackdrop } from './MenuBackdrop.js';

const weapons = { whip: 'Laço vaqueiro', revolver: 'Revólver', shotgun: 'Escopeta', bow: 'Arco', dual: 'Dois revólveres', crossbow: 'Besta' };
const enemies = ['bat', 'dog', 'vulture', 'skeleton', ...CAMPAIGN.desert.bosses.map(boss => boss.id)];
const missionNames = { bat: 'Abata morcegos', crate: 'Recolha caixas de suprimentos', skeleton: 'Abata esqueletos' };
const weatherNames = { sand: 'Tempestade de areia', tornado: 'Tornados no deserto', treasure: 'Escorpião do Ouro avistado', 'mission-failed': 'O prazo da missão acabou' };
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
  : 'Conclua o Deserto no modo História.';

export class ScreenView {
  constructor(root, action, setting) {
    this.root = root;
    this.portraits = {};
    root.addEventListener('click', event => {
      const target = event.target.closest('[data-action]');
      if (target && !target.disabled) action(target.dataset.action);
    });
    root.addEventListener('change', event => {
      const { setting: key } = event.target.dataset;
      if (key) setting(key, event.target.type === 'checkbox' ? event.target.checked : event.target.value);
    });
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
          ${button('modes', 'Novo jogo', 'class="primary"')}
          ${button('settings', 'Configurações')}
          ${button('exit', 'Sair')}
        </nav>
      </section>`;
    this.menuBackdrop = new MenuBackdrop(this.root.querySelector('.menu-motion'), wind);
  }

  stopMenuMotion() {
    this.menuBackdrop?.dispose();
    this.menuBackdrop = null;
  }

  shell(title, content, back = 'menu', className = '', label = '') {
    this.root.className = 'selection-screen';
    this.root.innerHTML = `
      <div class="menu-landscape" aria-hidden="true"></div>
      <header class="sub-header">${button(back, '← &nbsp; Voltar', 'class="back-button"')}</header>
      <section class="page-shell ${className}">
        ${label ? `<div class="kicker">${label}</div>` : ''}
        <h1 tabindex="-1">${title}</h1>${content}
      </section>`;
    this.root.querySelector('h1').focus({ preventScroll: true });
  }

  modes(data) {
    const free = data.storyClears.desert;
    this.shell('Escolha o modo', `<div class="mode-grid">
      ${button('story', '<b class="mode-icon" aria-hidden="true">✷</b><strong>História</strong><p>Conclua as missões do Deserto e derrote os três chefes para liberar novos campeões e cartas.</p><small>Iniciar história ↗</small>', 'class="option-tile"')}
      ${button('free', `<b class="mode-icon" aria-hidden="true">◇</b><strong>Modo livre</strong><p>Volte ao deserto com os campeões e cartas que você já liberou. As missões são opcionais.</p><small>${free ? 'Iniciar modo livre ↗' : 'Conclua o Deserto no modo História'}</small>`, free ? 'class="option-tile"' : 'class="option-tile" disabled')}
    </div>`);
  }

  heroes(data, selected, mode) {
    const hero = CHARACTERS[selected];
    const unlocked = heroUnlocked(data, selected);
    this.shell('Escolha seu campeão', `
      <div class="hero-layout">
        <div class="hero-preview">${unlocked ? this.portrait(selected) : '<strong aria-hidden="true">?</strong>'}</div>
        <div class="hero-info">
          <span class="kicker">${unlocked ? weapons[hero.primary] : 'BLOQUEADO'}</span><h2>${hero.name}</h2>
          ${unlocked ? `<div class="hero-stats"><span><b>${hero.hp}</b> Vida</span><span><b>${hero.damage}</b> Dano</span><span><b>${hero.speed.toLocaleString('pt-BR')}</b> Velocidade</span></div>
          <p>${selected === 'joao' ? 'O laço atinge vários inimigos à frente. Aproxime-se, ataque e abra espaço para escapar.' : 'A arma mira e ataca automaticamente. Use o movimento para manter as criaturas ao alcance.'}</p>` : `<p>${heroLock(selected)}</p>`}
        </div>
      </div>
      <div class="roster" aria-label="Campeões">${CHAMPION_CELLS.map(id => {
        const available = heroUnlocked(data, id);
        return button('hero:' + id, `${available ? this.portrait(id) : '<b aria-hidden="true">?</b>'}<span>${CHARACTERS[id].name.split(' ')[0]}</span>`,
          `aria-label="${CHARACTERS[id].name}${available ? '' : ' (bloqueado)'}" aria-pressed="${id === selected}"`);
      }).join('')}</div>
      <div class="page-actions">${button('stage', 'Escolher fase &nbsp; ↗', unlocked ? 'class="primary"' : 'class="primary" disabled')}</div>`,
    'modes', 'hero-shell', mode === 'story' ? 'MODO HISTÓRIA' : 'MODO LIVRE');
  }

  stage(mode, id, profile) {
    const unlocked = profile.data.completedRuns > 0;
    this.shell('Deserto dos Esquecidos', `
      <div class="stage-card">
        <div class="stage-picture" aria-hidden="true"></div>
        <div class="stage-body">
          <div class="stage-meta"><span>◷ &nbsp; 15 minutos</span><span>✷ &nbsp; 3 chefes</span>${mode === 'story' ? '<span>† &nbsp; 3 missões</span>' : ''}</div>
          <p>${mode === 'story' ? 'Sobreviva às hordas da fronteira, cumpra as missões e vença os três chefes.' : 'Sobreviva às hordas da fronteira e enfrente os três chefes.'}</p>
          <p class="stage-champion">Campeão <b>${CHARACTERS[id].name}</b></p>
        </div>
      </div>
      <nav class="stage-tools" aria-label="Preparação para a partida">
        ${button('arsenal', '<b aria-hidden="true">♠</b><span>Arsenal</span>', unlocked ? '' : 'disabled aria-describedby="arsenal-requirement"')}
        ${button('shop', '<b aria-hidden="true">◉</b><span>Loja do Bento</span>')}
        ${button('bestiary', '<b aria-hidden="true">†</b><span>Bestiário</span>')}
      </nav>
      ${unlocked ? '' : '<p class="stage-tool-note" id="arsenal-requirement">Termine uma partida para liberar o Arsenal.</p>'}
      <div class="page-actions">${button('begin', 'Entrar no deserto &nbsp; ↗', 'class="primary"')}</div>`, 'heroes', 'stage-shell');
  }

  settings(data, available) {
    const toggles = [['sound', 'Efeitos sonoros'], ['music', 'Música'], ['wind', 'Partículas de poeira']];
    this.shell('Configurações', `<div class="settings-list">
      ${toggles.map(([id, title]) => `<label>${title}<input type="checkbox" data-setting="${id}" ${data[id] ? 'checked' : ''}></label>`).join('')}
      <label>Resolução do jogo <select data-setting="graphics"><option value="normal" ${data.graphics === 'normal' ? 'selected' : ''}>Automática</option><option value="high" ${data.graphics === 'high' ? 'selected' : ''}>Priorizar nitidez</option></select></label>
      </div>
      <details class="controls" open><summary>Controles</summary><p>Use <kbd>WASD</kbd>, <kbd>↑ ↓ ← →</kbd> ou toque e arraste para andar. Os ataques são automáticos. Pressione <kbd>Esc</kbd> para pausar.</p></details>
      <p id="save-status" role="status">${available ? '' : 'O navegador bloqueou o salvamento local.'}</p>`, 'menu', 'settings-shell');
  }

  shop(profile) {
    const data = profile.data;
    const list = Object.entries(PERMANENT_UPGRADES).filter(([, spec]) => !spec.after || spec.after === 'desert');
    const upgrades = list.map(([id, spec]) => {
      const unlocked = upgradeUnlocked(data, id), price = profile.price(id);
      const note = unlocked ? (Number.isFinite(price) ? money(price) : 'Nível máximo')
        : spec.mission ? `Missão ${spec.mission.split(':')[1]}` : 'Conclua o Deserto';
      return `<article class="list-item"><b class="item-icon">${spec.icon}</b><div><h3>${spec.name} <small> Nv. ${data[spec.field]}</small></h3><p>${spec.description}</p></div>${button('buy:' + id, note, unlocked && data.coins >= price ? '' : 'disabled')}</article>`;
    });
    const permanentCards = Object.entries(BENTO_CARDS).filter(([, spec]) => spec.after === 'desert').map(([id, spec]) =>
      `<article class="list-item"><b class="item-icon">♠</b><div><h3>${nameOf(id)}</h3><p>${localizedCardDescription('pt', id, 1)}</p></div>${button('buy-card:' + id, data.bentoCards.includes(id) ? 'Comprada' : money(spec.price), data.storyClears.desert && !data.bentoCards.includes(id) && data.coins >= spec.price ? '' : 'disabled')}</article>`);
    this.shell('Loja do Bento', `<p class="balance">Moedas do perfil ${money(data.coins)}</p><div class="item-list">${[...upgrades, ...permanentCards].join('')}</div>`, 'stage', 'list-shell');
  }

  arsenal(data, message = '') {
    const canEdit = data.completedRuns > 0;
    const owned = [...new Set([...STARTER_CARDS, ...unlockedGameplayCards(data), ...data.forgedCards, ...data.bentoCards])];
    const cards = owned.map(id => `<article class="list-item"><b class="item-icon">${ABILITIES[id]?.icon || '♠'}</b>
      <div><h3>${nameOf(id)}</h3><p>${localizedCardDescription('pt', id, 1)}</p></div>
      ${button('deck:' + id, data.deck.includes(id) ? 'Equipada' : 'Equipar', `aria-pressed="${data.deck.includes(id)}" ${canEdit ? '' : 'disabled'}`)}</article>`).join('');
    const recipes = Object.entries(FUSIONS).filter(([, spec]) => !spec.after || spec.after === 'desert').map(([id, spec]) =>
      `<article class="list-item"><b class="item-icon">✦</b><div><h3>${nameOf(id)}</h3><p>${spec.ingredients.map(card => nameOf(card)).join(' + ')}</p></div>
        ${button('forge:' + id, data.forgedCards.includes(id) ? 'Forjada' : 'Forjar', canEdit && fusionUnlocked(data, id) && spec.ingredients.every(card => data.deck.includes(card)) && !data.forgedCards.includes(id) ? '' : 'disabled')}</article>`).join('');
    this.shell('Arsenal', `<p>${canEdit ? `${data.deck.length} cartas equipadas · Mínimo ${DECK_MIN}, máximo ${DECK_MAX}` : 'Termine uma partida para editar o baralho.'}</p>
      <p id="arsenal-status" class="inline-status" role="status">${message}</p><div class="item-list">${cards}</div><h2 class="list-heading">Fusões</h2><div class="item-list">${recipes}</div>`, 'stage', 'list-shell');
  }

  bestiary(data) {
    this.shell('Bestiário', `<p>Derrote as criaturas da fronteira para registrar suas fraquezas.</p>
      <div class="bestiary-grid">${enemies.map(id => {
        const defeated = data.discoveries.enemies.includes(id) || data.discoveries.bosses.includes(id);
        const known = defeated || data.discoveries.encounteredBosses.includes(id);
        const boss = CAMPAIGN.desert.bosses.find(spec => spec.id === id);
        const stats = boss || enemyStats(id, 0);
        return `<article class="creature-card"><div>${known ? this.portrait(id) : '<b aria-hidden="true">?</b>'}</div>
          <h3>${known ? nameOf(id, boss ? 'boss' : 'enemy') : 'Desconhecido'}</h3>
          <p>${defeated ? nameOf(boss?.weakness || ENEMY_WEAKNESSES[id]) : known ? 'Encontrado' : 'Ainda não registrado'}</p>
          ${known ? `<small>${stats.hp} Vida · ${stats.damage} Dano</small>` : ''}
        </article>`;
      }).join('')}</div>`, 'stage', 'list-shell');
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
        <section class="clock" aria-label="Tempo restante"><span>DESERTO DOS ESQUECIDOS</span><strong id="timer">15:00</strong><small id="story-track"></small></section>
        <div class="hud-right"><div class="counters"><span title="Eliminações">✕ <b id="kills">0</b></span><span title="Moedas" class="money">◉ <b id="coins">0</b></span></div>
          ${button('pause', 'Ⅱ', 'class="pause-button" aria-label="Pausar"')}
        </div>
        <section class="mission-box" id="mission-box" hidden><span>MISSÃO</span><strong id="mission-title"></strong><small id="mission-progress"></small></section>
        <section class="boss-box" id="boss-box" hidden><strong id="boss-title"></strong><div class="bar boss-health"><i id="boss-fill"></i></div></section>
      </div>
      <div class="weather-notice" id="weather" role="status" hidden></div>
      <div id="intro" class="intro-panel"><span>FASE 01</span><strong>Deserto dos Esquecidos</strong><small id="countdown"></small></div>
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
    write('story-track', run.mode === 'story' ? `MISSÕES ${run.missionsCompleted}/3 · CHEFES ${encounter.nextBoss}/3` : `CHEFES ${encounter.nextBoss}/3`);
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
    const alert = run.weather.alertUntil > run.time ? weatherNames[run.weather.alert] : '';
    const vultureWarning = run.enemies.some(e => e.type === 'vulture' && e.warning > 0);
    this.refs.weather.hidden = !alert && !vultureWarning;
    write('weather', alert || (vultureWarning ? 'Urubus em aproximação' : ''));
    const cards = this.runCards.filter(id => run.abilities[id]).map(id => [id, run.abilities[id]]);
    const cardKey = cards.map(([id, level]) => `${id}:${level}`).join(',');
    if (cardKey !== this.lastCards || !this.refs['ability-bar'].hasChildNodes()) {
      this.refs['ability-bar'].innerHTML = `<span title="${weapons[run.hero.primary]}">${run.hero.icon}</span>` + cards.map(([id, level]) =>
        `<span title="${nameOf(id)} · Nível ${level}">${ABILITIES[id]?.icon || '♠'}<small>${level}</small></span>`).join('');
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
    this.pendingDialog = phase;
    if (['intro', 'playing'].includes(phase)) {
      if (dialog.open) dialog.close();
      return;
    }
    const card = (id, action) => {
      const level = run.abilities[id] + 1;
      return button(action + ':' + id, `<span class="card-level">${level > 1 ? 'NÍVEL ' + level : 'NOVA CARTA'}</span><b class="card-icon">${ABILITIES[id]?.icon || '♠'}</b>
        <strong>${nameOf(id)}</strong><p>${localizedCardDescription('pt', id, level, run.attackRate)}</p>`, 'class="upgrade-card"');
    };
    const heading = (label, title) => `<span class="kicker">${label}</span><h2 id="run-title">${title}</h2>`;
    if (phase === 'upgrade' || phase === 'mission-card') {
      const offers = phase === 'upgrade' ? run.cardOffers : run.missionOffers;
      dialog.innerHTML = heading(phase === 'upgrade' ? `NÍVEL ${run.player.level}` : 'RECOMPENSA', 'Escolha uma carta') +
        `<div class="card-grid">${offers.map((id) => card(id, phase === 'upgrade' ? 'choose' : 'mission-card')).join('')}</div>`;
    } else if (phase === 'mission-reward') {
      dialog.innerHTML = heading('MISSÃO CUMPRIDA', 'Escolha sua recompensa') + `<div class="card-grid">
        ${button('reward:coins', '<b class="card-icon">◉</b><strong>25 moedas</strong>', 'class="upgrade-card"')}
        ${button('reward:health', '<b class="card-icon">♥</b><strong>Tônico</strong><p>+20 de vida máxima e recupera 40 de vida.</p>', 'class="upgrade-card"')}
        ${button('reward:card', '<b class="card-icon">♠</b><strong>Carta de combate</strong><p>Escolha uma carta para fortalecer sua partida.</p>', 'class="upgrade-card"')}</div>`;
    } else if (phase === 'merchant') {
      dialog.innerHTML = heading('MERCADOR DO DESERTO', 'Bento') + `<p>Moedas da partida ${money(run.coins)}</p><div class="item-list merchant-list">${run.merchantCards.map(id => {
        const price = temporaryPrice(run.shopPurchases[id]);
        const title = { whip: 'Arma principal', haste: 'Velocidade de ataque', spur: 'Velocidade de movimento' }[id] || nameOf(id);
        return `<article class="list-item"><div><h3>${title}</h3><small>${run.abilities[id] ? `Nível ${run.abilities[id]} / ${abilityMaxLevel(id)}` : `Compras ${run.shopPurchases[id]}`}</small></div>${button('run-buy:' + id, money(price), run.coins >= price ? '' : 'disabled')}</article>`;
      }).join('')}</div><div class="page-actions">${button('leave-merchant', 'Voltar à partida', 'class="primary"')}</div>`;
    } else if (phase === 'pause') {
      dialog.innerHTML = heading('DESERTO DOS ESQUECIDOS', 'Partida pausada') + `<div class="dialog-buttons">
        ${button('pause', 'Continuar', 'class="primary"')}${button('ask-exit', 'Voltar ao menu')}</div>`;
    } else if (phase === 'confirm') {
      dialog.innerHTML = heading('PARTIDA EM ANDAMENTO', 'Abandonar a partida?') + `<p>Para registrar as moedas e descobertas, termine a partida.</p><div class="dialog-buttons">
        ${button('cancel-exit', 'Voltar à pausa', 'class="primary"')}${button('menu', 'Abandonar partida')}</div>`;
    } else {
      const victorious = phase === 'victory';
      const cleared = victorious && (run.mode === 'free' || run.campaignComplete());
      const unlocked = vm.profile.arsenalJustUnlocked ? '<p class="unlock-result">Arsenal liberado na seleção de fase.</p>' : '';
      dialog.innerHTML = heading(victorious ? 'FIM DA SOBREVIVÊNCIA' : 'FIM DA PARTIDA', cleared ? 'Deserto conquistado' : victorious ? 'Você sobreviveu' : 'A fronteira venceu') +
        `<div class="result-stats"><span><b>${duration(run.time)}</b> Tempo</span><span><b>${run.kills}</b> Eliminações</span><span><b>${run.coins}</b> Moedas</span></div>
        ${victorious && !cleared ? '<p>Conclua as três missões e derrote os chefes na mesma partida para liberar o Modo livre.</p>' : ''}
        ${unlocked}
        ${!vm.profile.available ? '<p>O navegador bloqueou o salvamento. O progresso vale nesta sessão.</p>' : ''}
        <div class="dialog-buttons">${button('retry', 'Jogar de novo', 'class="primary"')}${button('stage', 'Seleção de fase')}${button('menu', 'Menu principal')}</div>`;
    }
    dialog.className = ['upgrade', 'mission-card', 'mission-reward'].includes(phase) ? 'wide-dialog' : '';
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }
}
