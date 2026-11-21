import { heroUnlocked, stageUnlocked } from '../config/campaignConfig.js';
import { PLAYABLE_STAGES } from '../config/playableStages.js';
import { GameViewModel } from './GameViewModel.js';

const PROGRESSION_PAGES = ['arsenal', 'shop', 'bestiary'];

export class AppViewModel {
  constructor(profile, audio, heroes) {
    this.profile = profile;
    this.audio = audio;
    this.heroes = heroes;
    this.selected = 'joao';
    this.mode = 'story';
    this.stageId = 'desert';
    this.page = 'menu';
    this.message = '';
    this.run = null;
  }

  subscribe(listener) {
    this.listener = listener;
    this.emit();
  }

  emit(force = false) {
    this.listener(this, force);
  }

  go(page) {
    this.message = '';
    this.page = page;
    if (page !== 'game') {
      if (this.run) {
        this.run = null;
        this.audio.stopEffects();
      }
      this.audio.setPaused(false);
      this.audio.setMusic(page === 'exit' ? null : 'menu');
    }
    this.emit();
  }

  start() {
    if (!heroUnlocked(this.profile.data, this.selected) || !stageUnlocked(this.profile.data, this.stageId)) return;
    this.run = new GameViewModel(this.profile, this.audio, { characterId: this.selected, mapId: this.stageId, mode: this.mode });
    this.audio.stopEffects();
    this.audio.setPaused(false);
    this.audio.setMusic('desert');
    this.go('game');
  }

  setting(key, value) {
    if (key === 'graphics' && ['normal', 'high'].includes(value)) this.profile.data.graphics = value;
    else if (['sound', 'music', 'wind'].includes(key) && typeof value === 'boolean') this.profile.data[key] = value;
    else return;
    this.profile.save();
    this.audio.setPreferences(this.profile.data.sound, this.profile.data.music);
    this.emit();
  }

  action(action) {
    const [command, id] = action.split(':');
    const { profile, page } = this;
    if (page === 'game') return this.gameAction(command, id);
    if (['menu', 'settings', 'exit', 'modes'].includes(command)) return this.go(command);
    if (page === 'stage' && PROGRESSION_PAGES.includes(command)) {
      if (command === 'arsenal') {
        if (!profile.data.completedRuns) return;
        profile.arsenalJustUnlocked = false;
      }
      return this.go(command);
    }
    if (PROGRESSION_PAGES.includes(page) && command === 'stage') return this.go('stage');
    if (page === 'modes' && (command === 'story' || (command === 'free' && profile.data.storyClears.desert))) {
      this.mode = command;
      return this.go('heroes');
    }
    if (page === 'heroes' && command === 'hero' && this.heroes.includes(id)) {
      this.selected = id;
      return this.emit();
    }
    if (page === 'heroes' && command === 'stage' && heroUnlocked(profile.data, this.selected)) return this.go('stage');
    if (page === 'stage' && command === 'map' && PLAYABLE_STAGES.includes(id)) {
      this.stageId = id;
      return this.emit();
    }
    if (page === 'stage' && command === 'heroes') return this.go('heroes');
    if (page === 'stage' && command === 'begin') return this.start();
    if (page === 'shop' && ((command === 'buy' && profile.buyUpgrade(id)) || (command === 'buy-card' && profile.buyBentoCard(id)))) {
      this.audio.play('purchase', { ui: true });
      return this.emit();
    }
    if (page === 'arsenal' && (command === 'deck' || command === 'forge')) {
      const changed = command === 'deck' ? profile.toggleDeck(id) : profile.forgeCard(id);
      this.message = changed ? '' : 'Confira os limites do baralho e os requisitos da carta.';
      if (changed) this.audio.play('purchase', { ui: true });
      this.emit();
    }
  }

  gameAction(command, id) {
    const vm = this.run, run = vm.model;
    if (command === 'menu') return this.go('menu');
    if (command === 'stage' && ['victory', 'defeat'].includes(run.phase)) return this.go('stage');
    if (command === 'retry' && ['victory', 'defeat'].includes(run.phase)) return this.start();
    if (command === 'ask-exit' && vm.paused) vm.confirmExit = true;
    else if (command === 'cancel-exit' || (command === 'pause' && vm.confirmExit)) vm.confirmExit = false;
    else if (command === 'pause') {
      if (run.phase === 'merchant') run.leaveMerchant();
      else vm.togglePause();
    } else if (command === 'choose' && run.chooseAbility(id)) this.audio.play('level', { ui: true });
    else if (command === 'reward' && run.chooseMissionReward(id)) this.audio.play('purchase', { ui: true });
    else if (command === 'mission-card' && run.chooseMissionCard(id)) this.audio.play('level', { ui: true });
    else if (command === 'run-buy' && run.buyRunUpgrade(id)) this.audio.play('purchase', { ui: true });
    else if (command === 'leave-merchant') run.leaveMerchant();
    else return;
    this.audio.setPaused(vm.paused || !['intro', 'playing'].includes(run.phase));
    this.emit(true);
  }

  pauseForVisibility() {
    if (!this.run || this.run.paused || !['intro', 'playing'].includes(this.run.model.phase)) return;
    this.gameAction('pause');
  }
}
