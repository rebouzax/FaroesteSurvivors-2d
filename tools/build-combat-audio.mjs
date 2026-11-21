import { renderActorFoley } from './actor-foley.mjs';
import { writeFileSync } from 'node:fs';

// Render the Foley offline so playback has no synthesis cost during combat.
const SAMPLE_RATE = 32000;
const TAU = Math.PI * 2;
const GAP = 800;

function randomSource(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

class Sample {
  constructor(seconds, seed) {
    this.wave = new Float32Array(Math.round(seconds * SAMPLE_RATE));
    this.random = randomSource(seed);
  }

  layer(start, length, generator) {
    const first = Math.round(start * SAMPLE_RATE);
    const end = Math.min(this.wave.length - first, Math.round(length * SAMPLE_RATE));
    for (let i = 0; i < end; i++) this.wave[i + first] += generator(i / SAMPLE_RATE);
  }

  noise(start, length, gain, low, high, decay, rise = .004, endGain = 0) {
    let upper = 0, lower = 0;
    const upperRate = 1 - Math.exp(-TAU * high / SAMPLE_RATE);
    const lowerRate = 1 - Math.exp(-TAU * low / SAMPLE_RATE);
    this.layer(start, length, t => {
      const white = 2 * this.random() - 1;
      upper += (white - upper) * upperRate;
      lower += (white - lower) * lowerRate;
      const air = Math.min(1, t / rise) * (Math.exp(-t / decay) + endGain);
      return (upper - lower) * gain * air;
    });
  }

  mode(start, length, amp, frequency, decay, sweep = 0) {
    this.layer(start, length, t => amp * Math.min(1, t * 1150) * Math.exp(-t / decay) *
      Math.sin(TAU * (frequency * t + sweep * t * t)));
  }

  reflections(taps, cutoff = 1350) {
    const dry = this.wave.slice();
    let room = 0;
    const rate = 1 - Math.exp(-TAU * cutoff / SAMPLE_RATE);
    for (let i = 0; i < dry.length; i++) {
      room += (dry[i] - room) * rate;
      dry[i] = room;
    }
    for (const [delay, gain] of taps) {
      const offset = Math.round(delay * SAMPLE_RATE);
      for (let i = offset; i < dry.length; i++) this.wave[i] += dry[i - offset] * gain;
    }
  }

  vocal(start, length, fundamental, formants, gain, { wobble = .06, roughness = .32, bend = 0 } = {}) {
    let phase = this.random() * TAU;
    const modes = formants.map(([hz, q, mix]) => {
      const frequency = TAU * hz / SAMPLE_RATE;
      const a = Math.sin(frequency) / (2 * q);
      return { mix, a: a / (1 + a), b: 2 * Math.cos(frequency) / (1 + a), c: (1 - a) / (1 + a), x1: 0, x2: 0, y1: 0, y2: 0 };
    });
    this.layer(start, length, t => {
      const position = t / length;
      const throat = .91 + .16 * Math.sin(TAU * 23 * t) + .09 * Math.sin(TAU * 51 * t);
      const frequency = fundamental * (1 + wobble * Math.sin(TAU * 17 * t) + bend * position);
      phase += TAU * frequency / SAMPLE_RATE;
      if (phase >= TAU) phase -= TAU;
      const pulse = (Math.sin(phase) + .48 * Math.sin(2 * phase) + .23 * Math.sin(3 * phase) +
        .18 * Math.sin(5 * phase) + .1 * Math.sin(7 * phase)) * throat;
      const input = pulse + roughness * (this.random() * 2 - 1);
      let voice = pulse * .11;
      for (const mode of modes) {
        const output = mode.a * (input - mode.x2) + mode.b * mode.y1 - mode.c * mode.y2;
        mode.x2 = mode.x1; mode.x1 = input;
        mode.y2 = mode.y1; mode.y1 = output;
        voice += output * mode.mix;
      }
      const envelope = Math.min(1, t / .012) * Math.pow(1 - position, .85);
      return (voice + (input - pulse) * .09) * gain * envelope;
    });
  }

  finish(peak) {
    let max = 0;
    const end = Math.floor(.017 * SAMPLE_RATE);
    for (let i = 0; i < this.wave.length; i++) {
      const edge = Math.min(1, i / 18, (this.wave.length - i - 1) / end);
      this.wave[i] *= edge;
      max = Math.max(max, Math.abs(this.wave[i]));
    }
    for (let i = 0; i < this.wave.length; i++) this.wave[i] *= peak / max;
    return this.wave;
  }
}

const samples = [];
let seed = 18371;
function add(group, seconds, peak, render) {
  const sample = new Sample(seconds, seed += 7883);
  render(sample);
  samples.push({ group, wave: sample.finish(peak) });
}

renderActorFoley(add);

const root = new URL('../src/assets/audio/', import.meta.url);
const frames = samples.reduce((sum, sample) => sum + sample.wave.length + GAP, 0);
const wav = Buffer.alloc(44 + 2 * frames);
wav.write('RIFF', 0);
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(SAMPLE_RATE, 24);
wav.writeUInt32LE(SAMPLE_RATE * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(frames * 2, 40);
const map = {};
let offset = 0;
const dither = randomSource(971);
for (const { group, wave } of samples) {
  (map[group] ??= []).push([offset / SAMPLE_RATE, wave.length / SAMPLE_RATE]);
  for (let i = 0; i < wave.length; i++) {
    const noise = dither() - dither();
    wav.writeInt16LE(Math.round(wave[i] * 32766 + noise), 44 + 2 * (offset + i));
  }
  offset += wave.length + GAP;
}
writeFileSync(new URL('combat-foley.wav', root), wav);
writeFileSync(new URL('combat-foley.json', root), JSON.stringify(map, null, 2) + '\n');
console.log(`${samples.length} sound takes across ${Object.keys(map).length} groups, ${wav.length} bytes`);
