import { desertSurfaceAt } from '../models/DesertLayout.js';
import { mineSurfaceAt } from '../models/MineLayout.js';

const STEPS = { sand: 'stepSand', trail: 'stepTrail', rock: 'stepRock' };
const WEAPONS = { bow: 'arrow', crossbow: 'crossbow', knives: 'throw', rifle: 'rifle', repeater: 'rifle', shotgun: 'shotgun', sawedoff: 'shotgun' };
const ENEMY_RANGE = { bat: 12, skeleton: 15, dog: 18, vulture: 35, scorpion: 15 };
const BOSS_VOICES = new Set(['giantBat', 'fireChupacabra', 'shadowMarshal']);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function spatial(listener, source, reach, volume) {
  if (!source) return { gain: volume * .7 };
  const dx = source.x - listener.x;
  const dz = source.z - listener.z;
  const distance = Math.hypot(dx, dz);
  const strength = 1 - clamp(distance / reach, 0, 1);
  return {
    gain: volume * strength ** 1.35,
    pan: clamp((dx - dz) * .063, -.89, .89),
    muffled: 1 - strength,
  };
}

function nearestWithin(enemies, listener, radius, matches) {
  let nearest, closest = radius ** 2;
  for (const enemy of enemies) {
    if (!matches(enemy)) continue;
    const distance = (enemy.x - listener.x) ** 2 + (enemy.z - listener.z) ** 2;
    if (distance < closest) { nearest = enemy; closest = distance; }
  }
  return nearest;
}

export class RunAudio {
  constructor(play) {
    this.play = play;
    this.run = null;
  }

  update(run, dt) {
    const player = run.player;
    if (this.run !== run) {
      this.run = run;
      this.previous = { x: player.x, z: player.z };
      this.travel = 0;
      this.nextStep = .36;
      this.idle = 0;
      this.foot = 1;
      this.clock = 0;
      this.scanAt = .18;
      this.nextVoice = Object.create(null);
    }
    this.clock += dt;
    this.steps(run, dt);
    this.events(run, dt);
    if (run.phase !== 'playing' || this.clock < this.scanAt) return;
    this.scanAt = this.clock + .19;
    this.nearbyVoices(run);
  }

  steps(run, dt) {
    const { player } = run;
    const distance = Math.hypot(player.x - this.previous.x, player.z - this.previous.z);
    this.previous.x = player.x;
    this.previous.z = player.z;
    if (run.phase !== 'playing' || !player.moving || distance < .002 || distance > 1.2) {
      this.idle += dt;
      if (this.idle > .15) {
        this.travel = 0;
        this.nextStep = .36;
      }
      return;
    }
    this.idle = 0;
    this.travel += distance;
    if (this.travel < this.nextStep) return;
    this.travel -= this.nextStep;
    this.nextStep = run.characterId === 'labuta' ? 1.57 : 1.43;
    this.foot *= -1;
    const surfaceAt = { mine: mineSurfaceAt, desert: desertSurfaceAt }[run.mapId];
    const surface = surfaceAt?.(player.x, player.z) ?? 'trail';
    this.play(STEPS[surface], {
      gain: run.characterId === 'labuta' ? .32 : .26,
      pitch: run.characterId === 'labuta' ? .9 : 1,
      pan: this.foot * .13,
      priority: 0,
    });
  }

  events(run, dt) {
    const { player } = run;
    const freshPrimary = run.primaryShots.some(shot => shot.kind === run.characterId && shot.age <= dt + .0001);
    const angle = run.attack?.angle ?? 0;
    const pan = (Math.cos(angle) - Math.sin(angle)) * .13;
    let bossShot;
    let axe;
    for (const shot of run.enemyShots) {
      if (shot.age > dt + .0001) continue;
      if (shot.kind === 'axe') axe ??= shot;
      else if (run.bossEncounter.active && !shot.kind) bossShot ??= shot;
    }
    if (axe && (this.nextVoice.axe ?? 0) <= this.clock) {
      this.nextVoice.axe = this.clock + .19;
      this.play('axe', { ...spatial(player, axe, 27, .85), priority: 1 });
    }
    let attackPlayed = false;
    for (const event of run.events) {
      if (event === 'whip' || event === 'throw' || event === 'arrow') {
        const attack = event === 'arrow' ? WEAPONS[run.hero.primary] || 'arrow' : event;
        this.play(attack, { gain: attack === 'whip' ? .83 : .86, pan, priority: 2 });
        attackPlayed = true;
      } else if (event === 'shot') {
        if (bossShot) {
          const key = run.bossEncounter.bossId === 'shadowMarshal' ? 'marshalShot' : 'throw';
          this.play(key, { ...spatial(player, bossShot, 38, 1.17), priority: 3 });
          bossShot = null;
        } else {
          const attack = freshPrimary && !attackPlayed ? WEAPONS[run.hero.primary] || 'shot' : 'shot';
          this.play(attack, { gain: freshPrimary ? .93 : .73, pan, priority: 2 });
          attackPlayed = true;
        }
      } else if (event === 'enemy-charge' && (this.nextVoice.charge ?? 0) <= this.clock) {
        const source = nearestWithin(run.enemies, player, 17, enemy => enemy.type === 'dog' && enemy.charge?.warning > 0);
        if (source) {
          this.nextVoice.charge = this.clock + 1.2;
          this.nextVoice.dog = this.clock + 2.4;
          this.play('dog', { ...spatial(player, source, 27, 1.09), pitch: .9, priority: 2 });
        }
      } else if (event === 'dog' || event === 'vulture') {
        const reach = ENEMY_RANGE[event];
        if ((this.nextVoice[event] ?? 0) > this.clock) continue;
        const nearest = nearestWithin(run.enemies, player, reach, enemy => enemy.type === event);
        if (nearest) {
          this.nextVoice[event] = this.clock + (event === 'vulture' ? 4 : 6);
          this.play(event, { ...spatial(player, nearest, reach * 1.35, event === 'vulture' ? 1.25 : .92), priority: 1 });
        }
      } else if (event === 'boss-enter' || event === 'boss-enrage') {
        const id = run.bossEncounter.bossId;
        if (BOSS_VOICES.has(id)) {
          const source = run.enemies.find(enemy => enemy.bossId === id);
          this.play(id, { ...spatial(player, source, 42, 1.06), pitch: event === 'boss-enrage' ? .91 : 1, priority: 3 });
        }
      } else if (event === 'boss-down') {
        this.play('bossDown', { gain: .86, priority: 3 });
      } else if (event !== 'fire') {
        this.play(event, { priority: event === 'hurt' ? 3 : 1 });
      }
    }
    // Cards can fire a follow-up projectile without another simulation event.
    if (!attackPlayed && run.primaryShots.some(shot => shot.kind === run.characterId && shot.age === 0)) {
      this.play(WEAPONS[run.hero.primary] || 'shot', { gain: .51, pan, priority: 1 });
    }
  }

  nearbyVoices(run) {
    const player = run.player;
    let best = null;
    let score = 0;
    let voice;
    for (const enemy of run.enemies) {
      const key = enemy.treasure ? 'scorpion' : enemy.type;
      if (key !== 'bat' && key !== 'skeleton' && key !== 'scorpion') continue;
      if ((this.nextVoice[key] ?? 0) > this.clock) continue;
      const distance = (enemy.x - player.x) ** 2 + (enemy.z - player.z) ** 2;
      const closeness = 1 - distance / ENEMY_RANGE[key] ** 2;
      if (closeness > score) {
        score = closeness;
        best = enemy;
        voice = key;
      }
    }
    if (!best) return;
    this.nextVoice[voice] = this.clock + 4.5 + Math.random() * 2.1;
    this.scanAt = this.clock + .57;
    const volume = voice === 'bat' ? .55 : .67;
    this.play(voice, { ...spatial(player, best, ENEMY_RANGE[voice] * 1.35, volume), priority: 0 });
  }
}
