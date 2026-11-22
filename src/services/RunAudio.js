import { desertSurfaceAt } from '../models/DesertLayout.js';
import { mineSurfaceAt } from '../models/MineLayout.js';
import { townSurfaceAt } from '../models/TownLayout.js';

const SURFACES = { desert: desertSurfaceAt, mine: mineSurfaceAt, town: townSurfaceAt };
const MOVEMENT_RANGE = { bat: 13, vulture: 18, giantBat: 28, giantMoth: 26, mineSkull: 12, wraith: 15, boneHound: 27 };
const GENERIC_EVENTS = { glass: 'glass', level: 'level', 'boss-down': 'bossDown' };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function spatial(listener, source, reach, volume) {
  const dx = source.x - listener.x, dz = source.z - listener.z;
  const strength = 1 - clamp(Math.hypot(dx, dz) / reach, 0, 1);
  return {
    gain: volume * strength ** 1.5,
    pan: clamp((dx - dz) * .064, -.88, .88),
    muffled: 1 - strength,
  };
}

export class RunAudio {
  constructor(play) {
    this.play = play;
    this.reset();
  }

  reset(run = null) {
    this.run = run;
    this.pending = [];
    this.contacts = new WeakMap();
    this.dives = new WeakSet();
    this.lastPlayed = new Map();
  }

  update(run) {
    if (this.run !== run) this.reset(run);
    for (const cue of run.actorCues) this.pending.push(cue);
    for (const event of run.events) {
      const sound = GENERIC_EVENTS[event];
      if (sound) this.pending.push({ action: 'interface', sound });
      else if (event === 'boss-enter' || event === 'boss-enrage') {
        const id = run.bossEncounter.bossId;
        const boss = run.enemies.find(enemy => enemy.bossId === id);
        if (boss) this.pending.push({ actor: boss, id, x: boss.x, z: boss.z, action: 'arrival', at: run.visualTime });
      }
    }
  }

  present(run, frame) {
    if (run !== this.run || !frame) return;
    const attacks = [], movement = [];
    const endFrame = run.phase === 'defeat' || run.phase === 'victory';
    for (const cue of this.pending) {
      if (cue.at !== undefined && run.visualTime - cue.at > .16) continue;
      if (cue.action === 'interface') this.play(cue.sound, { priority: 2, ui: endFrame });
      else if (cue.player && cue.action !== 'impact') this.playerCue(cue, endFrame);
      else {
        if (cue.id === 'vulture' && cue.action === 'attack') {
          if (this.dives.has(cue.actor)) continue;
          this.dives.add(cue.actor);
        }
        const distance = cue.action === 'arrival' ? 43 : cue.actor?.bossId ? 35 : 25;
        const gain = cue.action === 'hurt' ? .54 : cue.action === 'impact' ? .91 : .83;
        attacks.push({ cue, mix: spatial(frame, cue, distance, gain) });
      }
    }
    this.pending.length = 0;
    if (run.phase === 'playing') for (const contact of frame.contacts) {
      if (contact.action === 'attack') {
        if (this.dives.has(contact.actor)) continue;
        this.dives.add(contact.actor);
        attacks.push({ cue: contact, mix: spatial(frame, contact, 33, .76) });
      } else {
        if (this.contacts.get(contact.actor) === contact.index) continue;
        this.contacts.set(contact.actor, contact.index);
        if (contact.player) {
          const surface = SURFACES[run.mapId]?.(contact.x, contact.z) ?? 'trail';
          this.play(contact.id + '.step.' + surface, {
            gain: .51, pan: contact.index % 2 === 0 ? -.11 : .11, priority: 2,
          });
        } else {
          movement.push({ cue: contact, mix: spatial(frame, contact, MOVEMENT_RANGE[contact.id] ?? 15, .37) });
        }
      }
    }
    this.mixNearby(attacks, run.visualTime, 4, endFrame);
    this.mixNearby(movement, run.visualTime, 2);
  }

  playerCue(cue, tail) {
    const { action, id, angle } = cue;
    const pan = angle === undefined ? 0 : (Math.cos(angle) - Math.sin(angle)) * .16;
    this.play(cue.sound ?? id + '.' + action, {
      gain: cue.gain ?? (action === 'hurt' ? .91 : action === 'attack' ? 1 : .57),
      pan, priority: action === 'hurt' ? 5 : action === 'attack' ? 4 : 2, ui: tail,
    });
  }

  mixNearby(entries, time, limit, tail = false) {
    // Drop the quietest overlapping accents on the frame they occur.
    entries.sort((a, b) => b.mix.gain - a.mix.gain);
    for (const { cue, mix } of entries) {
      if (limit === 0 || mix.gain < .038) break;
      const sound = cue.sound ?? cue.id + '.' + cue.action;
      if ((this.lastPlayed.get(sound) ?? -Infinity) > time) continue;
      this.lastPlayed.set(sound, time + (cue.action === 'move' ? .095 : .071));
      this.play(sound, { ...mix, priority: cue.action === 'move' ? 0 : cue.actor?.bossId ? 3 : 2, ui: tail });
      limit--;
    }
  }
}
