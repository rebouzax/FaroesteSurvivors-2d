import eclipseImage from '../assets/menu-eclipse.webp';
import './menu-backdrop.css';

const TAU = Math.PI * 2;
const COMPACT_PIXELS = 940_000;
const DESKTOP_PIXELS = 1_600_000;
const CAPE = { x: 1283, y: 484, w: 116, h: 110, fade: 13 };
// Bounds and pivots in the original menu illustration.
const GRASSES = [
  { x: 1064, y: 727, w: 155, h: 112, fade: 17, sway: 8, phase: .7 },
  { x: 886, y: 829, w: 176, h: 109, fade: 16, sway: 8, phase: 2.1 },
  { x: 1290, y: 596, w: 127, h: 78, fade: 13, sway: 6, phase: 1.2 },
  { x: 1614, y: 565, w: 58, h: 102, fade: 12, sway: 7, phase: 2.7 },
  { x: 1452, y: 826, w: 137, h: 111, fade: 15, sway: 9, phase: 3.8 },
];
const CLOUDS = [
  { x: 442, y: 0, w: 689, h: 285, fade: 54, drift: 39, period: 62, phase: .27 },
  { x: 1326, y: 0, w: 314, h: 303, fade: 35, drift: 26, period: 43, phase: .59 },
  { x: 547, y: 244, w: 507, h: 123, fade: 42, drift: 27, period: 73, phase: .4 },
];
const EYE = { x: 1514, y: 548.5 };
const DUST = Array.from({ length: 31 }, (_, id) => ({
  x: 590 + id * 193 % 1100,
  y: 580 + id * 59 % 354,
  delay: id * .271 % 1,
  speed: 2.5 + .22 * (id % 9),
  size: .75 + id % 4 * .5,
}));

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const fract = value => value - Math.floor(value);

function layer(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext('2d');
}

function patch(spec) {
  const { w, h, fade } = spec;
  const mask = layer(w, h);
  const horizontal = mask.createLinearGradient(0, 0, w, 0);
  horizontal.addColorStop(0, '#fff0');
  horizontal.addColorStop(fade / w, '#fff');
  horizontal.addColorStop(1 - fade / w, '#fff');
  horizontal.addColorStop(1, '#fff0');
  mask.fillStyle = horizontal;
  mask.fillRect(0, 0, w, h);
  const vertical = mask.createLinearGradient(0, 0, 0, h);
  vertical.addColorStop(0, '#fff0');
  vertical.addColorStop(fade / h, '#fff');
  vertical.addColorStop(1 - fade / h, '#fff');
  vertical.addColorStop(1, '#fff0');
  mask.globalCompositeOperation = 'destination-in';
  mask.fillStyle = vertical;
  mask.fillRect(0, 0, w, h);
  return { ...spec, mask: mask.canvas, paint: layer(w, h) };
}

function addMask(part) {
  const { paint, mask } = part;
  paint.globalCompositeOperation = 'destination-in';
  paint.drawImage(mask, 0, 0);
  paint.globalCompositeOperation = 'source-over';
}

function createDustVeil() {
  const mist = layer(260, 38);
  const fade = mist.createLinearGradient(0, 0, 260, 0);
  fade.addColorStop(0, '#d2a98f00');
  fade.addColorStop(.44, '#d2a98f58');
  fade.addColorStop(.7, '#a782ad34');
  fade.addColorStop(1, '#a782ad00');
  mist.fillStyle = fade;
  mist.beginPath();
  mist.moveTo(0, 23);
  mist.bezierCurveTo(78, 21, 144, -1, 260, 18);
  mist.bezierCurveTo(180, 6, 76, 41, 0, 23);
  mist.fill();
  return mist.canvas;
}

function createEyeGlow() {
  const eye = layer(22, 22);
  const glow = eye.createRadialGradient(11, 11, 0, 11, 11, 11);
  glow.addColorStop(0, '#ff563baa');
  glow.addColorStop(.31, '#d9153f61');
  glow.addColorStop(1, '#d9153f00');
  eye.fillStyle = glow;
  eye.fillRect(0, 0, 22, 22);
  return eye.canvas;
}

let sharedImage;
function loadImage() {
  sharedImage ??= new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = eclipseImage;
  }).catch(error => {
    sharedImage = undefined;
    throw error;
  });
  return sharedImage;
}

const offset = (position, gap) => {
  const value = Number.parseFloat(position);
  return Number.isFinite(value) ? position.endsWith('%') ? gap * value / 100 : value : gap * .5;
};

export class MenuBackdrop {
  constructor(canvas, dust = true) {
    this.canvas = canvas;
    this.dust = dust;
    this.context = canvas.getContext('2d', { alpha: false });
    this.motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
    this.touchLayout = matchMedia('(pointer: coarse)');
    this.time = 0;
    this.onState = () => this.resume();
    this.tick = time => this.advance(time);
    this.onContextLost = () => {
      this.contextLost = true;
      this.canvas.classList.remove('is-ready');
      cancelAnimationFrame(this.frame);
    };
    this.onContextRestored = () => {
      this.contextLost = false;
      this.resize();
      this.resume();
    };
    if (!this.context) return;
    canvas.addEventListener('contextlost', this.onContextLost);
    canvas.addEventListener('contextrestored', this.onContextRestored);
    loadImage().then(image => {
      if (this.disposed || !this.canvas.isConnected) return;
      this.image = image;
      this.cape = patch(CAPE);
      this.grass = GRASSES.map(patch);
      this.clouds = CLOUDS.map(patch);
      this.mist = this.dust ? createDustVeil() : null;
      this.eye = createEyeGlow();
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(this.canvas.parentElement);
      document.addEventListener('visibilitychange', this.onState);
      this.motionPreference.addEventListener('change', this.onState);
      this.resize();
      this.resume();
    }).catch(() => this.dispose());
  }

  resize() {
    if (!this.canvas.isConnected) {
      this.dispose();
      return;
    }
    if (!this.image || this.contextLost) return;
    const scene = this.canvas.parentElement;
    const { width, height } = scene.getBoundingClientRect();
    if (!width || !height) return;
    const { backgroundSize, backgroundPositionX, backgroundPositionY, backgroundColor } = getComputedStyle(scene);
    const [, cssHeight] = backgroundSize.trim().split(' ');
    const targetHeight = Number.parseFloat(cssHeight);
    const scale = Number.isFinite(targetHeight)
      ? (cssHeight.endsWith('%') ? height * targetHeight / 100 : targetHeight) / this.image.height
      : Math.max(width / this.image.width, height / this.image.height);
    const cssX = offset(backgroundPositionX, width - this.image.width * scale);
    const cssY = offset(backgroundPositionY, height - this.image.height * scale);
    const budget = width < 1000 || this.touchLayout.matches ? COMPACT_PIXELS : DESKTOP_PIXELS;
    const sample = Math.min(1, Math.sqrt(budget / (width * height)));
    this.canvas.width = Math.ceil(width * sample);
    this.canvas.height = Math.ceil(height * sample);
    const sampleX = this.canvas.width / width, sampleY = this.canvas.height / height;
    this.transform = [scale * sampleX, scale * sampleY, cssX * sampleX, cssY * sampleY];
    this.backgroundColor = backgroundColor;
    this.fillsViewport = cssX <= 0 && cssY <= 0 &&
      cssX + this.image.width * scale >= width && cssY + this.image.height * scale >= height;
    this.crop = [-cssX / scale, -cssY / scale, width / scale, height / scale];
    this.frameInterval = width < 650 ? 50 : 1000 / 24;
    this.draw();
  }

  visible({ x, y, w, h }) {
    const [left, top, width, height] = this.crop;
    return x + w > left && x < left + width && y + h > top && y < top + height;
  }

  resume() {
    cancelAnimationFrame(this.frame);
    this.lastFrame = undefined;
    if (this.disposed || this.contextLost || !this.image || document.hidden) return;
    if (this.motionPreference.matches) this.draw();
    else this.frame = requestAnimationFrame(this.tick);
  }

  advance(now) {
    if (!this.canvas.isConnected) {
      this.dispose();
      return;
    }
    const elapsed = this.lastFrame === undefined ? 0 : now - this.lastFrame;
    if (!elapsed || elapsed >= this.frameInterval - 1) {
      this.time += Math.min(elapsed, 110) / 1000;
      this.draw();
      this.lastFrame = now;
    }
    this.frame = requestAnimationFrame(this.tick);
  }

  draw() {
    if (!this.transform || this.contextLost) return;
    const ctx = this.context;
    const [scaleX, scaleY, x, y] = this.transform;
    ctx.globalAlpha = 1;
    if (!this.fillsViewport) {
      ctx.resetTransform();
      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    ctx.setTransform(scaleX, 0, 0, scaleY, x, y);
    // Keep the full illustration in the same opaque surface as the animated patches.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if (!this.motionPreference.matches) {
      const gust = .63 + .3 * Math.sin(this.time * 1.31) + .12 * Math.sin(this.time * 2.7 + .7);
      this.drawClouds();
      if (this.visible(this.cape)) this.drawCape(gust);
      for (const grass of this.grass) if (this.visible(grass)) this.drawGrass(grass, gust);
      if (this.dust) this.drawDust(gust);
    }
    this.drawEye();
    if (!this.canvas.classList.contains('is-ready')) this.canvas.classList.add('is-ready');
  }

  drawClouds() {
    for (const cloud of this.clouds) {
      if (!this.visible(cloud)) continue;
      const { x, y, w, h, paint, drift, period, phase } = cloud;
      const progress = fract(this.time / period + phase);
      const sourceX = clamp(x + (progress - .5) * drift * 2, 0, this.image.width - w);
      paint.clearRect(0, 0, w, h);
      paint.drawImage(this.image, sourceX, y, w, h, 0, 0, w, h);
      addMask(cloud);
      this.context.globalAlpha = .89 * Math.sin(progress * Math.PI);
      this.context.drawImage(paint.canvas, x, y);
    }
    this.context.globalAlpha = 1;
  }

  drawCape(gust) {
    const part = this.cape;
    const { x, y, w, h, paint } = part;
    paint.clearRect(0, 0, w, h);
    for (let col = 0; col < w; col += 3) {
      const strip = Math.min(3, w - col);
      const fringe = Math.pow(clamp((100 - col) / 84, 0, 1), 1.28);
      const bend = Math.sin(this.time * 4.1 + col * .062) * 7 + Math.sin(this.time * 2.4 + col * .028) * 5;
      const dy = Math.round((bend + 2) * fringe * gust);
      paint.drawImage(this.image, x + col, y - dy, strip, h, col, 0, strip, h);
    }
    addMask(part);
    this.context.drawImage(paint.canvas, x, y);
  }

  drawGrass(part, gust) {
    const { x, y, w, h, phase, sway, paint } = part;
    paint.clearRect(0, 0, w, h);
    for (let row = 0; row < h; row += 4) {
      const strip = Math.min(4, h - row);
      const bend = Math.pow(1 - row / h, 1.7) * (Math.sin(this.time * 2.9 + phase + row * .037) - .56);
      const dx = Math.round(bend * sway * gust);
      const sourceX = clamp(x - dx, 0, this.image.width - w);
      paint.drawImage(this.image, sourceX, y + row, w, strip, 0, row, w, strip);
    }
    addMask(part);
    this.context.drawImage(paint.canvas, x, y);
  }

  drawDust(gust) {
    const ctx = this.context;
    for (let i = 0; i < 4; i++) {
      const progress = fract(this.time / (8 + i * 2) + i * .269);
      ctx.globalAlpha = Math.sin(progress * Math.PI) * .56 * gust;
      ctx.drawImage(this.mist, 1590 - progress * 890 + i * 79, 618 + i * 78);
    }
    ctx.fillStyle = '#e3b091';
    for (const mote of DUST) {
      const age = fract(this.time / mote.speed + mote.delay);
      const x = mote.x - age * (177 + 76 * gust);
      const y = mote.y - age * 21 + Math.sin(age * 7 + mote.delay * TAU) * 6;
      ctx.globalAlpha = Math.sin(age * Math.PI) * .46 * gust;
      ctx.fillRect(Math.round(x), Math.round(y), mote.size, Math.max(1, mote.size * .42));
    }
    ctx.globalAlpha = 1;
  }

  drawEye() {
    const ctx = this.context;
    const blink = this.time % 8.2;
    if (blink > 7.74 && blink < 7.89 && !this.motionPreference.matches) {
      ctx.fillStyle = '#1c111d';
      ctx.fillRect(EYE.x - 1.5, EYE.y - 1, 3.5, 2.5);
      return;
    }
    ctx.globalAlpha = .79 + Math.sin(this.time * 1.84) * .17;
    ctx.drawImage(this.eye, EYE.x - 11, EYE.y - 11);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#cf243a';
    ctx.fillRect(EYE.x - 1.4, EYE.y - .9, 3.6, 2.7);
    ctx.fillStyle = '#ffad7c';
    ctx.fillRect(EYE.x - .7, EYE.y - .7, 1.5, 1.25);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
    this.canvas.classList.remove('is-ready');
    this.canvas.removeEventListener('contextlost', this.onContextLost);
    this.canvas.removeEventListener('contextrestored', this.onContextRestored);
    document.removeEventListener('visibilitychange', this.onState);
    this.motionPreference.removeEventListener('change', this.onState);
  }
}
