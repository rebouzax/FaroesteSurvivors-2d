const lerp = (from, to, amount) => from + (to - from) * amount;
const bounded = fraction => Math.min(1, Math.max(0, fraction));
const MAX_CONTINUOUS_STEP = 3;

// The renderer samples the last completed simulation interval. Game state,
// collisions and input keep running on the fixed timestep.
export class BattlefieldMotion {
  constructor() {
    this.positions = new WeakMap();
    this.generation = 0;
    this.attack = null;
  }

  capture(run) {
    this.generation++;
    this.track(run.player);
    for (const enemy of run.enemies) this.track(enemy);
    for (const shot of run.primaryShots) this.track(shot);
    for (const shot of run.projectiles) this.track(shot);
    for (const shot of run.ghostShots) this.track(shot);
    for (const shot of run.silverShots) this.track(shot);
    for (const shot of run.enemyShots) this.track(shot);
    for (const bottle of run.bottles) this.track(bottle);
    this.visualTime = run.visualTime;
    this.introTime = run.introTime;
    this.attack = run.attack;
    this.attackAge = run.attack?.age ?? 0;
    this.playerTravel = run.player.travel ?? 0;
  }

  track(actor) {
    let sample = this.positions.get(actor);
    if (!sample) {
      sample = {};
      this.positions.set(actor, sample);
    }
    sample.x = actor.x;
    sample.z = actor.z;
    sample.age = actor.age;
    sample.generation = this.generation;
  }

  reset() {
    // Discard the pending interval when resuming from a modal or after a pause.
    this.generation++;
    this.visualTime = undefined;
    this.attack = null;
  }

  actor(actor, amount, target) {
    const previous = this.positions.get(actor);
    const t = bounded(amount);
    if (!previous || previous.generation !== this.generation || t >= 1 ||
        (actor.x - previous.x) ** 2 + (actor.z - previous.z) ** 2 > MAX_CONTINUOUS_STEP ** 2) return actor;
    target.x = lerp(previous.x, actor.x, t);
    target.z = lerp(previous.z, actor.z, t);
    target.age = previous.age === undefined ? actor.age : lerp(previous.age, actor.age, t);
    return target;
  }

  clock(run, amount) {
    const t = bounded(amount);
    const visual = this.visualTime === undefined ? run.visualTime : lerp(this.visualTime, run.visualTime, t);
    const intro = this.visualTime === undefined ? run.introTime : lerp(this.introTime, run.introTime, t);
    const attack = run.attack;
    const attackAge = attack === this.attack && attack ? lerp(this.attackAge, attack.age, t) : attack?.age ?? 0;
    const distance = run.player.travel ?? 0;
    const travel = this.visualTime === undefined ? distance : lerp(this.playerTravel, distance, t);
    return { time: visual + intro, visual, attackAge, travel, hurt: visual < (run.player.hurtCueUntil ?? -Infinity) };
  }
}
