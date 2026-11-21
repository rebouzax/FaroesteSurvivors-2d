export function usesTouchLayout(surface = window) {
  return surface.matchMedia('(pointer: coarse)').matches ||
    (surface.navigator.maxTouchPoints > 0 && surface.matchMedia('(hover: none)').matches);
}

export function fullscreenState(surface = window, doc = document) {
  if (doc.fullscreenElement || doc.webkitFullscreenElement) return 'active';
  if (surface.navigator.standalone || surface.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches) return 'standalone';
  const target = doc.documentElement;
  return (target.requestFullscreen && doc.fullscreenEnabled !== false) ||
    (target.webkitRequestFullscreen && doc.webkitFullscreenEnabled !== false) ? 'available' : 'unsupported';
}

async function requestFullscreen(doc) {
  const target = doc.documentElement;
  if (target.requestFullscreen && doc.fullscreenEnabled !== false) {
    await target.requestFullscreen({ navigationUI: 'hide' });
  } else {
    await target.webkitRequestFullscreen();
  }
}

export async function toggleFullscreen(surface = window, doc = document) {
  const state = fullscreenState(surface, doc);
  if (state !== 'available' && state !== 'active') return state;
  try {
    if (state === 'active') {
      const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen;
      if (!exit) return 'denied';
      await exit.call(doc);
      return 'available';
    }
    await requestFullscreen(doc);
    return 'active';
  } catch {
    return 'denied';
  }
}

export async function enterTouchFullscreen(surface = window, doc = document) {
  return usesTouchLayout(surface) && fullscreenState(surface, doc) === 'available' &&
    await toggleFullscreen(surface, doc) === 'active';
}
