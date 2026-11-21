import './style.css';
import './views/bestiary.css';
import { AudioService } from './services/AudioService.js';
import { enterTouchFullscreen, fullscreenState, toggleFullscreen, usesTouchLayout } from './services/Fullscreen.js';
import { InputService } from './services/InputService.js';
import { ProfileService } from './services/ProfileService.js';
import { AppViewModel } from './viewmodels/AppViewModel.js';
import { baseArt, desertArt } from './views/DesertArt.js';
import { ScreenView } from './views/ScreenView.js';
import { RenderQuality } from './views/RenderQuality.js';
import { BattlefieldMotion } from './views/BattlefieldMotion.js';
import { CHAMPION_CELLS, MINE_CHAMPIONS } from './views/ChampionAnimation.js';
import { MAPS } from './config/mapConfig.js';
import { bestiaryPageSize, menuPageSize, showSingleOffer } from './views/MenuPagination.js';

const root = document.querySelector('#app');
const audio = new AudioService();
const profile = new ProfileService();
const vm = new AppViewModel(profile, audio, CHAMPION_CELLS);
let session;
let loadingRun;
let shownPage;
let fullscreenHandled = false;
let fullscreenPending = false;
let pageSize = menuPageSize(window.innerHeight);
let singleOffer = showSingleOffer(window.innerWidth, window.innerHeight);
let gallerySize = bestiaryPageSize(window.innerWidth, window.innerHeight);
const portraitsPromises = new Map();
const screen = new ScreenView(root, action => {
  const focus = document.activeElement?.dataset?.action;
  if (action === 'fullscreen' && vm.page === 'settings') {
    if (fullscreenPending) return;
    fullscreenHandled = fullscreenPending = true;
    // Call within the button's click to retain the browser's user activation.
    void toggleFullscreen().then(outcome => {
      fullscreenPending = false;
      screen.updateFullscreen(fullscreenState(), outcome === 'denied');
    });
    return;
  }
  if (action.startsWith('catalog:') && screen.changeCatalog(action)) {
    if (vm.page === 'game') screen.overlay(vm.run, true);
    else render(vm);
    screen.restoreCatalogFocus(focus);
    return;
  }
  if (vm.page === 'bestiary') {
    if (action.startsWith('creature:')) {
      screen.openCreature(profile.data, action.slice('creature:'.length));
      return;
    }
    if (action === 'close-creature') {
      screen.closeCreature();
      return;
    }
  }
  if (action === 'modes' && !fullscreenHandled && usesTouchLayout()) {
    fullscreenHandled = true;
    void enterTouchFullscreen();
  }
  vm.action(action);
  if (focus === action && !['game', 'menu'].includes(vm.page) &&
      /^(hero|map|buy|buy-card|deck|forge):/.test(action)) {
    const restore = root.querySelector(`[data-action="${CSS.escape(action)}"]`);
    if (!restore?.disabled) restore?.focus({ preventScroll: true });
  }
}, (key, value) => {
  vm.setting(key, value);
  root.querySelector(`[data-setting="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
});
const updateFullscreen = () => screen.updateFullscreen(fullscreenState());
document.addEventListener('fullscreenchange', updateFullscreen);
document.addEventListener('webkitfullscreenchange', updateFullscreen);
window.addEventListener('resize', () => {
  const nextSize = menuPageSize(window.innerHeight);
  const nextOffer = showSingleOffer(window.innerWidth, window.innerHeight);
  const nextGallery = bestiaryPageSize(window.innerWidth, window.innerHeight);
  if (pageSize === nextSize && singleOffer === nextOffer && gallerySize === nextGallery) return;
  singleOffer = nextOffer;
  pageSize = nextSize;
  screen.pageSize = pageSize;
  screen.singleOffer = singleOffer;
  screen.bestiaryPageSize = gallerySize = nextGallery;
  if (['arsenal', 'shop', 'bestiary'].includes(vm.page)) render(vm);
  else if (vm.page === 'game' && session && ['merchant', 'upgrade', 'mission-card'].includes(vm.run.model.phase)) screen.overlay(vm.run, true);
});
screen.pageSize = pageSize;
screen.singleOffer = singleOffer;
screen.bestiaryPageSize = gallerySize;
audio.setPreferences(profile.data.sound, profile.data.music);

for (const name of ['pointerdown', 'keydown', 'click']) {
  document.addEventListener(name, () => { if (!audio.musicUnlocked) audio.unlock(); }, { capture: true, passive: true });
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    vm.pauseForVisibility();
    audio.suspend();
  } else audio.resume();
});

function render(app, force = false) {
  const data = app.profile.data;
  const previousPage = shownPage;
  shownPage = app.page;
  if (previousPage !== app.page) screen.resetCatalog();
  if (app.page !== 'menu') screen.stopMenuMotion?.();
  if (app.page === 'game') {
    if (session?.vm === app.run) {
      session.input.clear();
      screen.hud(app.run.model);
      screen.overlay(app.run, force);
      session.sync();
    } else if (loadingRun !== app.run) {
      stopGame();
      mount(app.run);
    }
    return;
  }
  stopGame();
  const pages = {
    menu: () => screen.menu(data.wind),
    modes: () => screen.modes(data),
    heroes: () => screen.heroes(data, app.selected, app.mode),
    stage: () => screen.stage(app.mode, app.selected, app.profile, app.stageId),
    settings: () => screen.settings(data, profile.available, fullscreenState()),
    shop: () => screen.shop(profile),
    arsenal: () => screen.arsenal(data, app.message, app.selected),
    bestiary: () => screen.bestiary(data),
    exit: () => screen.shell('O deserto espera.', '<p>Você pode fechar esta aba ou voltar ao menu.</p>', 'menu', 'settings-shell'),
  };
  pages[app.page]();
  if (previousPage !== app.page) window.scrollTo(0, 0);
  if (['modes', 'heroes'].includes(app.page)) preparePortraits();
}

function preparePortraits() {
  const withMine = Boolean(profile.data.storyClears.mine);
  if (portraitsPromises.has(withMine)) return;
  portraitsPromises.set(withMine, baseArt(withMine).then(art => {
    Object.assign(screen.portraits, art.portraits);
    if (vm.page === 'heroes') {
      const focus = document.activeElement?.dataset?.action;
      render(vm);
      if (focus) root.querySelector(`[data-action="${CSS.escape(focus)}"]`)?.focus({ preventScroll: true });
    }
  }).catch(error => {
    portraitsPromises.delete(withMine);
    console.warn('Os retratos serão carregados novamente ao iniciar a partida.', error);
  }));
}

async function mount(gameVm) {
  loadingRun = gameVm;
  const run = gameVm.model;
  const stageName = MAPS[run.mapId].name;
  screen.shell(`Preparando ${stageName}…`, '', 'menu', 'settings-shell');
  try {
    const withMine = run.mapId === 'mine' || MINE_CHAMPIONS.includes(run.characterId);
    const [art, { DesertView }] = await Promise.all([desertArt(withMine), import('./views/DesertView.js')]);
    Object.assign(screen.portraits, art.portraits);
    if (vm.run !== gameVm || loadingRun !== gameVm) return;
    loadingRun = null;
    const refs = screen.game(run);
    const compact = usesTouchLayout();
    const high = profile.data.graphics === 'high';
    const quality = new RenderQuality({ compact, high });
    const motion = new BattlefieldMotion();
    const view = new DesertView(refs.battlefield, art, run.props, {
      ...profile.data, compact, renderScale: quality.scale, stageId: run.mapId,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
    const input = new InputService(refs.battlefield, refs.joystick, () => vm.action('pause'),
      () => !gameVm.paused && run.phase === 'playing');
    refs['run-dialog'].addEventListener('cancel', event => {
      event.preventDefault();
      if (gameVm.paused || run.phase === 'merchant') vm.action('pause');
    });
    const active = () => !gameVm.paused && (run.phase === 'intro' || run.phase === 'playing');
    const game = { vm: gameVm, view, input, frame: null, resized: true, sync };
    session = game;
    let last = null, paintedAt = null, nextPaint = null, accumulator = 0, hudElapsed = .1;
    const step = 1 / 60;
    const paintInterval = 1000 / (!compact && high ? 90 : 60);
    const schedule = () => {
      if (session === game && game.frame === null) game.frame = requestAnimationFrame(tick);
    };
    function sync() {
      last = null;
      nextPaint = null;
      accumulator = 0;
      motion.reset();
      quality.reset();
      if (active() || !view.ready || game.resized) schedule();
      else if (game.frame !== null) {
        cancelAnimationFrame(game.frame);
        game.frame = null;
      }
    }
    const tick = (now) => {
      game.frame = null;
      if (session !== game) return;
      const elapsed = last === null ? 0 : now - last;
      const dt = Math.min(.1, elapsed / 1000);
      last = now;
      const phase = run.phase;
      if (active()) {
        if (phase === 'playing' && quality.observe(elapsed)) view.setRenderScale(quality.scale);
        accumulator += dt;
        if (accumulator >= step) {
          const axis = input.read();
          const direction = { x: axis.x + axis.z * 2, z: -axis.x + axis.z * 2 };
          while (accumulator >= step && active()) {
            motion.capture(run);
            gameVm.update(step, direction);
            accumulator -= step;
          }
        }
      }
      const enteredModal = run.phase !== phase && !active();
      if (enteredModal) {
        input.clear();
      }
      const paintDue = nextPaint === null || now + .6 >= nextPaint;
      if (!view.ready || game.resized || enteredModal || (active() && paintDue)) {
        game.resized = false;
        const paintDt = paintedAt === null ? 0 : Math.min(.1, (now - paintedAt) / 1000);
        const frame = view.draw(run, paintDt, motion, active() ? accumulator / step : 1);
        if (!gameVm.paused) audio.presentRun(run, frame);
        paintedAt = now;
        nextPaint = nextPaint === null || Math.abs(now - nextPaint) > paintInterval * 2
          ? now + paintInterval : nextPaint + paintInterval;
      }
      if (enteredModal) audio.setPaused(true);
      hudElapsed += dt;
      if (hudElapsed >= .08 || run.phase !== phase) {
        hudElapsed = 0;
        screen.hud(run);
        screen.overlay(gameVm);
      }
      if (active()) schedule();
      else last = null;
    };
    view.onResize = () => {
      game.resized = true;
      schedule();
    };
    screen.hud(run);
    schedule();
  } catch (error) {
    console.error(`Falha ao iniciar ${stageName}.`, error);
    if (vm.run !== gameVm) return;
    stopGame();
    audio.setMusic('menu');
    screen.shell('A fase não abriu', '<p>Recarregue a página em um navegador com WebGL 2 e aceleração gráfica para tentar novamente.</p>', 'menu', 'settings-shell');
  }
}

function stopGame() {
  loadingRun = null;
  if (!session) return;
  if (session.frame !== null) cancelAnimationFrame(session.frame);
  session.input.dispose();
  session.view.dispose();
  session = null;
}

vm.subscribe(render);
