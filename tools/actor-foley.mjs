// [weight, heel pitch, gear ring, breath F0, first vocal formant, weapon]
const heroes = {
  joao:     [1.05, 114, 2600, 116, 530, 'whip'],
  maria:    [.76, 165, 3250, 188, 740, 'revolver'],
  labuta:   [1.36,  82, 1440,  78, 380, 'shotgun'],
  indigo:   [.70, 124,    0, 126, 462, 'bow'],
  rosa:     [.81, 183, 3480, 215, 785, 'dual'],
  ada:      [.94, 148, 1820, 160, 600, 'crossbow'],
  elias:    [1.17, 102, 2110,  97, 421, 'rifle'],
  ruth:     [1.02, 158, 2840, 196, 665, 'sawedoff'],
  dynamite: [1.15,  95, 1160, 108, 572, 'dynamite'],
  silas:    [.85,  133, 3970, 124, 498, 'knives'],
  teo:      [1.23, 117, 3170,  92, 472, 'repeater'],
};

// [movement family, body frequency, voice F0, upper formant, roughness]
const creatures = {
  bat:            ['wing', 188, 986, 4200, .47],
  dog:            ['pads', 104,  98, 1080, .77],
  vulture:        ['wing',  87, 251, 2250, .91],
  skeleton:       ['bone', 586, 109, 1670, .84],
  giantBat:       ['wing',  57, 346, 2980, .71],
  fireChupacabra: ['pads',  65,  63,  690, .99],
  shadowMarshal:  ['boot', 116, 134, 1100, .68],
  treasure:       ['shell', 940, 302, 3290, .42],
  miner:          ['boot', 106,  81,  910, .91],
  mineSpider:     ['shell', 524, 311, 2450, .63],
  mineSkull:      ['wisp',  392, 237, 1790, .73],
  blindCrawler:   ['pads', 149, 431, 2600, .75],
  treasureRat:    ['pads', 214, 568, 3100, .59],
  shovelMiner:    ['boot',  76,  62,  810, 1.20],
  giantMoth:      ['wing', 135, 174, 1260, .42],
  minerGeneral:   ['boot',  89, 103, 1450, .88],
  wraith:         ['wisp',  170, 249, 1960, .54],
  townZombie:     ['boot',  119,  69, 1250, .91],
  townGhoul:      ['pads',  202, 148, 2780, .95],
  headlessOutlaw: ['bone',  288, 125, 1920, .87],
  boneHound:      ['bone',  448,  88,  818, 1.17],
  boneSinger:     ['wisp',  327, 187, 1010, .84],
  zombieDeputy:   ['boot',   74,  57,  946, 1.11],
  treasureZombie: ['boot',  237, 303, 3180, .68],
};

const TAU = Math.PI * 2;
const shot = {
  revolver: [123, 1.25, .65, 3325, .11],
  dual: [169, 1.48, .48, 4050, .082],
  shotgun: [73, .94, 1.35, 1820, .158],
  sawedoff: [102, 1.11, 1.02, 2240, .104],
  rifle: [153, 1.65, .57, 5020, .125],
  repeater: [137, 1.52, .81, 4370, .138],
};
const bosses = new Set(['giantBat', 'fireChupacabra', 'shadowMarshal', 'shovelMiner', 'giantMoth', 'minerGeneral',
  'boneHound', 'boneSinger', 'zombieDeputy']);

function transient(s, start, body, amp, cutoff = 1060) {
  s.mode(start, .095, amp * .67, body, .025, -105);
  s.noise(start, .093, amp, 85, cutoff, .021, .0007);
}

function step(s, [weight, heel, gear], surface, take) {
  const sand = surface === 'sand', rock = surface === 'rock';
  const offset = take === 0 ? .007 : .012;
  transient(s, .001, heel + take * 9 + (rock ? 25 : 0), weight * .67, sand ? 780 : 1650);
  s.noise(.001, .11, sand ? .57 : .48, sand ? 915 : 290, rock ? 5450 : 3350, .033, .0011);
  s.noise(offset, .12, weight * .24, 425, sand ? 4200 : 2600, .036, .005);
  for (let i = 0; i < (sand ? 16 : rock ? 5 : 10); i++) {
    const moment = offset + s.random() ** 1.6 * .069;
    s.noise(moment, .012, .14 + s.random() * .25, 920 + s.random() * 2400, 8000, .0032, .0007);
  }
  if (gear) {
    s.mode(.016, .071, .055, gear + 45 * take, .016);
    s.mode(.022, .071, .039, gear * 1.38, .019);
  } else s.noise(.016, .09, .30, 325, 1500, .030, .014);
  if (rock) s.reflections([[.012, .15], [.034, .07]], 1250);
}

function discharge(s, profile, take, at = 0, level = 1) {
  const [body, crack, pressure, metal, ring] = profile;
  s.noise(at, .04, crack * level, 2000 + take * 113, 14600, .006, .00022);
  s.noise(at + .001, .074, pressure * level, 220, 3620, .019, .0006);
  transient(s, at + .001, body + 6 * take, pressure * level, 820);
  s.mode(at + .004, .114, .085 * level, metal, .018);
  s.noise(at + .044, ring, .28 * level, 57, 1050, ring * .53, .006);
  s.mode(at + .061, .038, .046 * level, metal * .53, .010);
}

function arm(s, weapon, take) {
  if (shot[weapon]) {
    discharge(s, shot[weapon], take);
    if (weapon === 'dual') discharge(s, shot.dual, 1 - take, .051, .73);
    if (weapon === 'repeater') {
      s.noise(.096, .035, .29, 560, 5500, .009, .0024);
      s.mode(.118, .055, .21, 1926 + take * 80, .015, -730);
    }
  } else if (weapon === 'knives') {
    for (const [at, gain] of [[0, 1], [.027, .72]]) {
      s.noise(at, .075, .95 * gain, 1090, 9080, .021, .0015);
      s.mode(at + .002, .083, .25 * gain, 2920 - take * 247, .021, -3400);
      s.noise(at + .014, .092, .42 * gain, 515, 3450, .041, .007);
    }
  } else if (weapon === 'whip') {
    s.noise(.0004, .038, 1.48, 1700, 14700, .006, .00016);
    s.noise(.001, .052, .68, 470, 4050, .012, .0005);
    transient(s, .001, 315 + take * 40, .24, 1700);
    s.noise(.022, .13, .36, 530, 6900, .035, .013);
  } else if (weapon === 'bow' || weapon === 'crossbow') {
    const bolt = weapon === 'crossbow';
    const pitch = (bolt ? 93 : 154) + take * 7;
    s.noise(0, .031, bolt ? .86 : .59, 740, 7400, .010, .00046);
    for (const [factor, amp] of [[1,.33],[2.16,.19],[3.21,.15],[7.6,.065]])
      s.mode(.001, .12, amp, pitch * factor, .04 / Math.sqrt(factor), -230);
    s.noise(.015, .16, .34, 995, 7480, .046, .018);
  } else {
    s.noise(0, .113, .61, 455, 7300, .037, .002);
    transient(s, .001, 156 + take * 22, .23, 850);
    s.mode(.014, .074, .18, 535, .020, 296);
    for (let i = 0; i < 8; i++) s.noise(.02 + s.random() * .13, .016, .25, 2360, 10500, .004);
  }
  s.reflections([[.031, .145], [.068, .1], [.137, .053]], weapon === 'shotgun' ? 950 : 1840);
}

function hurt(s, pitch, first, second, roughness, take, hero = false) {
  transient(s, .001, hero ? pitch * .91 : pitch * .61, .44 + roughness * .22, 1210 + roughness * 1080);
  if (pitch > 350) {
    const high = second + take * 118;
    s.layer(.002, .09, t => Math.sin(TAU * (high * t - t * t * high * 3)) * Math.exp(-t * 30) * Math.min(1, t * 900) * .5);
  } else {
    s.vocal(.003, hero ? .214 : .142, pitch + take * 7,
      [[first, 2.6, 1], [second, 4.2, .76], [second * 1.48, 6.2, .2]],
      .67, { roughness, bend: -.47, wobble: .08 });
  }
  s.noise(.016, .135, .27, hero ? 535 : 820, 5400, .047, .006);
  s.reflections([[.038, .15], [.084, .067]], hero ? 1330 : 1880);
}

function creatureMove(s, family, body, tone, take) {
  if (family === 'wing' || family === 'wisp') {
    const wisp = family === 'wisp';
    s.noise(.001, .15, .80, body * .47, tone * 1.35, .037, .0025);
    s.mode(.002, .13, .31, body + take * 6, .044, -180);
    s.noise(.014, .092, .28, tone * .50, tone * 2.9, .041, .009);
    if (wisp) s.mode(.001, .137, .15, tone * .66, .045, -1450);
  } else if (family === 'bone' || family === 'shell') {
    for (let i = 0; i < (family === 'shell' ? 3 : 2); i++) {
      const at = .001 + i * (.018 + take * .003);
      s.noise(at, .053, .63 / (i + 1), body, 9000, .009, .0005);
      s.mode(at, .064, .34 / (i + 1), body + tone * .44 + i * 106, .016);
    }
  } else {
    transient(s, .001, body + take * 9, .77, family === 'boot' ? 1420 : 1020);
    s.noise(.007, .104, .45, family === 'pads' ? 740 : 380, 3500 + body * 8, .028, .003);
    if (family === 'boot') s.mode(.014, .09, .10, tone, .028, -93);
  }
}

function creatureStrike(s, id, profile, take) {
  const [family, body, pitch, top, roughness] = profile;
  if (id === 'shadowMarshal') {
    discharge(s, [93, 1.04, 1.22, 1730, .16], take);
  } else if (id === 'zombieDeputy') {
    discharge(s, [81, 1.16, 1.28, 1950, .17], take);
  } else if (id === 'boneSinger') {
    s.noise(0, .12, .72, 335, 2410, .037, .001);
    s.vocal(.002, .20, pitch + take * 7, [[422, 3, 1], [top, 4.9, .92], [2480, 7, .25]],
      .93, { roughness, bend: -.15, wobble: .075 });
    s.mode(.003, .18, .36, 723 + take * 27, .058, -414);
  } else {
    transient(s, .001, body * .85, .52, top);
    s.noise(.001, .105, .75, Math.max(160, body * 1.2), top * 2.6, .021, .0008);
    if (family === 'bone' || id === 'shovelMiner') {
      s.mode(.003, .145, .27, id === 'skeleton' ? 1420 : 670, .041, -1150);
      s.mode(.011, .145, .16, top * 2.05, .046, -1250);
    } else {
      s.vocal(.003, .20, pitch + take * 13,
        [[Math.max(280, top * .33), 2.4, .87], [top, 4.9, .94], [top * 1.42, 6, .28]],
        .83, { roughness, bend: -.32, wobble: .12 });
    }
    s.noise(.043, .137, .45, top * .44, Math.min(15300, top * 3.2), .046, .007);
  }
  s.reflections([[.032, .19], [.097, .11]], 1770);
}

export function renderActorFoley(add) {
  for (const [id, profile] of Object.entries(heroes)) {
    const [, , , pitch, first, weapon] = profile;
    for (let take = 0; take < 2; take++) {
      for (const surface of ['sand', 'trail', 'rock'])
        add(id + '.step.' + surface, .15, .70, s => step(s, profile, surface, take));
      add(id + '.attack', .26, .88, s => arm(s, weapon, take));
      add(id + '.hurt', .24, .81, s => hurt(s, pitch, first, first * 2.39, .43, take, true));
    }
  }
  for (const [id, profile] of Object.entries(creatures)) {
    const [family, body, pitch, top, roughness] = profile;
    for (let take = 0; take < 2; take++) {
      add(id + '.move', .125, .64, s => creatureMove(s, family, body, top, take));
      add(id + '.attack', .24, .85, s => creatureStrike(s, id, profile, take));
      add(id + '.hurt', .17, .78, s => hurt(s, pitch * 1.21, top * .37, top, roughness, take));
    }
    if (bosses.has(id)) add(id + '.arrival', .57, .87, s => {
      creatureStrike(s, id, profile, 1);
      s.noise(.048, .41, .53, body * .62, top, .15, .018);
      s.mode(.039, .38, .41, Math.min(body, 121) * .77, .114, -17);
      s.reflections([[.088, .15], [.182, .10], [.267, .053]], 1770);
    });
  }
  for (let take = 0; take < 3; take++) {
    add('shot', .26, .86, s => arm(s, 'revolver', take));
    add('throw', .20, .75, s => arm(s, 'dynamite', take));
    add('spectralCast', .22, .75, s => {
      s.mode(.001, .134, .57, 710 + take * 89, .047, -2190);
      s.mode(.003, .155, .29, 1110, .036, -1835);
      s.noise(.001, .16, .41, 370, 6940, .042, .004);
      s.reflections([[.035, .17], [.09, .065]]);
    });
    add('blast', .45, .91, s => {
      s.noise(0, .092, .95, 370, 10200, .014, .00017);
      transient(s, .001, 62 + take * 6, 1.71, 770);
      s.noise(.002, .28, .68, 56, 1550, .094, .002);
      s.mode(.004, .27, .68, 84 - take * 3, .085, -43);
      for (let i = 0; i < 12; i++) s.noise(.024 + s.random() * .20, .026, .25, 550, 6700, .009);
      s.reflections([[.055, .21], [.123, .16], [.252, .08]], 1400);
    });
  }
  add('bossDown', .60, .81, s => {
    transient(s, 0, 69, .91, 1060);
    s.mode(.002, .38, .54, 62, .12, -25);
    for (let i = 0; i < 13; i++) s.noise(.016 + s.random() * .24, .044, .29, 570, 6180, .015);
    s.reflections([[.062, .18], [.134, .12], [.266, .079]], 1080);
  });
}
