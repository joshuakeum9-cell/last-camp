import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { bus, Subscriptions } from '../core/EventBus';
import { newRunState, state } from '../core/GameState';
import { SaveSystem } from '../core/SaveSystem';
import { InputSystem } from '../core/InputSystem';
import { Player } from '../entities/Player';
import { Pickup } from '../entities/Pickup';
import { ResourceNode, type NodeKind } from '../entities/ResourceNode';
import { Breakable } from '../entities/Breakable';
import { Juice } from '../systems/Juice';
import { Weather } from '../systems/Weather';
import { CombatSystem } from '../systems/CombatSystem';
import { WeaponSystem } from '../systems/WeaponSystem';
import { EnemyManager } from '../systems/EnemyManager';
import { DayNightSystem } from '../systems/DayNightSystem';
import { ColdSystem } from '../systems/ColdSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { generateWorld, SOLID_PROPS, type PropKind, type WorldMapData } from '../systems/MapGen';
import { SOLID_TILES, TILESET_KEY, TILE_SIZE } from '../art/sprites/tiles';
import { SCENERY_KEYS } from '../art/sprites/scenery';
import { CAMP_KEYS } from '../art/sprites/camp';
import { hex, mix, PAL } from '../art/palette';
import { FONT } from '../art/PixelFont';
import { hud } from '../core/HudState';
import { Rng, hashString, subSeed } from '../core/Rng';
import { ENEMIES, type EnemyId } from '../data/enemies';
import { RESOURCES } from '../data/resources';
import {
  AREAS,
  RETURN_ZONE,
  WORLD_SPAWN,
  areaAtTile,
  rectContains,
  type AreaDef,
} from '../data/areas';

const PROP_TEXTURE: Record<string, string> = {
  pine: SCENERY_KEYS.pine,
  pineSmall: SCENERY_KEYS.pineSmall,
  deadTree: SCENERY_KEYS.deadTree,
  rock: SCENERY_KEYS.rock,
  rockSmall: SCENERY_KEYS.rockSmall,
  wreck: SCENERY_KEYS.wreck,
  crystal: SCENERY_KEYS.crystal,
  bush: SCENERY_KEYS.bush,
};

const HARVESTABLE: PropKind[] = ['pine', 'pineSmall', 'deadTree', 'wreck', 'bush', 'crystal'];

/** The expedition. Explore, collect, fight, and decide when to turn for home. */
export class WorldScene extends Phaser.Scene {
  private input$!: InputSystem;
  private player!: Player;
  private juice!: Juice;
  private weather!: Weather;
  private combat!: CombatSystem;
  private weapons!: WeaponSystem;
  private enemyManager!: EnemyManager;
  private clock!: DayNightSystem;
  private cold!: ColdSystem;
  private subs = new Subscriptions();

  private mapData!: WorldMapData;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private ambient!: Phaser.GameObjects.Rectangle;
  private darkness!: Phaser.GameObjects.Rectangle;
  private frostVignette!: Phaser.GameObjects.Image;
  private currentArea: AreaDef | null = null;
  private prompt!: Phaser.GameObjects.BitmapText;
  private pickups: Pickup[] = [];
  private ambientTarget: string = PAL.blue;
  private ambientCurrent: string = PAL.blue;
  private ending = false;

  constructor() {
    super('World');
  }

  create(): void {
    if (!state.run) {
      state.run = newRunState(Date.now() & 0xffffff, ResourceSystem.maxHp(), false);
    }
    const seed = state.run.seed;
    this.ending = false;
    this.pickups = [];

    this.mapData = generateWorld(seed);
    this.buildTilemap();
    this.buildHorizon();

    this.player = new Player(
      this,
      WORLD_SPAWN.x * TILE_SIZE + TILE_SIZE / 2,
      WORLD_SPAWN.y * TILE_SIZE + TILE_SIZE,
    );
    this.player.setMaxHp(ResourceSystem.maxHp(), false);
    this.player.hp = state.run.hp > 0 ? Math.min(state.run.hp, this.player.maxHp) : this.player.maxHp;
    this.physics.add.collider(this.player.sprite, this.layer);

    this.input$ = new InputSystem(this);
    this.juice = new Juice(this);
    this.weather = new Weather(this);
    this.clock = new DayNightSystem();
    this.cold = new ColdSystem();

    this.combat = new CombatSystem(this, this.player, this.juice);
    this.weapons = new WeaponSystem(this, this.player, this.combat);
    this.buildProps(seed);

    this.enemyManager = new EnemyManager(this, this.mapData, this.juice);
    this.enemyManager.populate(seed);
    this.combat.setEnemies(this.enemyManager.enemies);
    this.registry.set('player', this.player);
    this.physics.add.collider(
      this.enemyManager.enemies.map((e) => e.sprite),
      this.layer,
    );

    this.buildOverlays();
    this.buildPrompt();
    this.setupCamera();

    this.weather.setStorm(state.run.storm);
    if (state.run.storm) {
      bus.emit('juice:toast', {
        text: 'A storm is coming in. The cold will bite harder.',
        color: '#2fd8ff',
      });
    }

    if (!this.scene.isActive('HUD')) this.scene.launch('HUD');
    this.scene.bringToTop('HUD');

    this.subs.add(bus.on('player:died', () => this.endDay('death')));
    this.subs.add(bus.on('enemy:killed', (e) => this.onEnemyKilled(e.type, e.x, e.y)));
    this.events.once('shutdown', () => this.cleanup());
    this.cameras.main.fadeIn(280, 0, 0, 0);
  }

  // --- world building ----------------------------------------------------

  private buildTilemap(): void {
    const map = this.make.tilemap({
      data: this.mapData.tiles,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tileset = map.addTilesetImage('tiles', TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) throw new Error('[WorldScene] tileset could not be created');
    const layer = map.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error('[WorldScene] tile layer could not be created');
    this.layer = layer;
    this.layer.setCollision(SOLID_TILES);
    this.layer.setDepth(0);

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  }

  /** A far ridge with the signal tower on it, so the goal is always on the horizon. */
  private buildHorizon(): void {
    const { width } = BAL.view;
    this.add
      .rectangle(0, 0, width * 2, 40, hex(PAL.deep))
      .setOrigin(0)
      .setScrollFactor(0.08, 0.04)
      .setAlpha(0.55)
      .setDepth(-2);

    const tower = this.add
      .image(width * 0.78, 40, SCENERY_KEYS.tower)
      .setOrigin(0.5, 1)
      .setScale(2)
      .setScrollFactor(0.08, 0.04)
      .setTint(hex(PAL.navy))
      .setDepth(-1);

    const blink = this.add
      .rectangle(tower.x, 22, 2, 2, hex(PAL.blood))
      .setScrollFactor(0.08, 0.04)
      .setDepth(-1);
    this.tweens.add({
      targets: blink,
      alpha: 0,
      duration: 340,
      yoyo: true,
      repeat: -1,
      repeatDelay: 1700,
    });
  }

  private buildProps(seed: number): void {
    const solids = this.physics.add.staticGroup();
    const rng = new Rng(hashString('props-render'));
    const addPickup = (p: Pickup) => this.pickups.push(p);

    for (const prop of this.mapData.props) {
      const key = PROP_TEXTURE[prop.kind];
      if (!key) continue;
      const x = prop.tx * TILE_SIZE + TILE_SIZE / 2;
      const y = prop.ty * TILE_SIZE + TILE_SIZE;

      const big = prop.kind === 'pine' || prop.kind === 'deadTree';
      const scale = big ? rng.range(1.45, 1.95) : rng.range(0.9, 1.3);
      const shadowW = Math.round(
        (prop.kind === 'wreck' ? 26 : prop.kind === 'bush' ? 12 : 15) * scale,
      );
      const shadow = this.add
        .ellipse(x, y - 1, shadowW, Math.max(4, Math.round(shadowW * 0.32)), hex(PAL.blue))
        .setAlpha(0.3)
        .setDepth(y - 2);

      const img = this.add
        .image(x, y, key)
        .setOrigin(0.5, 1)
        .setDepth(y)
        .setScale(scale)
        .setFlipX(rng.chance(0.5));
      // A touch of colour drift so a forest is not a wall of clones. Kept small: the
      // greens are meant to stay saturated against the snow.
      if (prop.kind !== 'crystal') {
        img.setTint(hex(mix(PAL.white, rng.chance(0.5) ? PAL.cyan : PAL.cream, rng.range(0, 0.1))));
      }

      // Crystals glow, because the rarest thing in the world should be visible from far off.
      if (prop.kind === 'crystal') {
        const glow = this.add
          .image(x, y - 8, 'fx-glow-md')
          .setTint(hex(PAL.cyan))
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0.35)
          .setDepth(y - 1);
        this.tweens.add({
          targets: glow,
          alpha: 0.6,
          duration: 1400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

      if (HARVESTABLE.includes(prop.kind)) {
        this.combat.nodes.push(
          new ResourceNode(
            this,
            prop.kind as NodeKind,
            img,
            shadow,
            this.juice,
            addPickup,
            subSeed(seed, `node:${prop.tx}:${prop.ty}`),
          ),
        );
      }

      if (SOLID_PROPS.includes(prop.kind)) {
        const w = prop.kind === 'wreck' ? 18 : prop.kind === 'crystal' ? 10 : 8;
        const blocker = solids.create(x, y - 3, 'fx-dot1') as Phaser.Physics.Arcade.Sprite;
        blocker.setVisible(false).setOrigin(0.5, 0.5);
        const body = blocker.body as Phaser.Physics.Arcade.StaticBody;
        body.setSize(w, 6);
        body.position.set(x - w / 2, y - 6);
        body.updateCenter();
      }
    }

    this.physics.add.collider(this.player.sprite, solids);
    this.scatterBreakables(seed, addPickup);

    for (const dy of [-3, 3]) {
      const px = (RETURN_ZONE.x1 + 1) * TILE_SIZE;
      const py = (WORLD_SPAWN.y + dy) * TILE_SIZE + TILE_SIZE;
      this.add.image(px, py, CAMP_KEYS.gatePost).setOrigin(0.5, 1).setScale(1.4).setDepth(py);
    }
  }

  /** Crates and ice chunks, for the small constant drumbeat of feedback. */
  private scatterBreakables(seed: number, addPickup: (p: Pickup) => void): void {
    const rng = new Rng(subSeed(seed, 'breakables'));
    const taken = new Set<string>();

    for (const area of Object.values(AREAS)) {
      const count = Math.round(
        ((area.rect.x1 - area.rect.x0) * (area.rect.y1 - area.rect.y0)) / 110,
      );
      for (let i = 0; i < count; i++) {
        const tx = rng.int(area.rect.x0 + 1, area.rect.x1 - 2);
        const ty = rng.int(area.rect.y0 + 1, area.rect.y1 - 2);
        const key = `${tx},${ty}`;
        if (taken.has(key)) continue;
        const tile = this.mapData.tiles[ty]?.[tx];
        if (tile === undefined || SOLID_TILES.includes(tile)) continue;
        taken.add(key);

        const icy = area.ground === 'ice' || area.ground === 'deep';
        const img = this.add
          .image(
            tx * TILE_SIZE + 8,
            ty * TILE_SIZE + TILE_SIZE,
            icy ? SCENERY_KEYS.iceChunk : SCENERY_KEYS.crate,
          )
          .setOrigin(0.5, 1)
          .setScale(1.3)
          .setDepth(ty * TILE_SIZE + TILE_SIZE);
        this.combat.breakables.push(
          new Breakable(
            this,
            icy ? 'iceChunk' : 'crate',
            img,
            this.juice,
            addPickup,
            subSeed(seed, key),
          ),
        );
      }
    }
  }

  private buildOverlays(): void {
    const { width, height } = BAL.view;
    // A light tint, not a dimmer. Multiply blending crushed the saturation out of
    // every tile, which is the opposite of what this world is supposed to look like.
    this.ambient = this.add
      .rectangle(0, 0, width, height, hex(PAL.blue))
      .setOrigin(0)
      .setScrollFactor(0)
      .setAlpha(0.09)
      .setDepth(5000);

    // Night falls as a deep navy wash rather than a black one, so the world stays
    // colourful even when it is dangerous.
    this.darkness = this.add
      .rectangle(0, 0, width, height, hex(PAL.navy))
      .setOrigin(0)
      .setScrollFactor(0)
      .setAlpha(0)
      .setDepth(5010);

    this.frostVignette = this.add
      .image(width / 2, height / 2, 'fx-glow-xl')
      .setScrollFactor(0)
      .setTint(hex(PAL.cyan))
      .setAlpha(0)
      .setScale(3)
      .setDepth(5020);
  }

  private buildPrompt(): void {
    this.prompt = this.add
      .bitmapText(0, 0, FONT, '')
      .setOrigin(0.5, 1)
      .setTint(hex(PAL.gold))
      .setDepth(7500)
      .setVisible(false);
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.startFollow(this.player.sprite, true, BAL.camera.lerp, BAL.camera.lerp);
    cam.setDeadzone(BAL.camera.deadzone.w, BAL.camera.deadzone.h);
    cam.setBackgroundColor(PAL.navy);
    cam.followOffset.set(0, -6);
  }

  // --- loop --------------------------------------------------------------

  update(_time: number, delta: number): void {
    if (this.ending) return;
    const dt = Math.min(delta, 50);
    const input = this.input$.update(this.player.cx, this.player.cy);

    this.player.update(dt, input);
    this.weapons.update(dt, input);
    if (input.swapPressed) this.weapons.swap();

    this.enemyManager.update(dt, this.player.cx, this.player.cy);
    this.combat.update();
    this.enemyManager.sweep();
    this.enemyManager.setNight(this.clock.isNight, this.player.cx, this.player.cy);

    this.updatePickups(dt);
    this.updateArea();
    this.updateClockAndCold(dt);
    this.updateInteraction(input.interactPressed);
    this.updateHud();

    this.weather.update(dt, this.currentArea?.id === 'lake' ? 0.5 : 0.18);
    this.weather.setNight(this.clock.darkness);

    // Ease the ambient tint between areas, so crossing a border changes the temperature
    // of the screen rather than snapping it.
    if (this.ambientCurrent !== this.ambientTarget) {
      this.ambientCurrent = mix(this.ambientCurrent, this.ambientTarget, 0.06);
      this.ambient.setFillStyle(hex(this.ambientCurrent), 1);
    }

    // Look a little way ahead of the player, which makes the camera feel intentional.
    const cam = this.cameras.main;
    cam.followOffset.set(
      Phaser.Math.Linear(cam.followOffset.x, -this.player.facingX * BAL.camera.lookAhead, 0.05),
      Phaser.Math.Linear(cam.followOffset.y, -6 - this.player.facingY * 6, 0.05),
    );

    if (state.run) state.run.hp = this.player.hp;
  }

  /** Drops are rolled here rather than in the enemy, so loot rules live in one place. */
  private onEnemyKilled(type: string, x: number, y: number): void {
    if (state.run) state.run.kills++;
    state.stats.enemiesKilled[type] = (state.stats.enemiesKilled[type] ?? 0) + 1;

    const def = ENEMIES[type as EnemyId];
    if (!def) return;
    const rng = new Rng(hashString(`${type}:${Math.round(x)}:${Math.round(y)}`));
    for (const drop of def.drops) {
      if (!rng.chance(drop.chance)) continue;
      const amount = rng.int(drop.min, drop.max);
      if (amount <= 0) continue;
      this.pickups.push(new Pickup(this, drop.id, amount, x, y));
      if (RESOURCES[drop.id].rare && state.run) state.run.rareFinds++;
    }
  }

  private updatePickups(dt: number): void {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      if (this.pickups[i].update(dt, this.player.cx, this.player.cy, this.juice)) {
        this.pickups.splice(i, 1);
      }
    }
  }

  private updateClockAndCold(dt: number): void {
    this.clock.update(dt);

    const area = this.currentArea;
    const nearHome = area?.id === 'gate';
    const damage = this.cold.update(
      dt,
      area?.coldMult ?? 1,
      this.clock.coldMultiplier,
      nearHome ? 'fire' : 'none',
    );
    if (damage > 0) this.player.hp = Math.max(0, this.player.hp - damage);
    if (this.player.hp <= 0 && !this.ending) this.endDay('death');

    this.darkness.setAlpha(
      Phaser.Math.Linear(this.darkness.alpha, this.clock.darkness * 0.75, 0.04),
    );
    this.frostVignette.setAlpha(Math.max(0, (this.cold.fraction - 0.6) * 0.9));
  }

  private updateHud(): void {
    hud.context = 'world';
    hud.hp = this.player.hp;
    hud.maxHp = this.player.maxHp;
    hud.day = state.day;
    hud.dashCharge = this.player.dashCharge;
    hud.cold = this.cold.cold;
    hud.dayProgress = this.clock.progress;
    hud.phaseName = this.clock.phase.toUpperCase();
    hud.secondsLeft = this.clock.secondsToNightfall;
    hud.showSeconds = ResourceSystem.campEffects().unlocks.has('clockSeconds');
    if (state.run) hud.carried = state.run.collected;

    // The compass only appears when it is needed, and points the way home.
    hud.homeAngle = this.clock.bountyActive
      ? Math.atan2(
          WORLD_SPAWN.y * TILE_SIZE - this.player.cy,
          WORLD_SPAWN.x * TILE_SIZE - this.player.cx,
        )
      : null;
  }

  private updateArea(): void {
    const tx = Math.floor(this.player.cx / TILE_SIZE);
    const ty = Math.floor(this.player.cy / TILE_SIZE);
    const area = areaAtTile(tx, ty);
    if (!area || area === this.currentArea) return;
    this.currentArea = area;
    this.ambientTarget = area.tint;

    if (!state.map.discoveredAreas.includes(area.id)) {
      state.map.discoveredAreas.push(area.id);
      state.run?.newAreas.push(area.id);
      bus.emit('area:discovered', { areaId: area.id });
      if (area.announce) this.announce(area.name);
    }
  }

  private announce(name: string): void {
    const { width, height } = BAL.view;
    const label = this.add
      .bitmapText(Math.round(width / 2), Math.round(height / 2) - 30, FONT, name.toUpperCase())
      .setOrigin(0.5)
      .setScale(2)
      .setTint(hex(PAL.white))
      .setScrollFactor(0)
      .setDepth(7600)
      .setAlpha(0);

    this.tweens.add({
      targets: label,
      alpha: 1,
      y: Math.round(height / 2) - 38,
      duration: 380,
      hold: 1500,
      yoyo: true,
      onComplete: () => label.destroy(),
    });
    bus.emit('audio:play', { cue: 'discover' });
  }

  private updateInteraction(pressed: boolean): void {
    const tx = Math.floor(this.player.cx / TILE_SIZE);
    const ty = Math.floor(this.player.cy / TILE_SIZE);

    if (rectContains(RETURN_ZONE, tx, ty)) {
      this.prompt
        .setText('E  RETURN TO CAMP')
        .setPosition(Math.round(this.player.cx), Math.round(this.player.sprite.y) - 26)
        .setVisible(true);
      if (pressed) this.endDay('return');
      return;
    }
    this.prompt.setVisible(false);
  }

  // --- ending the day ----------------------------------------------------

  private endDay(reason: 'return' | 'death'): void {
    if (this.ending) return;
    this.ending = true;

    const run = state.run;
    const result = ResourceSystem.endDay(reason);

    if (reason === 'death') {
      state.stats.deaths++;
      this.cameras.main.shake(320, 0.012);
      bus.emit('audio:play', { cue: 'death' });
    } else {
      bus.emit('audio:play', { cue: 'return' });
    }
    bus.emit('day:ended', { reason, day: state.day });
    SaveSystem.save();

    const payload = {
      reason,
      day: state.day,
      banked: result.banked,
      bonusNight: result.bonusNight,
      lost: result.lost,
      untouched: result.untouched,
      keepFraction: result.keepFraction,
      kills: run?.kills ?? 0,
      rareFinds: run?.rareFinds ?? 0,
      newAreas: run?.newAreas ?? [],
      notes: run?.notesFound.length ?? 0,
      breakables: run?.breakables ?? 0,
    };

    const fade = reason === 'death' ? 700 : 340;
    this.cameras.main.fadeOut(fade, 0, 0, 0);
    this.time.delayedCall(fade + 30, () => {
      this.scene.stop('HUD');
      this.scene.start('Summary', payload);
    });
  }

  private cleanup(): void {
    this.subs.dispose();
    for (const p of this.pickups) p.destroy();
    this.pickups = [];
    this.enemyManager?.destroy();
    this.weapons?.destroy();
    this.weather?.destroy();
    this.juice?.destroy();
    this.player?.destroy();
    this.registry.remove('player');
  }
}
