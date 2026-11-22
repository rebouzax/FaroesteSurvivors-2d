import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMineProps, MINE_SIDINGS, MINE_TRACKS, mineSurfaceAt } from '../src/models/MineLayout.js';
import { sceneryBlocksPath } from '../src/systems/EnemyNavigation.js';

test('The mine galleries leave room for bosses along the working rail routes', () => {
  const run = { props: createMineProps() };
  assert.equal(sceneryBlocksPath(run, 0, 8, 0, 20, .95), false);
  for (const route of MINE_TRACKS) {
    for (let i = 1; i < route.points.length; i++) {
      const [start, end] = route.points.slice(i - 1, i + 1);
      assert.equal(sceneryBlocksPath(run, ...start, ...end, .95), false, route.id);
      assert.equal(mineSurfaceAt((start[0] + end[0]) / 2, (start[1] + end[1]) / 2), 'trail', route.id);
    }
  }
  assert.equal(mineSurfaceAt(95, 90), 'rock');
});

test('Parked tram cars occupy their loading sidings without blocking the haulage line', () => {
  const run = { props: createMineProps() };
  for (const siding of MINE_SIDINGS) {
    const [start, end] = siding.points.slice(-2);
    assert.ok(run.props.some(prop => prop.visual === 'mineCart' && prop.z === end[1] &&
      prop.x > Math.min(start[0], end[0]) && prop.x < Math.max(start[0], end[0])));
  }
  assert.equal(sceneryBlocksPath(run, 24, -31, 55, -31, .95), false);
});
