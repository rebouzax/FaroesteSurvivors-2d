import {
  BufferGeometry, Color, DoubleSide, DynamicDrawUsage, InterleavedBuffer, InterleavedBufferAttribute,
  Mesh, ShaderMaterial, Uint16BufferAttribute,
} from 'three';

const MAX_QUADS = 7500;
const STRIDE = 9;
const corners = [[0, 0], [0, 1], [1, 0], [1, 1]];
const indices = new Uint16Array(MAX_QUADS * 6);
for (let i = 0; i < MAX_QUADS; i++) {
  const vertex = i * 4;
  indices.set([vertex, vertex + 1, vertex + 2, vertex + 2, vertex + 1, vertex + 3], i * 6);
}

export class SpriteBatch {
  constructor(texture, frames) {
    const { width, height } = texture.image;
    this.frames = Object.fromEntries(Object.entries(frames).map(([name, frame]) => [name, {
      ...frame,
      left: (frame.x + .06) / width, right: (frame.x + frame.w - .06) / width,
      top: 1 - (frame.y + .06) / height, bottom: 1 - (frame.y + frame.h - .06) / height,
    }]));
    this.colors = new Map();
    this.vertices = new InterleavedBuffer(new Float32Array(MAX_QUADS * 4 * STRIDE), STRIDE).setUsage(DynamicDrawUsage);
    this.geometry = new BufferGeometry();
    this.geometry.setIndex(new Uint16BufferAttribute(indices, 1));
    this.geometry.setAttribute('position', new InterleavedBufferAttribute(this.vertices, 3, 0));
    this.geometry.setAttribute('uv', new InterleavedBufferAttribute(this.vertices, 2, 3));
    this.geometry.setAttribute('ink', new InterleavedBufferAttribute(this.vertices, 4, 5));
    this.material = new ShaderMaterial({
      uniforms: { atlas: { value: texture } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
      forceSinglePass: true,
      vertexShader: `
        attribute vec4 ink;
        varying vec2 tile;
        varying vec4 tint;
        void main() {
          tile = uv;
          tint = ink;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D atlas;
        varying vec2 tile;
        varying vec4 tint;
        void main() {
          vec4 pixel = texture2D(atlas, tile);
          if (pixel.a < .42) discard;
          gl_FragColor = pixel * tint;
          #include <colorspace_fragment>
        }
      `,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.count = 0;
  }

  sprite(name, x, y, width, { height, flip = false, color = 0xffffff, alpha = 1, angle = 0, anchorY = 0, shearY = 0 } = {}) {
    const frame = this.frames[name];
    if (!frame) return;
    const h = height ?? Math.max(1, Math.round(width * frame.h / frame.w));
    this.quad(frame, x, y, width, h, angle ? Math.cos(angle) : 1, angle ? Math.sin(angle) : 0, color, alpha, flip, anchorY, shearY);
  }

  quad(frame, x, y, width, height, c, s, color, alpha, flip = false, anchorY = 0, shearY = 0) {
    if (this.count >= MAX_QUADS || alpha <= 0) return;
    let tint = this.colors.get(color);
    if (!tint) {
      tint = new Color(color);
      this.colors.set(color, tint);
    }
    const { r, g, b } = tint;
    const { left, right, top, bottom } = frame;
    const data = this.vertices.array;
    const rise = s + shearY;
    let offset = this.count * 4 * STRIDE;
    for (const [u, v] of corners) {
      const dx = (u - .5) * width, dy = (v - anchorY) * height;
      data[offset] = x + dx * c - dy * s;
      data[offset + 1] = y + dx * rise + dy * c;
      // The batch is a flat layer. Z is zero in the backing buffer.
      data[offset + 3] = Boolean(u) !== flip ? right : left;
      data[offset + 4] = v ? top : bottom;
      data[offset + 5] = r;
      data[offset + 6] = g;
      data[offset + 7] = b;
      data[offset + 8] = alpha;
      offset += STRIDE;
    }
    this.count++;
  }

  rect(x, y, w, h, color, alpha = 1) {
    this.quad(this.frames.white, x, y, w, h, 1, 0, color, alpha);
  }

  line(ax, ay, bx, by, width, color, alpha = 1) {
    const dx = bx - ax, dy = by - ay;
    const length = Math.hypot(dx, dy);
    if (!length) return;
    const c = dx / length, s = dy / length;
    this.quad(this.frames.white, (ax + bx + width * s) / 2, (ay + by - width * c) / 2,
      length + .35, width, c, s, color, alpha);
  }

  finish() {
    this.geometry.setDrawRange(0, this.count * 6);
    if (this.count) {
      this.vertices.clearUpdateRanges();
      this.vertices.addUpdateRange(0, this.count * 4 * STRIDE);
      this.vertices.needsUpdate = true;
    }
    this.count = 0;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
