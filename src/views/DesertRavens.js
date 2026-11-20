import { desertRavenSites } from '../models/DesertLayout.js';

const WIDTH = 23;
const HEIGHT = 16;
const wings = [
  { back: [[11,8],[8,5],[8,0],[13,2],[17,6],[14,9]], front: [[12,9],[5,6],[1,0],[5,1],[12,5],[15,9]] },
  { back: [[11,8],[13,4],[22,3],[19,6],[15,9]], front: [[13,9],[6,9],[0,5],[6,4],[11,5],[15,8]] },
  { back: [[12,7],[16,8],[20,14],[16,12],[12,10]], front: [[13,8],[10,13],[3,15],[5,12],[6,8],[10,6]] },
  { back: [[11,8],[14,4],[21,3],[17,7],[14,9]], front: [[13,9],[7,10],[1,7],[6,5],[12,5],[15,8]] },
];

function fillPolygon(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
  ctx.closePath();
  ctx.fill();
}

export function paintRavenFrames(ctx, frames, x, y) {
  for (const [frame, shape] of wings.entries()) {
    const left = x + frame * (WIDTH + 3);
    ctx.save();
    ctx.translate(left, y);
    fillPolygon(ctx, shape.back, '#242731');
    fillPolygon(ctx, [[2,12],[5,9],[10,7],[16,6],[17,5],[20,6],[21,8],[23,9],[20,10],[15,9],[10,11],[4,13]], '#1b1e28');
    fillPolygon(ctx, shape.front, '#353743');
    ctx.fillStyle = '#4a4c58';
    ctx.fillRect(17, 6, 2, 1);
    ctx.fillStyle = '#92929b';
    ctx.fillRect(19, 7, 1, 1);
    ctx.restore();
    frames['raven' + frame] = { x: left, y, w: WIDTH, h: HEIGHT };
  }
}

export function drawDesertRavens(view, time, projectX, projectY) {
  for (const site of desertRavenSites) {
    if (!view.visible(projectX(site.x, site.z), projectY(site.x, site.z), 410)) continue;
    for (let bird = 0; bird < site.count; bird++) {
      const angle = time * .212 + site.phase + bird * .32;
      const dx = Math.cos(angle), dz = Math.sin(angle);
      const x = site.x + dx * site.rx, z = site.z + dz * site.rz + bird * 1.9;
      const altitude = 57 + bird * 7 + Math.sin(angle * 2) * 6;
      const sx = Math.round(projectX(x, z)), sy = Math.round(projectY(x, z) + altitude);
      if (!view.visible(sx, sy, 24)) continue;
      // Long glides alternate with a few asymmetric wingbeats.
      const beat = (time * 7.5 + bird * .63 + site.phase) % 12;
      const pose = beat >= 6 ? 1 : Math.floor(beat) % 4;
      const flip = projectX(-dz * site.rx, dx * site.rz) < 0;
      view.batch.sprite('raven' + pose, sx, sy, 16 + bird * 2, { flip, anchorY: .5, alpha: .91 });
    }
  }
}
