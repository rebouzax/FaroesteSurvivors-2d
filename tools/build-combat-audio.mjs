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

for (const surface of ['Sand', 'Trail', 'Rock']) {
  const hard = surface !== 'Sand';
  const rock = surface === 'Rock';
  for (let take = 0; take < 6; take++) {
    add('step' + surface, .23 + take % 3 * .014, .68 + take % 3 * .04, s => {
      const rand = s.random;
      const weight = .9 + .27 * rand();
      s.mode(.007, .084, .27 * weight, (rock ? 147 : hard ? 126 : 103) + rand() * 23, .023, -142);
      s.mode(.012, .108, .05 * weight, 203 + rand() * 35, .025, -198);
      s.noise(.002, .073, hard ? .45 : .32, 170, 1250, .025, .006);
      s.noise(.017, .132, hard ? .24 : .48, hard ? 580 : 1100, 3800, .039, .011);
      s.noise(.076, .097, .14, 390, 2500, .024, .012);
      for (let grain = 0; grain < (rock ? 15 : hard ? 24 : 43); grain++) {
        const moment = .015 + Math.pow(rand(), 1.7) * .13;
        s.noise(moment, .009 + rand() * .012, .05 + rand() * .11, 750 + rand() * 1900, 5900 + rand() * 2100, .0027);
      }
      s.mode(.041 + rand() * .027, .05, .017, 2800 + rand() * 390, .011, -420);
      if (rock) {
        s.mode(.012, .095, .12, 714 + rand() * 470, .031, -200);
        s.mode(.03, .061, .078, 1790 + rand() * 230, .016);
        s.reflections([[.011, .09], [.027, .07]], 1220);
      }
    });
  }
}

for (let take = 0; take < 4; take++) {
  add('whip', .37, .91, s => {
    s.noise(.004, .071, .39, 350, 2200, .038, .029);
    s.noise(.032, .065, .65, 1300, 9000, .033, .034);
    s.noise(.071, .047, 1.15, 2000, 14700, .006, .00025);
    s.noise(.071, .056, .57, 550, 4200, .011, .00035);
    s.mode(.071, .091, .19, 290 + take * 16, .024, -520);
    s.noise(.085, .116, .29, 230, 1950, .046, .012);
    s.reflections([[.026, .15], [.074, .13], [.143, .078], [.213, .038]], 1850);
  });
}

const gun = {
  shot: { low: 119, body: 1.02, crack: 1.28, tail: .39, duration: .47 },
  shotgun: { low: 83, body: 1.36, crack: .86, tail: .57, duration: .63 },
  rifle: { low: 148, body: .98, crack: 1.39, tail: .46, duration: .54 },
  marshalShot: { low: 94, body: 1.24, crack: 1.13, tail: .54, duration: .61 },
};
for (const [event, design] of Object.entries(gun)) {
  for (let take = 0; take < (event === 'shot' ? 4 : 2); take++) {
    add(event, design.duration, event === 'marshalShot' ? .84 : .91, s => {
      const n = s.random();
      s.noise(0, .051, design.crack, 2300 + n * 330, 15000, .009, .0002);
      s.noise(.001, .129, design.body, 210, 4020, .024, .0007);
      s.noise(.004, .18, design.tail, 48, 860, .063, .002);
      s.mode(.002, .14, .44 * design.body, design.low * (1 + n * .12), .035, -208);
      s.mode(.008, .125, .15, 275 + n * 35, .032, -480);
      s.noise(.091 + n * .025, .022, .18, 1730, 7600, .008, .0014);
      s.mode(.109 + n * .019, .056, .08, 1645 + n * 200, .015);
      s.reflections([[.024, .18], [.064 + n * .008, .17], [.129, .12], [.219, .068], [.328, .026]], event === 'shotgun' ? 930 : 1550);
    });
  }
}

for (const crossbow of [false, true]) {
  for (let take = 0; take < 3; take++) {
    add(crossbow ? 'crossbow' : 'arrow', .35, .79, s => {
      const stiffness = crossbow ? 1.19 : .91;
      s.noise(0, .038, crossbow ? .55 : .29, 935, 8600, .012, .0005);
      s.noise(.005, .077, .29, 135, 1227, .028, .0022);
      for (const [frequency, amplitude, decay] of [[118, .23, .043], [233, .13, .046], [389, .16, .028], [732, .075, .026], [1810, .068, .017]]) {
        s.mode(.003, .135, amplitude, (frequency + take * 2.7) * stiffness, decay, -430);
      }
      s.noise(.039, .179, .42, 1180, 7310, .063, .025);
      s.reflections([[.046, .11], [.12, .066]]);
    });
  }
}

for (let take = 0; take < 3; take++) {
  add('throw', .36, .65, s => {
    s.noise(.008, .091, .42, 430, 3240, .043, .021);
    s.noise(.051, .151, .45, 950, 7650, .046, .035);
    s.mode(.042, .123, .116, 1350 + take * 120, .037, -2150);
    s.reflections([[.057, .10], [.116, .046]]);
  });
  add('axe', .43, .74, s => {
    s.noise(.001, .06, .37, 180, 1450, .025, .004);
    s.noise(.033, .19, .57, 510, 6640, .073, .044);
    s.mode(.021, .28, .128, 1093 + take * 99, .072, -1830);
    s.mode(.048, .2, .07, 2028, .05, -4490);
    s.noise(.113, .077, .18, 1060, 4200, .027, .018);
    s.reflections([[.057, .115], [.146, .066]]);
  });
  add('dog', .7, .87, s => {
    s.noise(.007, .32, .44, 85, 1410, .135, .03);
    s.vocal(.034, .22, 76 + 9 * take, [[284, 2, 1.15], [685, 3.4, .84], [1290, 6, .60]], .82, { roughness: .55, bend: -.15 });
    s.vocal(.242, .18, 109 - 6 * take, [[465, 3, 1.1], [968, 3.8, .96], [1510, 4.5, .58]], 1, { roughness: .48, bend: -.38 });
    s.noise(.302, .20, .39, 165, 4080, .068, .013);
    s.reflections([[.056, .13], [.121, .087], [.251, .045]], 1070);
  });
  add('bat', .52, .70, s => {
    for (let i = 0; i < 3; i++) {
      const delay = .026 + i * .079 + s.random() * .016;
      const length = .049 + s.random() * .026;
      const note = 3650 + s.random() * 830;
      s.layer(delay, length, t => .36 * Math.sin(Math.PI * t / length) ** 1.2 *
        Math.sin(TAU * (note * t - 15150 * t * t) + .66 * Math.sin(t * TAU * 970)));
      s.noise(delay, length, .39, 2900, 9300, .033, .007);
    }
    s.noise(.013, .27, .15, 245, 1120, .097, .021);
    s.noise(.083, .14, .25, 630, 3200, .048, .018);
    s.reflections([[.051, .14], [.127, .08]], 2730);
  });
  add('skeleton', .56, .73, s => {
    for (let i = 0; i < 7; i++) {
      const start = .021 + i * .04 + s.random() * .022;
      s.noise(start, .041, .4 - i * .038, 750, 5960, .011, .0011);
      for (const frequency of [820, 1710, 2760]) {
        s.mode(start, .052, (.14 - i * .011) * s.random(), frequency + s.random() * 140, .015);
      }
    }
    s.vocal(.037, .21, 77 + take * 6, [[430, 5, 1], [1130, 6, .46]], .31, { roughness: .68, bend: -.34 });
    s.reflections([[.059, .15], [.118, .072]]);
  });
  add('vulture', .87, .84, s => {
    s.noise(.008, .32, .47, 180, 3460, .119, .059);
    s.noise(.097, .26, .41, 100, 2050, .10, .051);
    s.vocal(.108, .30, 174 - take * 8, [[785, 4.8, 1.2], [1790, 5.2, .78], [2680, 7, .42]], 1.17, { roughness: .85, wobble: .12, bend: -.4 });
    s.vocal(.344, .21, 154 + take * 6, [[615, 3.6, .85], [1500, 5, .85], [2350, 7, .59]], .8, { roughness: .95, wobble: .12, bend: -.25 });
    s.reflections([[.071, .17], [.145, .13], [.267, .064]], 1840);
  });
  add('scorpion', .49, .62, s => {
    for (let i = 0; i < 6; i++) {
      const onset = .012 + i * .043 + s.random() * .023;
      s.noise(onset, .06, .43, 800 + i * 210, 8500, .013, .0023);
      s.mode(onset, .066, .09, 905 + i * 132, .019);
    }
    s.noise(.012, .145, .16, 330, 2100, .052, .02);
    s.reflections([[.053, .1], [.108, .044]]);
  });
}

add('giantBat', 1.22, .91, s => {
  s.noise(.017, .67, .49, 125, 1718, .296, .131);
  s.noise(.074, .51, .62, 1370, 6000, .258, .092);
  s.vocal(.084, .56, 272, [[850, 4.8, 1.35], [2095, 6.3, 1], [3450, 7, .67]], 1.1, { roughness: .53, wobble: .19, bend: -.50 });
  s.vocal(.187, .44, 77, [[269, 4.6, 1.1], [540, 6, .52]], .61, { roughness: .52, bend: -.24 });
  s.mode(.19, .48, .38, 83, .163, -39);
  s.reflections([[.075, .18], [.16, .14], [.272, .074], [.393, .04]], 1420);
});
add('fireChupacabra', 1.29, .91, s => {
  s.noise(.003, .89, .64, 46, 1830, .32, .1);
  s.vocal(.075, .41, 60, [[247, 3, 1.19], [475, 4.1, .75], [980, 5, .54]], .99, { roughness: .73, wobble: .15, bend: .26 });
  s.vocal(.434, .44, 100, [[368, 4, 1.32], [874, 5.3, .96], [1312, 5.7, .7]], 1.1, { roughness: .8, wobble: .11, bend: -.55 });
  s.mode(.442, .41, .38, 68, .156, -26);
  for (let i = 0; i < 27; i++) s.noise(.23 + s.random() * .65, .026, .22, 531, 7550, .009, .0006);
  s.reflections([[.058, .17], [.171, .12], [.274, .08], [.39, .044]], 1105);
});
add('shadowMarshal', 1.16, .85, s => {
  s.noise(.012, .66, .68, 225, 1815, .34, .105);
  s.vocal(.087, .46, 83, [[398, 5, .79], [855, 6.3, .73], [1663, 7, .69]], .92, { roughness: .56, wobble: .11, bend: -.34 });
  for (const [delay, frequency] of [[.307, 1740], [.478, 2113], [.527, 1429]]) {
    s.noise(delay, .081, .43, 1170, 9200, .025, .0012);
    s.mode(delay, .21, .16, frequency, .057, -88);
    s.mode(delay, .22, .068, frequency * 1.63, .052);
  }
  s.mode(.102, .67, .18, 78, .32, -21);
  s.reflections([[.081, .16], [.166, .12], [.279, .07], [.36, .048]], 1380);
});
add('bossDown', .98, .79, s => {
  s.noise(.003, .44, .52, 58, 1580, .132, .009);
  s.mode(.001, .6, .71, 77, .18, -43);
  s.mode(.014, .46, .29, 152, .143, -93);
  for (let i = 0; i < 19; i++) {
    s.noise(.02 + s.random() * .31, .05, .14, 650, 6500, .015);
  }
  s.reflections([[.058, .19], [.151, .125], [.257, .08], [.366, .048]], 1040);
});

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
