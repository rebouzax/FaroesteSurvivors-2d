import {t} from "./I18n.js";
import clips from '../assets/audio/combat-foley.json' with { type: 'json' };
import { RunAudio } from './RunAudio.js';

const COMBAT_BANK = new URL('../assets/audio/combat-foley.wav', import.meta.url);
const MAX_VOICES = 15;
const FILES = {
  dog: new URL("../assets/audio/chupacabra.wav", import.meta.url),
  vulture: new URL("../assets/audio/vulture.wav", import.meta.url),
  whip: new URL("../assets/audio/whip.wav", import.meta.url),
  shot: new URL("../assets/audio/shot.wav", import.meta.url),
  arrow: new URL("../assets/audio/arrow.wav", import.meta.url),
  glass: new URL("../assets/audio/glass.wav", import.meta.url),
  fire: new URL("../assets/audio/fire.wav", import.meta.url),
  level: new URL("../assets/audio/level.wav", import.meta.url),
  purchase: new URL("../assets/audio/purchase.wav", import.meta.url),
  hurt: new URL("../assets/audio/hurt.wav", import.meta.url),
};
const FALLBACK = {
  'joao.attack': 'whip', 'indigo.attack': 'arrow', 'ada.attack': 'arrow',
  'dynamite.attack': 'arrow', 'dog.attack': 'dog', 'vulture.attack': 'vulture',
  throw: 'arrow', spectralCast: 'arrow', blast: 'shot',
};
const GUNSLINGERS = new Set(['maria.attack', 'rosa.attack', 'labuta.attack', 'elias.attack', 'ruth.attack']);
const MUSIC = {
  menu: new URL("../assets/audio/the-unmarked-cabin.mp3", import.meta.url),
  desert: new URL("../assets/audio/seven-black-graves.mp3", import.meta.url),
};
export const GAME_MUSIC_LOOPS = Object.freeze({ desert: { start: 5, end: 169 } });
export class AudioService {
  constructor() {
    this.enabled = true;
    this.musicEnabled = true;
    this.ctx = null;
    this.buffers = Object.create(null);
    this.track = "menu";
    this.musicSource = null;
    this.musicTracks = new Map();
    this.musicUnlocked = false;
    this.fireSource = null;
    this.active = new Map();
    this.lastTake = Object.create(null);
    this.runAudio = new RunAudio((event, options) => this.play(event, options));
    this.paused = false;
    this.disposed = false;
    this.loading = null;
    this.failures = new Map();
    this.fireActive = false;
  }
  async unlock({ retry = false } = {}) {
    if (this.disposed) return false;
    try {
      if (!this.ctx) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) throw new Error("Este navegador não oferece Web Audio.");
        this.ctx = new Context();
        const limiter = this.ctx.createDynamicsCompressor();
        limiter.threshold.value = -16;
        limiter.knee.value = 12;
        limiter.ratio.value = 4;
        limiter.attack.value = .003;
        limiter.release.value = .13;
        limiter.connect(this.ctx.destination);
        this.effectsGain = this.ctx.createGain();
        this.effectsGain.gain.value = 0.65;
        this.effectsGain.connect(limiter);
        this.uiGain = this.ctx.createGain();
        this.uiGain.gain.value = this.enabled ? 0.65 : 0;
        this.uiGain.connect(limiter);
        this.setPaused(this.paused);
        this.ctx.onstatechange = () => {
          if (!this.disposed && this.ctx.state === "running") {
            this.syncMusic();
            this.setFire(this.fireActive);
          }
        };
      }
      // Must be invoked inside the user gesture, before fetching/awaiting files.
      const resumed =
        this.ctx.state === "running" ? Promise.resolve() : this.ctx.resume();
      // Streaming music starts during the interaction; long MP3s are not decoded
      // into large in-memory AudioBuffers on phones.
      this.musicUnlocked = true;
      this.syncMusic();
      if (this.enabled && !this.loading && (!this.loadAttempted || retry)) {
        this.loadAttempted = true;
        this.loading = this.loadFiles().finally(() => {
          this.loading = null;
        });
      }
      if (this.track === 'desert') this.prepareCombat(retry);
      await resumed;
      await this.loading;
      if (this.disposed) return false;
      this.syncMusic();
      this.setFire(this.fireActive);
      return this.ctx.state === "running";
    } catch (error) {
      console.warn("Áudio indisponível nesta sessão.", error);
      return false;
    }
  }
  async loadFiles() {
    await Promise.all(Object.entries(FILES).map(([key, url]) => this.loadBuffer(key, url)));
  }
  async loadBuffer(key, url) {
    if (this.buffers[key]) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
      if (this.disposed) return;
      this.buffers[key] = buffer;
      this.failures.delete(key);
      if (key === 'fire') this.setFire(this.fireActive);
    } catch (error) {
      if (!this.disposed) {
        this.failures.set(key, error.message);
        console.warn(`Falha ao carregar áudio ${key}: ${url}`, error);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  prepareCombat(retry = false) {
    if (!this.ctx || !this.enabled || this.disposed || this.buffers.combat || this.combatLoading) return this.combatLoading;
    if (this.combatAttempted && !retry) return;
    this.combatAttempted = true;
    this.combatLoading = this.loadBuffer('combat', COMBAT_BANK).finally(() => { this.combatLoading = null; });
    return this.combatLoading;
  }
  updateRun(run) {
    if (this.enabled && !this.paused) this.runAudio.update(run);
    this.setFire(run.phase === 'playing' && (run.fires.length > 0 || run.bossHazards.length > 0));
  }
  presentRun(run, frame) {
    if (this.enabled && !this.paused) this.runAudio.present(run, frame);
  }
  async test(lang='en') {
    const running = await this.unlock({ retry: true });
    if (!running) return t(lang,'audioBlocked');
    if (!this.enabled) return t(lang,'audioDisabled');
    await this.prepareCombat(true);
    if (!this.buffers.shot && !this.buffers.combat)
      return t(lang,'audioUnavailable');
    this.play("shot", { ui: true });
    return this.failures.size
      ? t(lang,'audioPartial',{count:this.failures.size})
      : t(lang,'audioSuccess');
  }
  source(key, bus, loop = false) {
    if (
      this.disposed ||
      !this.ctx ||
      !this.buffers[key] ||
      this.ctx.state !== "running"
    )
      return null;
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffers[key];
    source.loop = loop;
    source.connect(bus);
    source.start();
    return source;
  }
  play(type, { ui = false, gain = 1, pan = 0, pitch = 1, muffled = 0, priority = 1 } = {}) {
    if (
      type === "fire" ||
      !this.enabled || this.disposed || gain < .035 || this.ctx?.state !== "running" ||
      (this.paused && !ui)
    )
      return;
    const choices = this.buffers.combat && Object.hasOwn(clips, type) && clips[type];
    const fallback = FALLBACK[type] ?? (GUNSLINGERS.has(type) ? 'shot' : type.endsWith('.hurt') ? 'hurt' : type);
    const buffer = choices ? this.buffers.combat : this.buffers[fallback];
    if (!buffer) return;
    if (this.active.size >= MAX_VOICES) {
      let disposable;
      let lowestPriority = priority;
      for (const voice of this.active.values()) {
        if (voice.priority < lowestPriority) {
          lowestPriority = voice.priority;
          disposable = voice;
        }
      }
      if (!disposable) return;
      disposable.stop(true);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const variation = choices ? .965 + Math.random() * .07 : 1;
    source.playbackRate.value = pitch * variation;
    const volume = this.ctx.createGain();
    volume.gain.value = Math.min(1.2, gain);
    const chain = [source];
    if (muffled > .15) {
      const air = this.ctx.createBiquadFilter();
      air.type = 'lowpass';
      air.frequency.value = 15000 - 12400 * Math.min(1, muffled);
      air.Q.value = .2;
      chain.push(air);
    }
    if (pan && this.ctx.createStereoPanner) {
      const balance = this.ctx.createStereoPanner();
      balance.pan.value = pan;
      chain.push(balance);
    }
    chain.push(volume);
    const bus = ui ? this.uiGain : this.effectsGain;
    for (let i = 0; i < chain.length; i++) chain[i].connect(chain[i + 1] || bus);
    const cleanup = () => {
      this.active.delete(source);
      source.onended = null;
      for (const node of chain) node.disconnect();
    };
    this.active.set(source, {
      priority: ui ? 3 : priority,
      stop: (fade = false) => {
        if (fade) {
          this.active.delete(source);
          const now = this.ctx.currentTime;
          volume.gain.setTargetAtTime(0, now, .004);
          source.stop(now + .018);
        } else {
          source.stop();
          cleanup();
        }
      },
    });
    source.onended = cleanup;
    if (choices) {
      let take = Math.floor(Math.random() * choices.length);
      if (take === this.lastTake[type] && choices.length > 1) take = (take + 1) % choices.length;
      this.lastTake[type] = take;
      source.start(0, ...choices[take]);
    } else source.start();
  }
  setMusic(track) {
    const changed = this.track !== track;
    this.track = track;
    this.syncMusic();
    if (track === 'desert') this.prepareCombat(changed);
  }
  syncMusic() {
    const desired = this.musicEnabled ? this.track : null;
    if (this.musicSource && this.playingTrack !== desired) {
      this.musicSource.pause();
      this.musicSource.currentTime = 0;
      this.musicSource = null;
      this.playingTrack = null;
    }
    if (!desired || !this.musicUnlocked || this.disposed) return;
    if (!this.musicSource && MUSIC[desired]) {
      if (!this.musicTracks.has(desired)) {
        const audio = new Audio(MUSIC[desired].href);
        audio.loop = !GAME_MUSIC_LOOPS[desired];
        audio.preload = "metadata";
        if (GAME_MUSIC_LOOPS[desired]) {
          audio.addEventListener("timeupdate", () => this.updateMusicLoop());
          audio.addEventListener("ended", () => {
            if (this.musicSource !== audio || this.disposed) return;
            audio.currentTime = GAME_MUSIC_LOOPS[desired].start;
            audio.play().catch(() => {});
          });
        }
        this.musicTracks.set(desired, audio);
      }
      this.musicSource = this.musicTracks.get(desired);
      this.playingTrack = desired;
    }
    const source = this.musicSource;
    if (!source) return;
    source.volume = this.paused ? 0.12 : 0.42;
    if (source.paused)
      source.play().catch((error) => {
        if (!this.disposed && this.musicSource === source && error.name !== "AbortError")
          console.warn("Não foi possível reproduzir a música.", error);
      });
  }
  updateMusicLoop() {
    const loop = GAME_MUSIC_LOOPS[this.playingTrack];
    if (!loop || !this.musicSource) return;
    const audio = this.musicSource;
    if (audio.currentTime >= loop.end) {
      audio.currentTime = loop.start + (audio.currentTime - loop.end) % (loop.end - loop.start);
    }
  }
  setFire(active) {
    this.fireActive = active;
    if (active && this.enabled && !this.paused && !this.fireSource)
      this.fireSource = this.source("fire", this.effectsGain, true);
    if ((!active || !this.enabled || this.paused) && this.fireSource) {
      this.fireSource.stop();
      this.fireSource.disconnect();
      this.fireSource = null;
    }
  }
  setPaused(paused) {
    this.paused = paused;
    if (this.ctx) {
      this.effectsGain.gain.setTargetAtTime(
        this.enabled && !paused ? 0.65 : 0,
        this.ctx.currentTime,
        0.05,
      );
    }
    if (this.musicSource) this.musicSource.volume = paused ? 0.12 : 0.42;
    if (paused) this.setFire(false);
  }
  setPreferences(sound, music) {
    const wasEnabled = this.enabled;
    this.enabled = sound;
    this.musicEnabled = music;
    this.setPaused(this.paused);
    if (this.ctx) this.uiGain.gain.setTargetAtTime(sound ? .65 : 0, this.ctx.currentTime, .035);
    if (!sound) this.setFire(false);
    if (sound && !wasEnabled && this.ctx) this.unlock({ retry: true });
    this.syncMusic();
  }
  stopEffects() {
    for (const voice of this.active.values()) voice.stop();
    this.runAudio.reset();
    this.setFire(false);
  }
  suspend() {
    this.ctx?.suspend().catch(() => {});
  }
  resume() {
    // Do not create a context before the first interaction.
    if (this.ctx && !this.disposed) return this.unlock();
  }
  dispose() {
    this.disposed = true;
    this.stopEffects();
    for (const audio of this.musicTracks.values()) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    if (this.ctx) this.ctx.onstatechange = null;
    this.ctx?.close().catch(() => {});
  }
}

