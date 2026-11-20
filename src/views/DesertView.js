import {
  BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial,
  OrthographicCamera, Scene, WebGLRenderer,
} from 'three';
import { CONFIG } from '../config/gameConfig.js';
import { desertDetails, desertFloor, pixelTexture } from './DesertArt.js';
import { SpriteBatch } from './SpriteBatch.js';

const UNIT = 7.5;
const TAU = Math.PI * 2;
const projectX = (x, z) => (x - z) * UNIT;
const projectY = (x, z) => -(x + z) * UNIT * .5;
const creatureSize = { bat: 25, dog: 35, vulture: 43, skeleton: 28, giantBat: 105, fireChupacabra: 88, shadowMarshal: 51, treasure: 26 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class DesertView {
  constructor(canvas, art, props, preferences) {
    this.canvas = canvas;
    this.preferences = preferences;
    this.scene = new Scene();
    this.scene.background = new Color(0x1d1927);
    this.camera = new OrthographicCamera(-320, 320, 200, -200, .1, 50);
    this.camera.position.z = 5;
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.atlas = pixelTexture(art.atlas);
    this.floorTexture = pixelTexture(desertFloor());
    this.batch = new SpriteBatch(this.atlas, art.frames);
    this.ground = this.createGround();
    this.scene.add(this.ground, this.batch.mesh);
    this.details = desertDetails(props);
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
    const scale = Math.max(1, Math.min(h / (this.preferences.graphics === 'high' ? 510 : 404), w / 292));
    const width = Math.round(w / scale), height = Math.round(h / scale);
    this.renderer.setSize(width, height, false);
    this.size = { w: width, h: height };
    Object.assign(this.camera, { left: -width / 2, right: width / 2, top: height / 2, bottom: -height / 2 });
    this.camera.updateProjectionMatrix();
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
    const step = Math.max(1, Math.round(width / 12));
    this.batch.rect(x + 1, y - step * 2, width * .72, step, 0x211922, alpha * .76);
    this.batch.rect(x, y - step, width, step * 2, 0x211922, alpha);
    this.batch.rect(x - 1, y + step, width * .74, step, 0x211922, alpha * .8);
  }

  draw(run, dt = 0) {
    const p = run.player;
    const targetX = projectX(p.x, p.z);
    const targetY = projectY(p.x, p.z) + this.size.h * .035;
    const lerp = this.ready ? 1 - Math.exp(-dt * 12) : 1;
    this.view.x += (targetX - this.view.x) * lerp;
    this.view.y += (targetY - this.view.y) * lerp;
    this.camera.position.x = Math.round(this.view.x);
    this.camera.position.y = Math.round(this.view.y);
    this.ready = true;

    const time = run.visualTime + run.introTime;
    const ambient = this.preferences.wind && !this.preferences.reducedMotion;
    const actors = [];
    const queue = (point, name, width, extra = {}) => {
      const x = Math.round(projectX(point.x, point.z)), y = Math.round(projectY(point.x, point.z));
      if (this.visible(x, y)) actors.push({ x, y, width, name, ...extra });
    };
    for (const detail of this.details) {
      queue(detail, detail.name, detail.width, { flip: Boolean(detail.flip), scenery: true });
    }
    for (const crate of run.crates) queue(crate, 'crate', 21, { beacon: 0xffba64 });
    if (run.merchant) queue(run.merchant, 'bento', 29, { beacon: 0xffc36d, sway: true });
    for (const enemy of run.enemies) {
      const name = enemy.treasure ? 'treasure' : enemy.bossId || enemy.type;
      const flight = name === 'bat' || name === 'giantBat' || name === 'vulture';
      const vx = projectX(enemy.vx ?? p.x - enemy.x, enemy.vz ?? p.z - enemy.z);
      queue(enemy, name, creatureSize[name] ?? 30, {
        flip: vx < 0, sway: true, flight, id: enemy.id, enrage: enemy.phaseFlash,
        color: enemy.hitFlash > 0 ? 0xff797b : 0xffe1cc, alpha: enemy.warning > 0 ? .5 : 1,
        enemy, beacon: enemy.treasure ? 0xffc860 : undefined,
      });
    }
    const aim = run.attack ? Math.cos(run.attack.angle) - Math.sin(run.attack.angle) : projectX(p.dx, p.dz);
    if (Math.abs(aim) > .04) this.facing = aim < 0;
    queue(p, run.characterId, 32, {
      flip: this.facing ?? false, player: true, sway: p.moving,
      alpha: p.invulnerable > 0 && Math.floor(p.invulnerable * 15) % 2 ? .66 : 1,
    });

    this.groundEffects(run, time);
    for (const item of run.loot) {
      const x = Math.round(projectX(item.x, item.z)), y = Math.round(projectY(item.x, item.z));
      if (!this.visible(x, y)) continue;
      const name = item.type === 'treasureCoin' ? 'coin' : item.type;
      const bob = Math.round(Math.sin(time * 5 + item.id) * 1.5);
      this.batch.rect(x, y - 1, 7, 2, 0x21192c, .6);
      this.batch.sprite(name, x, y + bob + 1, name === 'xp' ? 6 : 8);
    }
    actors.sort((a, b) => b.y - a.y);
    for (const actor of actors) this.actor(actor, time, p.walkTime);
    this.airEffects(run, time);
    if (ambient) this.dust(run, time);
    this.batch.finish();
    this.renderer.render(this.scene, this.camera);
  }

  actor(a, time, walkTime) {
    const { x, y, name, width, flip } = a;
    const { batch } = this;
    const phase = time * (a.flight ? 13 : 10) + (a.id ?? 0);
    const bob = a.flight ? Math.round(7 + 4 * Math.sin(phase)) : a.sway ? Math.round(Math.sin(a.player ? walkTime * 17 : phase) * 1.3) : 0;
    if (width >= 13) this.shade(x + (a.scenery ? 3 : 0), y, width * (a.scenery ? .78 : .79), a.scenery ? .35 : .68);
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
    const height = a.flight ? Math.round(width * batch.frames[name].h / batch.frames[name].w * (.92 + .15 * Math.sin(phase))) : undefined;
    batch.sprite(name, x, y + bob, width, { flip, height, color: a.color, alpha: a.alpha, angle: a.sway && !a.flight ? Math.sin(phase) * .027 : 0 });
    if (a.enemy?.chargeWarning > 0 || a.enemy?.throwWindup > 0) {
      batch.rect(x, y + 31, 2, 5, 0xff7062);
      batch.rect(x, y + 28, 2, 1.5, 0xffd38b);
    }
  }

  groundEffects(run, time) {
    const { batch } = this;
    const arena = run.bossEncounter;
    if (arena.active) {
      const x = projectX(arena.x, arena.z), y = projectY(arena.x, arena.z);
      const radius = arena.radius * UNIT * Math.SQRT2;
      this.ring(x, y, radius, radius / 2, 0x87354b, .7, 4, 96);
      this.ring(x, y, radius, radius / 2, 0xf07850, .85, 1.3, 96);
      for (let i = 0; i < 96; i++) {
        const angle = i / 96 * TAU;
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
      if (['dash', 'lunge', 'volley', 'crossfire'].includes(tell.pattern)) {
        batch.line(sourceX, sourceY, x, y, 4, 0x9a354a, .68);
        batch.line(sourceX, sourceY, x, y, 1.2, 0xff875b, alpha);
      }
    }
    for (const item of [...run.fires, ...run.bossHazards]) {
      const x = projectX(item.x, item.z), y = projectY(item.x, item.z);
      if (!this.visible(x, y)) continue;
      const r = item.radius * UNIT * Math.SQRT2;
      this.ring(x, y, r, r * .5, 0xe17243, .8, 1.2, 25);
      for (let i = 0; i < 18; i++) {
        const t = i * 2.399963, d = r * ((i * 17 % 19) / 19);
        const h = 2 + (Math.sin(time * 15 + i) + 1) * 3;
        batch.rect(x + Math.cos(t) * d, y + Math.sin(t) * d * .5, 2.5, h, i % 3 ? 0xfd9a54 : 0xffd988, .8);
      }
    }
    for (const pulse of run.pulses) {
      const r = pulse.radius * UNIT * Math.SQRT2 * Math.min(1, pulse.age * 3 + .12);
      this.ring(projectX(pulse.x, pulse.z), projectY(pulse.x, pulse.z), r, r / 2, 0xe995fb, Math.max(0, 1 - pulse.age * 1.85), 2, 35);
    }
  }

  airEffects(run, time) {
    const { batch } = this, p = run.player;
    if (run.characterId === 'joao' && run.attack?.age > .13) {
      const attack = run.attack, progress = clamp((attack.age - .12) / .26, 0, 1);
      const reach = CONFIG.whipRange * Math.sin(progress * Math.PI) * .74 + 1;
      const start = attack.angle - 1.12, sweep = 2.24;
      let x = projectX(p.x, p.z), y = projectY(p.x, p.z) + 13;
      for (let i = 1; i <= 16; i++) {
        const t = i / 16, a = start + t * sweep * Math.min(1, progress * 1.8);
        const r = reach * Math.sin(t * Math.PI * .67);
        const sx = projectX(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r);
        const sy = projectY(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r) + 12 - t * 3;
        batch.line(x, y, sx, sy, 3, 0xbb6340, 1 - progress * .74);
        batch.line(x, y + 1, sx, sy + 1, 1.2, 0xffd58f, 1 - progress * .65);
        x = sx; y = sy;
      }
    }
    const shotLists = [
      [run.primaryShots, 0xffd996], [run.projectiles, 0xffc662], [run.enemyShots, 0xff6256],
      [run.silverShots, 0xbcddff], [run.ghostShots, 0x9df4e2],
    ];
    for (const [list, color] of shotLists) {
      for (const shot of list) {
        const dx = shot.vx ?? 0, dz = shot.vz ?? 0;
        const x = projectX(shot.x, shot.z), y = projectY(shot.x, shot.z) + 11;
        if (!this.visible(x, y)) continue;
        batch.line(x - projectX(dx, dz) * .055, y - projectY(dx, dz) * .055, x, y, 2.2, color, .83);
        batch.rect(x, y, 2, 2, 0xffedc9);
      }
    }
    for (const bottle of run.bottles) {
      const ratio = Math.min(1, bottle.age / .65);
      const sx = bottle.fromX + (bottle.x - bottle.fromX) * ratio;
      const sz = bottle.fromZ + (bottle.z - bottle.fromZ) * ratio;
      const lift = Math.sin(ratio * Math.PI) * 25 + 5;
      batch.rect(projectX(sx, sz), projectY(sx, sz) + lift, 3, 6, 0xff9044);
    }
    for (const impact of run.impacts) {
      const x = projectX(impact.x, impact.z), y = projectY(impact.x, impact.z) + 9;
      if (!this.visible(x, y)) continue;
      for (let i = 0; i < 5; i++) {
        const a = i * TAU / 5 + impact.x;
        const r = 3 + impact.age * 41;
        batch.rect(x + Math.cos(a) * r, y + Math.sin(a) * r, 2, 2, 0xffc475, 1 - impact.age * 2.9);
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

  dust(run, time) {
    const sand = run.weather.kind === 'sand' && run.weather.remaining > 0;
    const { w, h } = this.size;
    for (let i = 0; i < (sand ? 70 : 27); i++) {
      const x = (i * 89.7 + time * (sand ? 43 : 7)) % w - w / 2 + this.view.x;
      const y = (i * 57.9 + time * 1.6) % h - h / 2 + this.view.y;
      this.batch.rect(Math.round(x), Math.round(y), sand ? 3 + i % 5 : 1 + i % 3, 1, 0xffcc99, sand ? .26 : .24);
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
  }
}
