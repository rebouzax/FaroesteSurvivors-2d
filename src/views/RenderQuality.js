const SCALES = [1, .84, .7, .58];
const WINDOW_MS = 1500;

export class RenderQuality {
  constructor({ compact = false, high = false } = {}) {
    this.level = compact && !high ? 1 : 0;
    this.reset();
  }

  get scale() {
    return SCALES[this.level];
  }

  reset() {
    this.elapsed = this.samples = this.slow = this.goodWindows = 0;
  }

  observe(ms) {
    if (ms <= 0 || ms > 250) {
      this.reset();
      return false;
    }
    this.elapsed += ms;
    this.samples++;
    if (ms > 23) this.slow++;
    if (this.elapsed < WINDOW_MS) return false;

    const previous = this.level, slowShare = this.slow / this.samples;
    if (slowShare > .31) {
      this.level = Math.min(this.level + 1, SCALES.length - 1);
      this.goodWindows = 0;
    } else if (slowShare < .08 && ++this.goodWindows >= 3) {
      this.level = Math.max(this.level - 1, 0);
      this.goodWindows = 0;
    } else if (slowShare >= .08) this.goodWindows = 0;

    this.elapsed = this.samples = this.slow = 0;
    return previous !== this.level;
  }
}

export function viewportBuffer(width, height, { high = false, scale = 1, compact = false } = {}) {
  // The camera keeps the same visible world when only raster quality changes.
  const divisor = Math.max(1, Math.min(height / 404, width / 292));
  const worldWidth = Math.round(width / divisor), worldHeight = Math.round(height / divisor);
  const budget = compact ? (high ? 440000 : 285000) : (high ? 740000 : 470000);
  const target = (high ? 1.22 : 1) * scale;
  const resolution = Math.min(target, Math.sqrt(budget / (worldWidth * worldHeight)));
  return {
    worldWidth, worldHeight,
    pixelWidth: Math.max(1, Math.round(worldWidth * resolution)),
    pixelHeight: Math.max(1, Math.round(worldHeight * resolution)),
  };
}
