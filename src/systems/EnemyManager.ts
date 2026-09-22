import Phaser from 'phaser';
import { state } from '../core/GameState';
import { BAL, dayScale } from '../data/balance';
import { activeEvent } from '../data/events';
import { WINTER } from '../data/winter';
import { AREA_LIST, type AreaId } from '../data/areas';
import { AREA_SPAWNS, ENEMIES, SPAWN_DENSITY, type EnemyId } from '../data/enemies';
import { EnemyBase, type EnemyBehavior } from '../entities/EnemyBase';
import { frostRatBehavior } from '../entities/enemies/FrostRat';
import { iceWolfBehavior } from '../entities/enemies/IceWolf';
import { frozenWalkerBehavior } from '../entities/enemies/FrozenWalker';
import { snowSpitterBehavior } from '../entities/enemies/SnowSpitter';
import { iceSkaterBehavior } from '../entities/enemies/IceSkater';
import { ridgeCrowBehavior } from '../entities/enemies/RidgeCrow';
import { driftBruteBehavior } from '../entities/enemies/DriftBrute';
import { Rng, subSeed } from '../core/Rng';
import { activeDifficulty } from '../data/difficulty';
import { SOLID_TILES, TILE_SIZE } from '../art/sprites/tiles';
import type { Juice } from './Juice';
import type { WorldMapData } from './MapGen';

const BEHAVIORS: Record<EnemyId, EnemyBehavior> = {
  rat: frostRatBehavior,
  wolf: iceWolfBehavior,
  walker: frozenWalkerBehavior,
  spitter: snowSpitterBehavior,
  stalker: iceWolfBehavior,
  alpha: iceWolfBehavior,
  skater: iceSkaterBehavior,
  crow: ridgeCrowBehavior,
  brute: driftBruteBehavior,
};

/**
 * Decides what lives where. Spawns are seeded from the day, so a day's map is the same
 * if the player dies and the run is retried, but different from one day to the next.
 */
export class EnemyManager {
  readonly enemies: EnemyBase[] = [];
  private night = false;
  private stalkerSpawned = false;

  constructor(
    private scene: Phaser.Scene,
    private map: WorldMapData,
    private juice: Juice,
  ) {}

  /** Fill the map at the start of a day. */
  populate(seed: number): void {
    const day = state.day;
    const scale = dayScale(day);

    for (const area of AREA_LIST) {
      // Once the one who kept calling them is gone, the cabin's walkers stop coming.
      const rules = (AREA_SPAWNS[area.id] ?? []).filter(
        (r) => r.fromDay <= day && !(area.id === 'cabin' && r.id === 'walker' && state.bosses.rangerDefeated),
      );
      if (rules.length === 0) continue;

      const rng = new Rng(subSeed(seed, `spawn:${area.id}`));
      const tiles = (area.rect.x1 - area.rect.x0) * (area.rect.y1 - area.rect.y0);
      const groups = Math.max(
        1,
        Math.round(
          (tiles / 100) *
            SPAWN_DENSITY *
            activeDifficulty(state.settings.difficulty).spawnRate *
            activeEvent(state.run?.event).spawnMult *
            WINTER.spawnMult(),
        ),
      );

      for (let g = 0; g < groups; g++) {
        const rule = this.pickRule(rules, rng);
        const def = ENEMIES[rule.id];
        const spot = this.findOpenTile(area.id, rng);
        if (!spot) continue;

        const packSize = rng.int(def.pack[0], def.pack[1]) + (def.pack[1] > 1 ? scale.pack : 0);
        // From day two, one pack in eight is led by an elite. Never the alpha or stalker.
        const eliteLead = day >= 2 && rule.id !== 'alpha' && rule.id !== 'stalker' && rng.chance(0.12);
        for (let i = 0; i < packSize; i++) {
          const jitterX = rng.range(-22, 22);
          const jitterY = rng.range(-18, 18);
          this.spawn(rule.id, spot.x + jitterX, spot.y + jitterY, eliteLead && i === 0);
          if (this.enemies.length >= BAL.perf.maxActiveEnemies * 3) return;
        }
      }
    }
  }

  spawn(id: EnemyId, x: number, y: number, elite = false): EnemyBase {
    const enemy = new EnemyBase(this.scene, ENEMIES[id], x, y, BEHAVIORS[id], this.juice, elite);
    this.enemies.push(enemy);
    return enemy;
  }

  private pickRule(rules: typeof AREA_SPAWNS[string], rng: Rng) {
    const total = rules.reduce((sum, r) => sum + r.weight, 0);
    let roll = rng.range(0, total);
    for (const r of rules) {
      roll -= r.weight;
      if (roll <= 0) return r;
    }
    return rules[rules.length - 1];
  }

  findOpenTile(areaId: AreaId, rng: Rng): { x: number; y: number } | null {
    const area = AREA_LIST.find((a) => a.id === areaId);
    if (!area) return null;
    for (let attempt = 0; attempt < 30; attempt++) {
      const tx = rng.int(area.rect.x0 + 1, area.rect.x1 - 2);
      const ty = rng.int(area.rect.y0 + 1, area.rect.y1 - 2);
      const tile = this.map.tiles[ty]?.[tx];
      if (tile === undefined || SOLID_TILES.includes(tile)) continue;
      return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
    }
    return null;
  }

  /**
   * Update only what is near the player. Distant enemies sleep, which is what keeps a
   * map this size running at 60fps on a phone.
   */
  update(dt: number, playerX: number, playerY: number): void {
    let awake = 0;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dist = Math.hypot(enemy.cx - playerX, enemy.cy - playerY);
      const sleeping = dist > BAL.perf.enemySleepDistance;
      enemy.sprite.setVisible(!sleeping);
      if (sleeping) {
        enemy.body.setVelocity(0, 0);
        continue;
      }
      if (awake >= BAL.perf.maxActiveEnemies) continue;
      awake++;
      enemy.update(dt, playerX, playerY);
    }
  }

  /** Night makes the map meaner, and puts one thing in it that was not there before. */
  setNight(on: boolean, playerX: number, playerY: number): void {
    if (this.night === on) return;
    this.night = on;
    if (!on || this.stalkerSpawned) return;
    this.summonStalker(playerX, playerY);
  }

  /** The stalker, out of sight. A whiteout brings it in daylight. */
  summonStalker(playerX: number, playerY: number): void {
    if (this.stalkerSpawned) return;
    this.stalkerSpawned = true;

    // Spawn it out of sight, so it arrives rather than appears.
    const angle = Math.random() * Math.PI * 2;
    const x = playerX + Math.cos(angle) * 300;
    const y = playerY + Math.sin(angle) * 300;
    this.spawn('stalker', x, y);
  }

  get alive(): EnemyBase[] {
    return this.enemies.filter((e) => e.alive);
  }

  sweep(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (!this.enemies[i].alive && !this.enemies[i].sprite.active) this.enemies.splice(i, 1);
    }
  }

  destroy(): void {
    for (const e of this.enemies) e.destroy();
    this.enemies.length = 0;
    void Phaser;
  }
}
