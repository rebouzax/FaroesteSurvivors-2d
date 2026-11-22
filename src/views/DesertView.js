import {
  BufferGeometry, CanvasTexture, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial,
  NearestFilter, OrthographicCamera, Scene, SRGBColorSpace, WebGLRenderer,
} from 'three';
import { CONFIG } from '../config/gameConfig.js';
import { abilityStats } from '../config/abilityConfig.js';
import { horseshoePositions } from '../systems/CombatSystem.js';
import { desertDetails, desertFloor, mineFloor, townFloor } from './DesertArt.js';
import { drawDesertRavens } from './DesertRavens.js';
import { championPose } from './ChampionAnimation.js';
import { enemyPose } from './EnemyAnimation.js';
import { SpriteBatch } from './SpriteBatch.js';
import { viewportBuffer } from './RenderQuality.js';
import { actorSoundId, championReleaseAge } from '../models/ActorCues.js';

const UNIT = 7.5;
const TAU = Math.PI * 2;
const projectX = (x, z) => (x - z) * UNIT;
const projectY = (x, z) => -(x + z) * UNIT * .5;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const BATTLEFIELD_PALETTES = {
  desert: { clear: 0x1d1927, mist: 0xf4bb8b, sparks: 0xffc475 },
  mine: { clear: 0x181521, mist: 0x9589d8, sparks: 0xc7abec },
  town: { clear: 0x171923, mist: 0xc1c9f1, sparks: 0xbacfec },
};
const pixelTexture = (canvas) => {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  return texture;
};

export class DesertView {
  constructor(canvas, art, props, preferences) {
    this.canvas = canvas;
    this.preferences = preferences;
    this.stage = preferences.stageId;
    this.palette = BATTLEFIELD_PALETTES[this.stage] ?? BATTLEFIELD_PALETTES.desert;
    this.renderScale = preferences.renderScale ?? 1;
    this.scene = new Scene();
    this.scene.background = new Color(this.palette.clear);
    this.camera = new OrthographicCamera(-320, 320, 200, -200, .1, 50);
    this.camera.position.z = 5;
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.atlas = pixelTexture(art.atlas);
    const floor = this.stage === 'mine' ? mineFloor : this.stage === 'town' ? townFloor : desertFloor;
    this.floorTexture = pixelTexture(floor());
    this.batch = new SpriteBatch(this.atlas, art.frames);
    this.ground = this.createGround();
    this.scene.add(this.ground, this.batch.mesh);
    this.details = desertDetails(props, this.stage).map(detail => ({
      ...detail,
      x: Math.round(projectX(detail.x, detail.z)),
      y: Math.round(projectY(detail.x, detail.z)),
      scenery: true,
    }));
    this.enemyMotion = new WeakMap();
    this.actors = [];
    this.playerPoint = {};
    this.actorPoint = {};
    this.shotPoint = {};
    this.frameAudio = { contacts: [], x: 0, z: 0 };
    this.size = { w: 640, h: 400 };
    this.view = { x: 0, y: 0 };
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(canvas);
    this.measure();
  }

  createGround() {
    const bounds = CONFIG.mapHalf;
    const points = [-bounds, -bounds, -bounds, bounds, bounds, -bounds, bounds, bounds];
    const positions = [];
    for (let i = 0; i < points.length; i += 2) {
      positions.push(projectX(points[i], points[i + 1]), projectY(points[i], points[i + 1]), -1);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute([0, 1, 0, 0, 1, 1, 1, 0], 2));
    geometry.setIndex([0, 1, 2, 2, 1, 3]);
    return new Mesh(geometry, new MeshBasicMaterial({ map: this.floorTexture, side: DoubleSide }));
  }

  measure() {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    const { worldWidth: width, worldHeight: height, pixelWidth, pixelHeight } = viewportBuffer(w, h, {
      high: this.preferences.graphics === 'high',
      compact: this.preferences.compact,
      scale: this.renderScale,
    });
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight)
      this.renderer.setSize(pixelWidth, pixelHeight, false);
    this.size = { w: width, h: height };
    Object.assign(this.camera, { left: -width / 2, right: width / 2, top: height / 2, bottom: -height / 2 });
    this.camera.updateProjectionMatrix();
    this.onResize?.();
  }

  setRenderScale(scale) {
    if (this.renderScale === scale) return;
    this.renderScale = scale;
    this.measure();
  }

  visible(x, y, margin = 70) {
    return Math.abs(x - this.view.x) < this.size.w / 2 + margin && Math.abs(y - this.view.y) < this.size.h / 2 + margin;
  }

  ring(x, y, rx, ry, color, alpha = 1, width = 1, segments = 32, start = 0, sweep = TAU) {
    for (let i = 0; i < segments; i++) {
      const a = start + i / segments * sweep, b = start + (i + 1) / segments * sweep;
      this.batch.line(x + rx * Math.cos(a), y + ry * Math.sin(a), x + rx * Math.cos(b), y + ry * Math.sin(b), width, color, alpha);
    }
  }

  shade(x, y, width, alpha) {
    const step = Math.max(1, Math.round(width / 22));
    const bands = [.45, .79, 1, .8, .46];
    for (const [row, band] of bands.entries()) {
      this.batch.rect(x, y + (row - 3) * step, Math.round(width * band), step, 0x211922,
        alpha * (row === 2 ? .88 : .7));
    }
  }

  draw(run, dt = 0, motion, fraction = 1) {
    const p = run.player;
    const player = motion?.actor(p, fraction, this.playerPoint) ?? p;
    const frameAudio = this.frameAudio, { contacts } = frameAudio;
    contacts.length = 0;
    frameAudio.x = player.x;
    frameAudio.z = player.z;
    const clock = motion?.clock(run, fraction) ?? {
      time: run.visualTime + run.introTime, visual: run.visualTime,
      attackAge: run.attack?.age ?? 0, travel: p.travel ?? 0, hurt: run.visualTime < (p.hurtCueUntil ?? -Infinity),
    };
    const targetX = projectX(player.x, player.z);
    const playerY = projectY(player.x, player.z);
    const targetY = playerY + this.size.h * .035;
    const lerp = this.ready ? 1 - Math.exp(-dt * 12) : 1;
    this.view.x += (targetX - this.view.x) * lerp;
    this.view.y += (targetY - this.view.y) * lerp;
    this.camera.position.x = this.view.x;
    this.camera.position.y = this.view.y;
    this.ready = true;

    const { time } = clock;
    const ambient = this.preferences.wind && !this.preferences.reducedMotion;
    const actors = this.actors;
    actors.length = 0;
    const queue = (point, name, width, extra = {}) => {
      const x = projectX(point.x, point.z), y = projectY(point.x, point.z);
      if (this.visible(x, y)) actors.push({ x, y, width, name, ...extra });
    };
    for (const detail of this.details) {
      if (this.visible(detail.x, detail.y, Math.max(70, detail.width))) actors.push(detail);
    }
    for (const crate of run.crates) queue(crate, 'crate', 21, { beacon: 0xffba64 });
    if (run.merchant) queue(run.merchant, 'bento', 29, { beacon: 0xffc36d, sway: true });
    for (const enemy of run.enemies) {
      const name = actorSoundId(run, enemy);
      const point = motion?.actor(enemy, fraction, this.actorPoint) ?? enemy;
      const movement = this.trackEnemy(enemy, point, player, run.bossTelegraph);
      const x = projectX(point.x, point.z), y = projectY(point.x, point.z);
      if (!this.visible(x, y)) continue;
      const distance = Math.hypot(player.x - point.x, player.z - point.z);
      const pose = enemyPose(name, enemy, time, movement.travel, distance, enemy.bossId && run.bossTelegraph, point, clock.visual);
      if (enemy.hp > 0 && distance < 38) {
        if (pose.diveAttack) contacts.push({ actor: enemy, id: name, action: 'attack', index: -1, x: point.x, z: point.z });
        else if (pose.contact !== undefined && (pose.airborne || movement.moving))
          contacts.push({ actor: enemy, id: name, action: 'move', index: pose.contact, x: point.x, z: point.z });
      }
      const hurt = clamp(((enemy.hurtCueUntil ?? 0) - clock.visual) / .12, 0, 1);
      actors.push({ x, y, name: pose.frame, width: pose.size,
        flip: movement.flip, lift: pose.lift, anchorY: pose.anchorY, shadow: pose.shadow, enrage: enemy.phaseFlash,
        shift: (movement.flip ? 1 : -1) * hurt * Math.min(3, pose.size * .045),
        color: enemy.hitFlash > .07 ? 0xff797b : enemy.hitFlash > 0 ? 0xffb4a1 : 0xffe1cc,
        alpha: enemy.warning > 0 ? .5 : 1,
        enemy, beacon: enemy.treasure ? 0xffc860 : undefined,
      });
    }
    const echo = run.primaryEcho;
    const echoAge = echo && Math.max(0, clock.visual - echo.at);
    const echoActive = echo && echoAge < .08 && (!run.attack || run.attack.hit);
    const aimAngle = echoActive ? echo.angle : run.attack?.angle;
    const aim = aimAngle === undefined ? p.dx - p.dz : Math.cos(aimAngle) - Math.sin(aimAngle);
    if (Math.abs(aim) > .1) this.facing = aim < 0;
    const pose = championPose(run.characterId, { ...clock, moving: p.moving, attack: run.attack,
      echoAge: echoActive ? echoAge : undefined });
    if (pose.contact !== undefined)
      contacts.push({ actor: p, id: run.characterId, action: 'move', player: true, index: pose.contact, x: player.x, z: player.z });
    queue(player, pose.frame, pose.size, {
      flip: this.facing ?? false, player: true, anchorY: pose.anchorY, shadow: pose.shadow,
      shift: pose.recoil * (this.facing ? 1 : -1), color: clock.hurt ? 0xffada0 : undefined,
      alpha: p.invulnerable > 0 && Math.floor(p.invulnerable * 14) % 2 ? .77 : 1,
    });

    if (ambient) this.haze(run, time);
    this.groundEffects(run, time, player);
    for (const item of run.loot) {
      const x = Math.round(projectX(item.x, item.z)), y = Math.round(projectY(item.x, item.z));
      if (!this.visible(x, y)) continue;
      const name = item.type === 'treasureCoin' ? 'coin' : item.type;
      const bob = Math.round(Math.sin(time * 5 + item.id) * 1.5);
      this.batch.rect(x, y - 1, 7, 2, 0x21192c, .6);
      this.batch.sprite(name, x, y + bob + 1, name === 'xp' ? 6 : 8);
    }
    actors.sort((a, b) => b.y - a.y);
    for (const actor of actors) {
      const occludesPlayer = actor.occludes && Math.abs(actor.x - targetX) < actor.width * .38 &&
        actor.y < playerY && actor.y + actor.width * .76 > playerY + 9;
      this.actor(actor, time, occludesPlayer);
    }
    this.airEffects(run, clock, player, motion, fraction, echoActive ? echo : null);
    if (this.stage === 'desert' && !this.preferences.reducedMotion) drawDesertRavens(this, time, projectX, projectY);
    if (ambient) this.particles(run, time);
    this.batch.finish();
    this.renderer.render(this.scene, this.camera);
    return frameAudio;
  }

  trackEnemy(enemy, point, player, tell) {
    let motion = this.enemyMotion.get(enemy);
    if (!motion) {
      motion = { x: point.x, z: point.z, travel: 0, flip: projectX(player.x - point.x, player.z - point.z) < 0 };
      this.enemyMotion.set(enemy, motion);
    }
    const dx = point.x - motion.x, dz = point.z - motion.z;
    const distance = Math.hypot(dx, dz);
    motion.moving = distance > .001 && distance < 2;
    if (distance < 2) motion.travel += distance;
    motion.x = point.x;
    motion.z = point.z;
    const velocity = enemy.charge ?? enemy.dash ?? enemy;
    let direction = projectX(velocity.vx ?? dx, velocity.vz ?? dz);
    if (enemy.bossId && tell) direction = projectX(tell.x - enemy.x, tell.z - enemy.z);
    else if (enemy.aimTimer > 0 || enemy.throwRelease > 0) direction = projectX(enemy.aimX - enemy.x, enemy.aimZ - enemy.z);
    if (Math.abs(direction) > Math.max(.002, distance * UNIT * .15)) motion.flip = direction < 0;
    return motion;
  }

  actor(a, time, occludesPlayer) {
    const { x, y, name, width, flip } = a;
    const { batch } = this;
    const phase = time * 10;
    const bob = a.sway ? Math.sin(phase) * 1.3 : a.lift ?? 0;
    const shadow = a.shadow ?? width * .78;
    if (width >= 13) this.shade(x + (a.scenery ? 3 : 0), y, shadow, a.scenery ? .35 : a.lift ? .45 : .68);
    if (a.player) {
      this.ring(x, y, 15, 7, 0xf4bb77, .68, 1.2, 24);
      batch.rect(x, y - 10, 3, 2, 0xffd991);
    }
    if (a.beacon) {
      this.ring(x, y, width * .48, width * .19, a.beacon, .28 + (Math.sin(time * 3) + 1) * .16, 1.1, 20);
      batch.rect(x, y + width + 5 + Math.round(Math.sin(time * 4) * 2), 3, 3, a.beacon, .82);
    }
    if (a.enrage > 0) this.ring(x, y, width * .42, width * .22, 0xff5436, .8, 2, 24);
    if (name === 'campfire') {
      for (let i = 4; i > 0; i--) this.ring(x, y, i * 8, i * 4, 0xff9e44, .041 * (5 - i), 4, 18);
    }
    if (a.lamp) batch.sprite('haze', x, y + 2, 55, { height: 28, anchorY: .5, color: 0xfab46b,
      alpha: .18 + Math.sin(time * 3 + x) * .025 });
    batch.sprite(name, x + (a.shift ?? 0), y + bob, width, {
      flip, height: a.height, color: a.color, alpha: occludesPlayer ? .56 : a.alpha,
      anchorY: a.anchorY, shearY: a.shearY,
      angle: a.sway ? Math.sin(phase) * .027 : 0,
    });
    if (a.enemy?.charge?.warning > 0 || a.enemy?.aimTimer > 0) {
      batch.rect(x, y + 38, 2, 5, 0xff7062);
      batch.rect(x, y + 35, 2, 1.5, 0xffd38b);
    }
  }

  groundEffects(run, time, player) {
    const { batch } = this;
    const arena = run.bossEncounter;
    if (run.abilities.lantern || run.abilities.inferno) {
      const { radius } = abilityStats('lantern', Math.max(1, run.abilities.lantern));
      const r = radius * UNIT * Math.SQRT2;
      const x = projectX(player.x, player.z), y = projectY(player.x, player.z);
      const pulse = .24 + run.lanternTimer * .35;
      for (let i = 1; i <= 3; i++) this.ring(x, y, r * i / 3, r * i / 6, 0xdaa772, pulse * .16, 4, 36);
      this.ring(x, y, r, r / 2, 0xffcb88, pulse, 1.3, 36);
    }
    if (arena.active) {
      const x = projectX(arena.x, arena.z), y = projectY(arena.x, arena.z);
      const radius = arena.radius * UNIT * Math.SQRT2;
      this.ring(x, y, radius, radius / 2, 0x87354b, .7, 4, 96);
      this.ring(x, y, radius, radius / 2, 0xf07850, .85, 1.3, 96);
      const flames = this.renderScale < .8 ? 48 : 72;
      for (let i = 0; i < flames; i++) {
        const angle = i / flames * TAU;
        const h = 3 + (Math.sin(time * 13 + i * 3.7) + 1) * 3;
        batch.rect(x + radius * Math.cos(angle), y + radius * .5 * Math.sin(angle), 2, h, i % 3 ? 0xd45645 : 0xffa965, .69);
      }
    }
    const tell = run.bossTelegraph;
    if (tell) {
      const alpha = .58 + Math.sin(time * 19) * .26;
      const x = projectX(tell.x, tell.z), y = projectY(tell.x, tell.z);
      const sourceX = projectX(tell.fromX, tell.fromZ), sourceY = projectY(tell.fromX, tell.fromZ);
      const radius = tell.radius * UNIT * Math.SQRT2;
      this.ring(x, y, radius, radius / 2, 0xff6b51, alpha, 2);
      this.ring(x, y, radius * .8, radius * .4, 0xa62d61, alpha, 1);
      if (['dash', 'lunge', 'volley', 'crossfire', 'shotgun'].includes(tell.pattern)) {
        batch.line(sourceX, sourceY, x, y, 4, 0x9a354a, .68);
        batch.line(sourceX, sourceY, x, y, 1.2, 0xff875b, alpha);
      }
      if (tell.pattern === 'shotgun') {
        const range = Math.max(4, Math.hypot(tell.x - tell.fromX, tell.z - tell.fromZ));
        for (const spread of [-.2, .2]) {
          const angle = tell.angle + spread;
          const edgeX = sourceX + projectX(Math.cos(angle), Math.sin(angle)) * range;
          const edgeY = sourceY + projectY(Math.cos(angle), Math.sin(angle)) * range;
          batch.line(sourceX, sourceY, edgeX, edgeY, 1.15, 0xff875b, alpha * .65);
        }
      }
    }
    for (const strike of run.weather.strikes ?? []) {
      const x = projectX(strike.x, strike.z), y = projectY(strike.x, strike.z);
      if (!this.visible(x, y, 120)) continue;
      const radius = strike.radius * UNIT * Math.SQRT2;
      const progress = Math.min(1, strike.age / 1.2);
      const fade = strike.hit ? Math.max(0, 1 - (strike.age - 1.2) / .45) : 1;
      this.ring(x, y, radius, radius / 2, 0xbcaeff, .82 * fade, 1.8, 26);
      this.ring(x, y, radius * progress, radius * progress / 2, 0xebdfff, .85 * fade, 1, 24);
    }
    for (const enemy of run.enemies) {
      const charge = enemy.charge;
      if (charge?.warning > 0) {
        const x = projectX(enemy.x, enemy.z), y = projectY(enemy.x, enemy.z);
        if (!this.visible(x, y, 100)) continue;
        const dx = projectX(charge.vx, charge.vz) * charge.left;
        const dy = projectY(charge.vx, charge.vz) * charge.left;
        const alpha = Math.min(.78, .35 + (.7 - charge.warning) * .56);
        for (let dash = 0; dash < 5; dash++) {
          const a = dash * .2 + .025, b = a + .11;
          batch.line(x + dx * a, y + dy * a, x + dx * b, y + dy * b, 1.15, 0xf19662, alpha);
        }
        continue;
      }
      if (enemy.type !== 'vulture' || enemy.warning <= 0) continue;
      const x = projectX(enemy.x, enemy.z), y = projectY(enemy.x, enemy.z);
      const dx = projectX(enemy.vx, enemy.vz), dy = projectY(enemy.vx, enemy.vz);
      for (let i = 0; i < 18; i += 2) {
        const start = i * .29, end = (i + 1) * .29;
        batch.line(x + dx * start, y + dy * start, x + dx * end, y + dy * end, 2, 0xff9564, .73);
      }
    }
    for (const item of [...run.fires, ...run.bossHazards]) {
      const x = projectX(item.x, item.z), y = projectY(item.x, item.z);
      if (!this.visible(x, y)) continue;
      const r = item.radius * UNIT * Math.SQRT2;
      this.ring(x, y, r, r * .5, item.copyColor ?? 0xe17243, .8, 1.2, 25);
      for (let i = 0; i < 18; i++) {
        const t = i * 2.399963, d = r * ((i * 17 % 19) / 19);
        const h = 2 + (Math.sin(time * 15 + i) + 1) * 3;
        batch.rect(x + Math.cos(t) * d, y + Math.sin(t) * d * .5, 2.5, h, i % 3 ? 0xfd9a54 : 0xffd988, .8);
      }
    }
    for (const pulse of run.pulses) {
      const r = pulse.radius * UNIT * Math.SQRT2 * Math.min(1, pulse.age * 3 + .12);
      this.ring(projectX(pulse.x, pulse.z), projectY(pulse.x, pulse.z), r, r / 2, pulse.color ?? 0xe995fb, Math.max(0, 1 - pulse.age * 1.85), 2, 35);
    }
  }

  whipTrail(p, angle, progress, range, color) {
    const { batch } = this;
    const reach = range * (.18 + Math.sin(progress * Math.PI) * .86);
    const sweep = progress * 2.6 - 1.3;
    const glow = color ?? 0xf3834c, highlight = color ? 0xdef9d1 : 0xffd58f;
    const fade = 1 - progress * .86;
    let x = projectX(p.x, p.z), y = projectY(p.x, p.z) + 13;
    for (let i = 1; i <= 16; i++) {
      const t = i / 16;
      const direction = angle + sweep + (1 - t) * (.78 + Math.sin(t * TAU) * .25);
      const length = t * reach;
      const sx = projectX(p.x + Math.cos(direction) * length, p.z + Math.sin(direction) * length);
      const sy = projectY(p.x + Math.cos(direction) * length, p.z + Math.sin(direction) * length) + 13 - t * 5;
      batch.line(x, y, sx, sy, 3.2 - t, glow, fade * .75);
      batch.line(x, y + .6, sx, sy + .6, 1.1, highlight, fade);
      x = sx; y = sy;
    }
    if (progress > .27 && progress < .73) {
      batch.rect(x, y, 5, 1.5, highlight, fade);
      batch.rect(x, y, 1.5, 5, highlight, fade);
    }
  }

  airEffects(run, clock, p, motion, fraction, primaryEcho) {
    const { batch } = this, { time, visual, attackAge } = clock;
    if (run.abilities.horseshoe) {
      const stats = run.cardStats('horseshoe');
      for (const shoe of horseshoePositions(p, visual, stats)) {
        const x = projectX(shoe.x, shoe.z), y = projectY(shoe.x, shoe.z) + 8;
        const angle = Math.atan2(shoe.z - p.z, shoe.x - p.x);
        this.ring(x, y, 3.2, 4, 0x462a39, .92, 3.5, 9, angle, 4.9);
        this.ring(x, y + .6, 3.2, 4, 0xffca78, 1, 1.6, 9, angle, 4.9);
      }
    }
    const release = championReleaseAge(run.characterId);
    if (run.characterId === 'joao' && run.attack && attackAge > release - .05) {
      const progress = run.attack.hit ? .5 + clamp((attackAge - release) / .2, 0, 1) * .5
        : clamp((attackAge - release + .06) / .06, 0, 1) * .42;
      this.whipTrail(p, run.attack.angle, progress, run.primaryRange);
    }
    for (const echo of run.whipEchoes) this.whipTrail(echo, echo.angle, .5 + echo.age * 1.9, echo.reach, echo.color);
    const releaseAge = primaryEcho ? visual - primaryEcho.at : attackAge - release;
    if ((primaryEcho || run.attack?.hit) && run.characterId !== 'joao' && run.hero.primary !== 'dynamite' && releaseAge < .065) {
      const fade = clamp(1 - releaseAge / .065, 0, 1);
      const firearm = !['bow', 'crossbow', 'knives'].includes(run.hero.primary);
      const facing = this.facing ? -1 : 1;
      const angle = primaryEcho?.angle ?? run.attack.angle;
      const vertical = projectY(Math.cos(angle), Math.sin(angle)) / UNIT;
      const x = projectX(p.x, p.z) + facing * (run.characterId === 'labuta' || run.characterId === 'teo' ? 17 : 14);
      const y = projectY(p.x, p.z) + 23 + vertical * 3;
      batch.line(x, y, x + facing * (firearm ? 8 : 5), y + vertical * 4, firearm ? 2.9 : 1.2,
        firearm ? 0xffa14f : 0xd0dede, fade);
      batch.rect(x + facing * 2, y, firearm ? 4 : 2, 2, 0xffedbd, fade);
    }
    const shotLists = [
      [run.primaryShots, 0xffd996], [run.projectiles, 0xffc662], [run.enemyShots, 0xff6256],
      [run.silverShots, 0xbcddff], [run.ghostShots, 0x9df4e2],
    ];
    for (const [list, color] of shotLists) {
      for (const shot of list) {
        const dx = shot.vx ?? 0, dz = shot.vz ?? 0;
        const point = motion?.actor(shot, fraction, this.shotPoint) ?? shot;
        const x = projectX(point.x, point.z), y = projectY(point.x, point.z) + 11;
        if (!this.visible(x, y)) continue;
        if (shot.kind === 'axe') {
          const angle = point.age * 20, sx = Math.cos(angle), sy = Math.sin(angle);
          batch.line(x - sx * 4, y - sy * 4, x + sx * 3, y + sy * 3, 1.6, 0xb68b68);
          batch.line(x + sx * 3 - sy * 3, y + sy * 3 + sx * 3, x + sx * 3 + sy * 3, y + sy * 3 - sx * 3, 2.6, 0xffa18b);
          continue;
        }
        if (shot.kind === 'silas') {
          const roll = point.age * 30, sx = Math.cos(roll), sy = Math.sin(roll);
          batch.line(x - sx * 5, y - sy * 5, x + sx * 5, y + sy * 5, 2.5, shot.copyColor ?? 0xd9edf1);
          batch.line(x - sx * 5, y - sy * 5, x - sx * 1.65, y - sy * 1.65, 2.4, 0x936952);
          continue;
        }
        const trail = shot.copyColor ?? (shot.planted ? 0x9ecafa : shot.source === 'boneStorm' ? 0xf5dfb0 : color);
        const tip = shot.critical ? 0xffd367 : shot.copy ? 0xe5ffd8 : 0xffedc9;
        if (shot.kind === 'dynamite') {
          const lift = Math.sin(Math.PI * clamp(point.age / shot.flight, 0, 1)) * 20;
          batch.rect(x, y + lift, 5, 3, 0xbd4d3b);
          batch.rect(x - 1, y + lift + 1, 3, 2, 0xed8560);
          batch.rect(x + 4, y + lift + 3, 2, 2, tip);
          continue;
        }
        if (shot.kind === 'boomerang') {
          this.ring(x, y, 4.5, 4.5, trail, .95, 2, 7, visual * 17, 3.8);
          continue;
        }
        const wake = list === run.ghostShots ? .11 : .07;
        const tailX = projectX(dx, dz) * wake, tailY = projectY(dx, dz) * wake;
        batch.line(x - tailX, y - tailY, x, y, shot.copy ? 3.5 : 2.7, trail, .62);
        batch.line(x - tailX * .55, y - tailY * .55, x, y, 1.1, tip, .9);
        batch.rect(x, y, 2, 2, tip);
      }
    }
    for (const bottle of run.bottles) {
      const point = motion?.actor(bottle, fraction, this.shotPoint) ?? bottle;
      const ratio = Math.min(1, point.age / .65);
      const sx = bottle.fromX + (bottle.x - bottle.fromX) * ratio;
      const sz = bottle.fromZ + (bottle.z - bottle.fromZ) * ratio;
      const lift = Math.sin(ratio * Math.PI) * 25 + 5;
      const x = projectX(sx, sz), y = projectY(sx, sz) + lift;
      if (!this.visible(x, y)) continue;
      const roll = visual * 12, dx = Math.cos(roll) * 4, dy = Math.sin(roll) * 4;
      batch.line(x - dx, y - dy, x + dx, y + dy, 3, 0x426d59);
      batch.rect(x + dx, y + dy, 2.6, 2.6, bottle.copyColor ?? 0xffb259);
      batch.rect(x + dx * 1.5, y + dy * 1.5, 1.6, 1.6, 0xffffca, .8);
    }
    for (const impact of run.impacts) {
      const x = projectX(impact.x, impact.z), y = projectY(impact.x, impact.z) + 9;
      if (!this.visible(x, y)) continue;
      const fade = Math.max(0, 1 - impact.age * 2.9);
      const color = impact.color ?? this.palette.sparks;
      for (let i = 0; i < (this.renderScale < .8 ? 3 : 5); i++) {
        const a = i * TAU / 5 + impact.x;
        const r = 3 + impact.age * 41;
        const sx = Math.cos(a), sy = Math.sin(a);
        batch.line(x + sx * (r - 3), y + sy * (r - 3), x + sx * r, y + sy * r, 1.6, color, fade);
      }
    }
    for (const strike of run.weather.strikes ?? []) {
      if (!strike.hit || strike.age > 1.42) continue;
      const x = projectX(strike.x, strike.z), y = projectY(strike.x, strike.z);
      if (!this.visible(x, y, 180)) continue;
      const fade = clamp((1.42 - strike.age) / .22, 0, 1) * (this.preferences.reducedMotion ? .55 : 1);
      batch.sprite('haze', x, y, 76, { anchorY: .5, height: 38, color: 0xc7b0ff, alpha: fade * .45 });
      for (let i = 0; i < 6; i++) {
        const before = i ? Math.sin(i * 29 + strike.x) * 16 : 0;
        const next = Math.sin((i + 1) * 29 + strike.x) * 16;
        batch.line(x + before, y + i * 32, x + next, y + (i + 1) * 32, 6, 0x9173ed, fade * .72);
        batch.line(x + before, y + i * 32, x + next, y + (i + 1) * 32, 2, 0xf3eeff, fade);
      }
    }
    for (const tornado of run.tornadoes) {
      const x = projectX(tornado.x, tornado.z), y = projectY(tornado.x, tornado.z);
      if (!this.visible(x, y)) continue;
      this.ring(x, y, 18, 9, 0xd78461, .78, 1.2, 20);
      for (let i = 0; i < 7; i++) {
        const a = time * 8 - i * .85;
        this.ring(x + Math.sin(i + time) * 3, y + i * 5, 5 + i * 2.5, 2 + i * .9, 0xe8b885, .42, 2, 12, a, 4.1);
      }
    }
  }

  haze(run, time) {
    const { w, h } = this.size;
    const storm = !run.bossEncounter.active && run.weather.remaining > 0;
    const count = this.renderScale < .8 ? 4 : 8;
    for (let i = 0; i < count; i++) {
      const x = (i * 179 + time * (storm ? 20 : 4.5)) % (w + 130) - (w + 130) / 2 + this.view.x;
      const y = (i * 87.3) % h - h / 2 + this.view.y + Math.sin(time * .3 + i) * 8;
      this.batch.sprite('haze', x, y, 95 + i % 4 * 24, { height: 12 + i % 3 * 6,
        anchorY: .5, color: this.palette.mist, alpha: this.stage === 'town' ? .075 : .052 });
    }
  }

  particles(run, time) {
    const active = !run.bossEncounter.active && run.weather.remaining > 0;
    const sand = active && run.weather.kind === 'sand', rain = active && run.weather.kind === 'rain';
    const { w, h } = this.size;
    const count = Math.ceil((sand || rain ? 64 : 28) * this.renderScale);
    for (let i = 0; i < count; i++) {
      const x = (i * 89.7 + time * (sand ? 43 : rain ? 38 : 7)) % w - w / 2 + this.view.x;
      const y = h / 2 - (i * 57.9 + time * (rain ? 124 : 1.6)) % h + this.view.y;
      if (rain) this.batch.line(x - 3, y + 8 + i % 6, x, y, .85, 0xb7cee8, .3);
      else this.batch.rect(Math.round(x), Math.round(y), sand ? 3 + i % 5 : 1 + i % 3, 1,
        this.palette.mist, sand ? .28 : .19 + Math.sin(time * 1.4 + i) * .075);
    }
  }

  dispose() {
    this.resize.disconnect();
    this.ground.geometry.dispose();
    this.ground.material.dispose();
    this.batch.dispose();
    this.atlas.dispose();
    this.floorTexture.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
