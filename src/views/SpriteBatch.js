import {
  BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Float32BufferAttribute, Mesh, ShaderMaterial,
} from 'three';

const MAX_QUADS = 7500;
const corners = [[0, 0], [0, 1], [1, 0], [1, 1]];
const indices = new Uint16Array(MAX_QUADS * 6);
for (let i = 0; i < MAX_QUADS; i++) {
  const vertex = i * 4;
  indices.set([vertex, vertex + 1, vertex + 2, vertex + 2, vertex + 1, vertex + 3], i * 6);
}

export class SpriteBatch {
  constructor(texture, frames) {
    this.frames = frames;
    this.colors = new Map();
    const positions = new Float32BufferAttribute(MAX_QUADS * 12, 3).setUsage(DynamicDrawUsage);
    const uvs = new Float32BufferAttribute(MAX_QUADS * 8, 2).setUsage(DynamicDrawUsage);
    const colors = new Float32BufferAttribute(MAX_QUADS * 16, 4).setUsage(DynamicDrawUsage);
    this.geometry = new BufferGeometry();
    this.geometry.setIndex(Array.from(indices));
    this.geometry.setAttribute('position', positions);
    this.geometry.setAttribute('uv', uvs);
    this.geometry.setAttribute('ink', colors);
    this.buffers = { positions, uvs, colors };
    this.material = new ShaderMaterial({
      uniforms: { atlas: { value: texture } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
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

  sprite(name, x, y, width, { height, flip = false, color = 0xffffff, alpha = 1, angle = 0 } = {}) {
    const frame = this.frames[name];
    if (!frame || this.count >= MAX_QUADS || alpha <= 0) return;
    const h = height ?? Math.max(1, Math.round(width * frame.h / frame.w));
    if (!this.colors.has(color)) this.colors.set(color, new Color(color));
    const { r, g, b } = this.colors.get(color);
    const c = Math.cos(angle), s = Math.sin(angle);
    const left = (frame.x + .06) / 512, right = (frame.x + frame.w - .06) / 512;
    const top = 1 - (frame.y + .06) / 256, bottom = 1 - (frame.y + frame.h - .06) / 256;
    const { positions, uvs, colors } = this.buffers;
    for (let i = 0; i < corners.length; i++) {
      const [u, v] = corners[i], dx = (u - .5) * width, dy = v * h;
      const vertex = this.count * 4 + i;
      positions.setXYZ(vertex, x + dx * c - dy * s, y + dx * s + dy * c, 0);
      uvs.setXY(vertex, Boolean(u) !== flip ? right : left, v ? top : bottom);
      colors.setXYZW(vertex, r, g, b, alpha);
    }
    this.count++;
  }

  rect(x, y, w, h, color, alpha = 1) {
    this.sprite('white', x, y, w, { height: h, color, alpha });
  }

  line(ax, ay, bx, by, width, color, alpha = 1) {
    const dx = bx - ax, dy = by - ay;
    const angle = Math.atan2(dy, dx);
    this.sprite('white', (ax + bx + width * Math.sin(angle)) / 2, (ay + by - width * Math.cos(angle)) / 2,
      Math.hypot(dx, dy) + .35, { height: width, color, alpha, angle });
  }

  finish() {
    this.geometry.setDrawRange(0, this.count * 6);
    for (const [attribute, size] of [[this.buffers.positions, 3], [this.buffers.uvs, 2], [this.buffers.colors, 4]]) {
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, this.count * 4 * size);
      attribute.needsUpdate = true;
    }
    this.count = 0;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
