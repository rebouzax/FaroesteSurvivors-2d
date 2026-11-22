import { CONFIG } from "../config/gameConfig.js";
import { AXE_THROWERS } from '../config/enemyWeapons.js';
import { nearbyProps, pushOut } from './SceneryCollision.js';
import { EnemyCrowd, enemyBodyRadius } from './EnemyCrowd.js';
import { EnemyNavigation, sceneryBlocksPath } from './EnemyNavigation.js';
import { FRONTIER_ENEMIES } from "../config/frontierExpansion.js";
import { enemyStats } from "../config/abilityConfig.js";
import { ENEMY_STAGE_GROUPS } from "../config/campaignConfig.js";
import { EARLY_ENEMIES } from "../config/earlyEnemies.js";
import { ENEMY_WAVES } from "../config/playableStages.js";
import { actorCue, actorHurt } from '../models/ActorCues.js';
const clamp = (value) =>
  Math.max(-CONFIG.mapHalf + 1, Math.min(CONFIG.mapHalf - 1, value));
const RANGED_ENEMIES = new Set(["bellRinger","lanternThief","windmillWraith","drownedProspector","barBanshee","railWitch","graveRider","sundownBandit",...Object.keys(FRONTIER_ENEMIES).filter(id=>FRONTIER_ENEMIES[id].behavior==="ranged")]);
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const tacticFor = type => type === 'wraith' ? 'haunt'
  : EARLY_ENEMIES[type]?.behavior || (RANGED_ENEMIES.has(type)||type==="skeleton" ? "ranged" : FRONTIER_ENEMIES[type]?.behavior||"chase");

export class EnemySystem {
  constructor() {
    this.navigation = new EnemyNavigation();
  }

  nearbyProps(run,x,z){
    return nearbyProps(run,x,z);
  }
  keepOutOfProps(run, enemy) {
    const radius = enemy.treasure ? .85 : enemy.bossId ? 1 : .4;
    let blocked = false;
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const prop of this.nearbyProps(run, enemy.x, enemy.z)) moved = pushOut(enemy, prop, radius) || moved;
      if (!moved) break;
      blocked = true;
    }
    enemy.x = clamp(enemy.x);
    enemy.z = clamp(enemy.z);
    return blocked;
  }
  spawnForStage(run, weights) {
    if (weights) {
      let roll = run.random() * weights.reduce((sum, [, weight]) => sum + weight, 0);
      for (const [id, weight] of weights) {
        roll -= weight;
        if (roll < 0) return this.spawn(run, id);
      }
      return;
    }
    const roster = ENEMY_STAGE_GROUPS[run.mapId];
    if (!roster?.length) throw new Error("Fase sem bestiário: " + run.mapId);
    // Vultures use the separate fly-by spawner, which supplies velocity and warning.
    const walkers = roster.filter(id => id !== "vulture");
    return this.spawn(run, walkers[Math.floor(run.random() * walkers.length)]);
  }
  spawn(run, type = "bat") {
    if (run.enemies.length >= (run.maxEnemies || CONFIG.maxBats)) return;
    const stats = enemyStats(type, Math.floor(run.time / 60));
    const enemy = {
      id: ++run.nextId,
      type,
      ...stats,
      maxHp: stats.hp,
      x: 0,
      z: 0,
      hitFlash: 0,
    };
    if (this.position(run, enemy)) run.enemies.push(enemy);
  }
  position(run, enemy) {
    const bearing = run.random() * Math.PI * 2 + enemy.id * GOLDEN_ANGLE;
    const radius = enemyBodyRadius(enemy);
    for (let attempt = 0; attempt < 14; attempt++) {
      const angle = bearing + attempt * GOLDEN_ANGLE;
      const distance = 30 + (enemy.id + attempt * 3) % 8 + Math.floor(attempt / 5) * 6;
      const candidate = {
        x: clamp(run.player.x + Math.cos(angle) * distance),
        z: clamp(run.player.z + Math.sin(angle) * distance),
      };
      if (Math.hypot(candidate.x - run.player.x, candidate.z - run.player.z) < 24) continue;
      if (this.nearbyProps(run, candidate.x, candidate.z).some(prop => pushOut({ ...candidate }, prop, .65))) continue;
      if (run.enemies.some(other => other !== enemy && other.hp > 0 &&
        Math.hypot(candidate.x - other.x, candidate.z - other.z) < radius + enemyBodyRadius(other) + 1.2)) continue;
      Object.assign(enemy, candidate);
      return true;
    }
    return false;
  }
  separate(run) {
    const move = (enemy, dx, dz) => {
      enemy.x = clamp(enemy.x + dx);
      enemy.z = clamp(enemy.z + dz);
      this.keepOutOfProps(run, enemy);
    };
    for (let pass = 0; pass < 3; pass++) {
      if (!new EnemyCrowd(run.enemies).resolve(run.enemies, move)) break;
    }
  }
  update(run, dt) {
    if (run.bossEncounter.active) {
      const boss = run.enemies.find(e => e.type === "boss" || e.type === "marshal");
      if (boss?.hp > 0) {
        const dx = run.player.x - boss.x, dz = run.player.z - boss.z;
        const distance = Math.hypot(dx,dz);
        if (distance > .01 && !boss.dash && !run.bossTelegraph) {
          const ranged=["volley","shotgun","crossfire","ringGap","tornadoes"].includes(boss.pattern);
          const preferred=ranged?5.5:2.3;
          const sees = !ranged || this.navigation.seesPlayer(run, boss, dt);
          const approach = !sees ? .65 : distance > preferred + 1 ? 1 : distance < preferred - 1 && ranged ? -.7 : 0;
          const orbit = distance < 12 ? (boss.id%2?1:-1) * (sees ? .32 + (boss.phase || 1) * .12 : 1.1) : 0;
          const pace=boss.speed*(1+((boss.phase||1)-1)*.1);
          const heading = this.navigation.steer(run, boss, {
            x: dx / distance * approach - dz / distance * orbit,
            z: dz / distance * approach + dx / distance * orbit,
          }, dt, .94);
          boss.x = clamp(boss.x + heading.x * pace * dt);
          boss.z = clamp(boss.z + heading.z * pace * dt);
        }
        boss.hitFlash = Math.max(0,boss.hitFlash-dt);
        this.keepOutOfProps(run,boss);
        boss.attackFlash = Math.max(0,(boss.attackFlash||0)-dt);
        boss.releaseFlash = Math.max(0,(boss.releaseFlash||0)-dt);
        boss.swingTimer = (boss.swingTimer??1.2)-dt;
        if (distance < 3 && boss.swingTimer <= 0) {
          boss.attackFlash = 0.58;
          boss.swingTimer = 2;
        }
      }
      const minions = run.enemies.filter(enemy => enemy.summoned && enemy.hp > 0);
      if (minions.length) this.moveEnemies(run, dt, new EnemyCrowd(run.enemies), minions);
      else this.updateShots(run, dt);
      return;
    }
    const minute = Math.floor(run.time / 60);
    if (minute !== run.difficulty) {
      run.difficulty = minute;
      for (const enemy of run.enemies) {
        if(enemy.treasure)continue;
        if (enemy.type === "vulture" || enemy.type === "boss" || enemy.type === "marshal") continue;
        const stats = enemyStats(enemy.type, minute),
          fraction = enemy.hp / enemy.maxHp;
        Object.assign(enemy, stats, {
          hp: stats.hp * fraction,
          maxHp: stats.hp,
        });
      }
    }
    if (run.mapId === "desert" && run.time >= 120) {
      run.vultureTimer -= dt;
      if (run.vultureTimer <= 0) {
        run.vultureTimer = Math.max(12, 22 - minute);
        this.spawnVultures(run);
      }
    }
    this.spawnWaves(run, dt);
    const crowd = new EnemyCrowd(run.enemies);
    this.moveEnemies(run, dt, crowd);
  }
  spawnWaves(run, dt) {
    const minute = Math.floor(run.time / 60);
    const waves = ENEMY_WAVES[run.mapId];
    const wave = waves?.findLast(band => run.time >= band.at);
    if (wave) {
      run.spawnTimer -= dt;
      if (run.spawnTimer > 0) return;
      run.spawnTimer = Math.max(.54, 1.48 - run.time * .00115);
      const cap = Math.min(run.maxEnemies ?? CONFIG.maxBats, wave.population);
      const count = Math.min(cap - run.enemies.length, 1 + Math.floor(run.time / 175));
      if (count <= 0) return;
      if (run.enemyWave !== wave) {
        const weights = Object.entries(wave.weights);
        const introduced = weights.find(([id]) => !run.enemyWave?.weights[id]);
        run.enemyWave = wave;
        run.waveWeights = weights;
        if (introduced) {
          this.spawn(run, introduced[0]);
          for (let i = 1; i < count; i++) this.spawnForStage(run, weights);
          return;
        }
      }
      for (let i = 0; i < count; i++) this.spawnForStage(run, run.waveWeights);
      return;
    }
    run.spawnTimer -= dt;
    if (run.spawnTimer <= 0) {
      run.spawnTimer = Math.max(0.3, 1.5 - run.time / 700);
      for (let i = 0; i < 1 + Math.floor(run.time / 180); i++) this.spawnForStage(run);
    }
    if (ENEMY_STAGE_GROUPS[run.mapId]?.includes("dog") && run.time >= 60) {
      run.dogTimer -= dt;
      if (run.dogTimer <= 0) {
        run.dogTimer = Math.max(2, 7 - (run.time - 60) / 140);
        if (run.enemies.length >= (run.maxEnemies || CONFIG.maxBats)) {
          const index = run.enemies.findIndex(
            (e) =>
              e.type === "bat" &&
              Math.hypot(e.x - run.player.x, e.z - run.player.z) > 24,
          );
          if (index >= 0) run.enemies.splice(index, 1);
        }
        for (let i = 0; i < 1 + Math.floor((run.time - 60) / 240); i++)
          this.spawn(run, "dog");
      }
    }
    if (ENEMY_STAGE_GROUPS[run.mapId]?.includes("skeleton") && run.time >= 180) {
      run.skeletonTimer -= dt;
      if (run.skeletonTimer <= 0) {
        run.skeletonTimer = Math.max(3.5, 11 - minute * 0.55);
        this.spawn(run, "skeleton");
      }
    }
    if (ENEMY_STAGE_GROUPS[run.mapId]?.includes("miner") && run.time >= 270) {
      run.minerTimer -= dt;
      if (run.minerTimer <= 0) {
        run.minerTimer = Math.max(5, 15 - minute * 0.5);
        this.spawn(run, "miner");
      }
    }
    if(ENEMY_STAGE_GROUPS[run.mapId]){
      run.specialSpawnTimer-=dt;
      if(run.specialSpawnTimer<=0){run.specialSpawnTimer=Math.max(2.4,7.5-minute*.22);
        this.spawnForStage(run);}
    }
  }
  moveEnemies(run, dt, crowd, enemies = run.enemies) {
    for (const enemy of enemies) {
      if(enemy.treasure)continue;
      enemy.throwRelease=Math.max(0,(enemy.throwRelease||0)-dt);
      if (enemy.type === "vulture") {
        enemy.age += dt;
        enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
        if (enemy.warning > 0) {
          enemy.warning = Math.max(0, enemy.warning - dt);
          continue;
        }
        enemy.x += enemy.vx * dt;
        enemy.z += enemy.vz * dt;
        continue;
      }
      let dx = run.player.x - enemy.x,
        dz = run.player.z - enemy.z,
        distance = Math.hypot(dx, dz);
      if (distance > 55) {
        this.position(run, enemy);
        dx = run.player.x - enemy.x;
        dz = run.player.z - enemy.z;
        distance = Math.hypot(dx, dz);
      }
      const role = tacticFor(enemy.type);
      const hound = enemy.type === 'dog';
      const ranged = role === 'ranged';
      const range = enemy.type === 'skeleton' ? 17 : 19;
      const hasSight = !ranged || (distance < range + 3 && this.navigation.seesPlayer(run, enemy, dt));
      if ((hound || role === 'charge' || role === 'orbit') && this.charge(run, enemy, role, distance, dt)) continue;
      if (distance > 0.05) {
        const side = enemy.id % 2 ? 1 : -1;
        const flank = Math.min(1, distance / 4, Math.max(0, (24 - distance) / 10));
        const aimPace = enemy.aimTimer > 0 && enemy.type === 'headlessOutlaw' ? .22 : 1;
        const approach = ranged
          ? !hasSight && distance < range + 3 ? .62 : distance < 7 ? -.85 : hasSight && distance < 11 ? 0 : .85
          : role === 'orbit' && distance < 4 ? .4 : 1;
        const orbit = side * flank * (role === 'orbit' || role === 'haunt' ? 1.1
          : ranged ? hasSight ? .48 : 1.22 : .24 + enemy.id % 7 * .065);
        if ((hound || role === 'charge' || role === 'haunt' || role === 'orbit') && run.player.moving) {
          const lead = Math.min(hound ? 2.8 : 2.05, Math.max(0, (distance - 3) * .23));
          dx += run.player.dx * lead;
          dz += run.player.dz * lead;
        }
        const norm = Math.max(.05, Math.hypot(dx, dz));
        const heading = crowd.steer(enemy, {
          x: dx / norm * approach - dz / norm * orbit,
          z: dz / norm * approach + dx / norm * orbit,
        });
        const { x: steerX, z: steerZ } = this.navigation.steer(run, enemy, heading, dt);
        const magnitude=Math.hypot(steerX,steerZ);
        if(magnitude>.01){
          const scale=enemy.speed*aimPace/Math.max(1,magnitude);
          enemy.x=clamp(enemy.x+steerX*scale*dt);
          enemy.z=clamp(enemy.z+steerZ*scale*dt);
        }
        this.keepOutOfProps(run, enemy);
      }
      if(ranged && enemy.hp > 0){
        if(enemy.aimTimer>0){
          enemy.aimTimer=Math.max(0,enemy.aimTimer-dt);
          if(enemy.aimTimer===0&&distance<range+3){
            const ax=enemy.aimX-enemy.x,az=enemy.aimZ-enemy.z,aimLength=Math.hypot(ax,az);
            if(run.enemyShots.length<40 && aimLength>.01 &&
              !sceneryBlocksPath(run, enemy.x, enemy.z, enemy.aimX, enemy.aimZ, .15)){
              const speed=enemy.type==="skeleton"?8:9;
              const kind=AXE_THROWERS.has(enemy.type)?'axe':'orb';
              run.enemyShots.push({x:enemy.x,z:enemy.z,vx:ax/aimLength*speed,vz:az/aimLength*speed,age:0,kind,damage:enemy.type==="skeleton"?enemy.damage:Math.ceil(enemy.damage*.55)});
              actorCue(run, enemy, 'attack');
              if(kind==='axe')enemy.throwRelease=.3;
            }
            enemy.attackFlash=.58;
          }
        }else if(distance<range && hasSight){
          enemy.shotTimer=(enemy.shotTimer??(enemy.type==="skeleton"?1.3:1.8))-dt;
          if(enemy.shotTimer<=0){
            const lead=run.player.moving?Math.min(1.1,run.moveSpeed*.19):0;
            enemy.aimX=run.player.x+run.player.dx*lead;
            enemy.aimZ=run.player.z+run.player.dz*lead;
            enemy.aimTimer=.42+(enemy.id%3)*.06;
            enemy.aimDuration=enemy.aimTimer;
            enemy.shotTimer=enemy.type==="skeleton"?2.7:3.2;
            enemy.attackFlash=.58;
          }
        }
      }
      enemy.attackFlash = Math.max(0,(enemy.attackFlash||0)-dt);
      if (enemy.type === "miner" && distance < 2.2) {
        enemy.lurchTimer = (enemy.lurchTimer??0)-dt;
        if (enemy.lurchTimer <= 0) {
          enemy.attackFlash=0.58;
          enemy.lurchTimer=2.3;
        }
      }
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    }
    this.separate(run);
    // A charge never follows or teleports back to João. It leaves the arena.
    run.enemies = run.enemies.filter(
      (enemy) => enemy.type !== "vulture" || enemy.hp <= 0 || enemy.age < 10,
    );
    this.updateShots(run,dt);
  }

  charge(run, enemy, role, distance, dt) {
    const hound = enemy.type === 'dog';
    enemy.chargeTimer = (enemy.chargeTimer ?? (1.5 + enemy.id % 3)) - dt;
    if (!enemy.charge && enemy.chargeTimer <= 0 && distance > 2.2 && distance < (hound ? 8.5 : 13)) {
      const player = run.player;
      const lead = player.moving ? Math.min(hound ? 1.9 : 1.2, run.moveSpeed * .34) : 0;
      const angle = Math.atan2(player.z + player.dz * lead - enemy.z, player.x + player.dx * lead - enemy.x);
      const vx = Math.cos(angle), vz = Math.sin(angle);
      const speed = hound ? 8.8 : role === 'charge' ? 8 : 6.7;
      const duration = hound ? .68 : role === 'charge' ? .7 : .48;
      if (!sceneryBlocksPath(run, enemy.x, enemy.z, enemy.x + vx * speed * duration,
        enemy.z + vz * speed * duration, .4)) {
        enemy.charge = { vx: vx * speed, vz: vz * speed, left: duration, warning: hound ? .5 : role === 'charge' ? .7 : .5 };
        enemy.chargeTimer = hound ? 4.1 + enemy.id % 4 * .18 : role === 'charge' ? 4.6 : 5.1;
        enemy.attackFlash = .65;
        if (hound) run.events.push('enemy-charge');
      } else enemy.chargeTimer = .22;
    }
    const charge = enemy.charge;
    if (!charge) return false;
    const pending = charge.warning;
    charge.warning = Math.max(0, pending - dt);
    const travelDt = Math.max(0, dt - pending);
    if (travelDt > 0) {
      if (!charge.launched) {
        charge.launched = true;
        actorCue(run, enemy, 'attack');
      }
      enemy.x = clamp(enemy.x + charge.vx * travelDt);
      enemy.z = clamp(enemy.z + charge.vz * travelDt);
      charge.left -= travelDt;
      if (this.keepOutOfProps(run, enemy) || charge.left <= 0) enemy.charge = null;
    }
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    enemy.attackFlash = Math.max(0, (enemy.attackFlash || 0) - dt);
    return true;
  }

  updateShots(run,dt){
    run.enemyShots = run.enemyShots.filter(shot => {
      const x = shot.x + shot.vx * dt;
      const z = shot.z + shot.vz * dt;
      if (sceneryBlocksPath(run, shot.x, shot.z, x, z, .14)) return false;
      const player = run.player;
      const dx = x - shot.x, dz = z - shot.z;
      const portion = Math.max(0, Math.min(1, ((player.x - shot.x) * dx + (player.z - shot.z) * dz) / Math.max(.00001, dx * dx + dz * dz)));
      if ((shot.x + dx * portion - player.x) ** 2 + (shot.z + dz * portion - player.z) ** 2 < .63 ** 2) {
        if (player.invulnerable <= 0) {
          player.hp = Math.max(0, player.hp - shot.damage * 20 / (20 + run.playerArmor));
          player.invulnerable = 0.9;
          actorHurt(run, player);
          if (player.hp <= 0) run.phase = "defeat";
        }
        return false;
      }
      shot.x = x;
      shot.z = z;
      shot.age += dt;
      return shot.age < 4;
    });
  }
  spawnVultures(run) {
    if (run.enemies.filter((e) => e.type === "vulture").length > 18) return;
    const angle = run.random() * Math.PI * 2;
    const dx = Math.cos(angle),
      dz = Math.sin(angle);
    // Snapshot at spawn: six parallel lanes, never a homing attack.
    const targetX = run.player.x,
      targetZ = run.player.z;
    for (let i = 0; i < 6; i++) {
      const offset = (i - 2.5) * 2.6;
      const approach = 26 + Math.floor(i / 2) * 3.4;
      run.enemies.push({
        id: ++run.nextId,
        type: "vulture",
        hp: 6,
        maxHp: 6,
        damage: 2,
        armor: 0,
        speed: 10,
        xp: 10,
        x: targetX - dx * approach - dz * offset,
        z: targetZ - dz * approach + dx * offset,
        vx: dx * 10,
        vz: dz * 10,
        targetX,
        targetZ,
        hitFlash: 0,
        warning: 1.5,
        age: 0,
      });
    }
    run.events.push("vulture");
  }
}
