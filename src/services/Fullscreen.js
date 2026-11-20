export function usesTouchLayout(surface = window) {
  return surface.matchMedia('(pointer: coarse)').matches ||
    (surface.navigator.maxTouchPoints > 0 && surface.matchMedia('(hover: none)').matches);
}

export async function enterTouchFullscreen(surface = window, doc = document) {
  if (!usesTouchLayout(surface) || surface.navigator.standalone || doc.fullscreenElement || doc.webkitFullscreenElement ||
      surface.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches) return false;
  const target = doc.documentElement;
  try {
    if (target.requestFullscreen && doc.fullscreenEnabled !== false) {
      await target.requestFullscreen({ navigationUI: 'hide' });
      return true;
    }
    if (target.webkitRequestFullscreen && doc.webkitFullscreenEnabled !== false) {
      await target.webkitRequestFullscreen();
      return true;
    }
  } catch {
    // The layout already fills the visible viewport where native fullscreen is unavailable.
  }
  return false;
}
