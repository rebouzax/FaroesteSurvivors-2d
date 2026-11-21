export const championReleaseAge = id => id === 'joao' ? .18 : .16;

export function actorSoundId(run, actor) {
  if (actor === run.player) return run.characterId;
  if (actor.treasure) return run.mapId === 'mine' ? 'treasureRat' : 'treasure';
  return actor.bossId || actor.type;
}

export function actorCue(run, actor, action, { sound, angle, gain, point = actor } = {}) {
  run.actorCues.push({
    actor, id: actorSoundId(run, actor), player: actor === run.player,
    action, sound, angle, gain, x: point.x, z: point.z, at: run.visualTime,
  });
  if (action === 'attack' && actor !== run.player) actor.attackCueUntil = run.visualTime + .16;
}

export function actorHurt(run, actor) {
  if (actor !== run.player) actor.hitFlash = .12;
  const player = actor === run.player;
  // Sustained fire and overlapping pellets share one recoil and voice.
  if (run.visualTime < (actor.hurtCueUntil ?? -Infinity)) return;
  actor.hurtCueUntil = run.visualTime + (player ? .22 : .12);
  if (player) run.events.push('hurt');
  actorCue(run, actor, 'hurt');
}
