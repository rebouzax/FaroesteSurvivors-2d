import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enterTouchFullscreen, fullscreenState, toggleFullscreen } from '../src/services/Fullscreen.js';
import { AppViewModel } from '../src/viewmodels/AppViewModel.js';
import { RenderQuality, viewportBuffer } from '../src/views/RenderQuality.js';
import { menuPage, menuPageSize } from '../src/views/MenuPagination.js';

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

test('The settings command enters and exits native fullscreen and handles unsupported browsers', async () => {
  const surface = { navigator: {}, matchMedia: () => ({ matches: false }) };
  const doc = { documentElement: {} };
  assert.equal(fullscreenState(surface, doc), 'unsupported');
  assert.equal(await toggleFullscreen(surface, doc), 'unsupported');
  const root = doc.documentElement;
  root.webkitRequestFullscreen = () => { doc.webkitFullscreenElement = root; };
  doc.webkitExitFullscreen = () => { doc.webkitFullscreenElement = null; };
  assert.equal(await toggleFullscreen(surface, doc), 'active');
  assert.equal(fullscreenState(surface, doc), 'active');
  assert.equal(await toggleFullscreen(surface, doc), 'available');
  root.requestFullscreen = () => Promise.reject(new Error('User activation required'));
  assert.equal(await toggleFullscreen(surface, doc), 'denied');
  surface.navigator.standalone = true;
  assert.equal(await toggleFullscreen(surface, doc), 'standalone');
});

test('Catalogs keep the previous item in view when rotating and clamp to the last page', () => {
  const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  assert.equal(menuPageSize(320), 1);
  assert.equal(menuPageSize(600), 2);
  assert.equal(menuPageSize(800), 3);
  assert.equal(menuPageSize(1024), 4);
  assert.deepEqual(menuPage(rows, 4, 1), { items: ['e'], index: 4, pages: 7 });
  assert.deepEqual(menuPage(rows, 4, 3), { items: ['d', 'e', 'f'], index: 1, pages: 3 });
  assert.deepEqual(menuPage(rows.slice(0, 3), 9, 2), { items: ['c'], index: 1, pages: 2 });
  assert.deepEqual(menuPage([], 1, 4), { items: [], index: 0, pages: 1 });
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
