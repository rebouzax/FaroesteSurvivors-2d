import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enterTouchFullscreen } from '../src/services/Fullscreen.js';
import { AppViewModel } from '../src/viewmodels/AppViewModel.js';
import { RenderQuality, viewportBuffer } from '../src/views/RenderQuality.js';

test('Progression opens only from stage selection and returns with the current hero and mode', () => {
  const calls = [];
  const audio = { setPaused() {}, setMusic(track) { calls.push(track); } };
  const profile = { data: { storyClears: { desert: true }, completedRuns: 0 } };
  const app = new AppViewModel(profile, audio, ['joao']);
  app.subscribe(() => {});
  app.action('shop');
  assert.equal(app.page, 'menu');
  app.action('modes');
  app.action('free');
  app.action('stage');
  assert.equal(app.page, 'stage');
  app.action('arsenal');
  assert.equal(app.page, 'stage');
  profile.data.completedRuns = 1;
  profile.arsenalJustUnlocked = true;
  for (const tool of ['arsenal', 'shop', 'bestiary']) {
    app.action(tool);
    assert.equal(app.page, tool);
    app.action('stage');
    assert.equal(app.page, 'stage');
    assert.equal(app.selected, 'joao');
    assert.equal(app.mode, 'free');
  }
  assert.equal(profile.arsenalJustUnlocked, false);
  assert.ok(calls.every(track => track === 'menu'));
});

test('Native fullscreen is requested on touch, with a viewport fallback and standalone support', async () => {
  const media = (touch, standalone = false) => ({
    navigator: { maxTouchPoints: Number(touch), standalone },
    matchMedia: query => ({ matches: touch && query === '(pointer: coarse)' }),
  });
  let requests = 0;
  const doc = { documentElement: { requestFullscreen: async ({ navigationUI }) => {
    requests++;
    assert.equal(navigationUI, 'hide');
  } } };
  assert.equal(await enterTouchFullscreen(media(false), doc), false);
  assert.equal(await enterTouchFullscreen(media(true, true), doc), false);
  assert.equal(await enterTouchFullscreen(media(true), doc), true);
  assert.equal(requests, 1);
  doc.documentElement.requestFullscreen = async () => { throw new Error('Denied'); };
  assert.equal(await enterTouchFullscreen(media(true), doc), false);
});

test('Render quality reduces raster cost under load and restores it after sustained stability', () => {
  const meter = new RenderQuality();
  assert.equal(meter.scale, 1);
  for (let i = 0; i < 47; i++) meter.observe(33);
  assert.equal(meter.scale, .84);
  for (let i = 0; i < 91; i++) meter.observe(16.6);
  assert.equal(meter.scale, .84);
  for (let i = 0; i < 184; i++) meter.observe(16.6);
  assert.equal(meter.scale, 1);
  meter.observe(1000);
  assert.equal(meter.scale, 1);
});

test('Changing render resolution preserves the world view in both mobile orientations', () => {
  for (const [width, height] of [[3840, 2160], [834, 1194], [390, 844], [844, 390]]) {
    const initial = viewportBuffer(width, height, { compact: true });
    const lower = viewportBuffer(width, height, { compact: true, scale: .58 });
    assert.equal(initial.worldWidth, lower.worldWidth);
    assert.equal(initial.worldHeight, lower.worldHeight);
    assert.ok(lower.pixelWidth < initial.pixelWidth);
    assert.ok(lower.pixelHeight < initial.pixelHeight);
    assert.ok(initial.pixelWidth * initial.pixelHeight <= 285500);
  }
});
