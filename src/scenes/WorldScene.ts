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
import { Cache } from '../entities/Cache';
import { Juice } from '../systems/Juice';
import { Weather } from '../systems/Weather';
import { CombatSystem } from '../systems/CombatSystem';
import { WeaponSystem } from '../systems/WeaponSystem';
import { EnemyManager } from '../systems/EnemyManager';
import { DayNightSystem } from '../systems/DayNightSystem';
import { ColdSystem } from '../systems/ColdSystem';
import { Lighting } from '../systems/Lighting';
import { LootSystem } from '../systems/LootSystem';
import { CACHES } from '../data/loot';
import { NOTE_LIST } from '../data/story';
import { WorldNote } from '../entities/WorldNote';
import { Gate } from '../entities/Gate';
import { NPCMira } from '../entities/NPCMira';
import { BossWhiteMaw } from '../entities/BossWhiteMaw';
import { BossHollowStag } from '../entities/BossHollowStag';
import { BossRanger } from '../entities/BossRanger';
import type { Boss } from '../entities/Boss';
import { Dialogue } from '../ui/Dialogue';
import { TouchControls } from '../ui/TouchControls';
import { GATE_IDS } from '../data/areas';
import { RARITY_COLOR } from '../art/palette';
import { ResourceSystem } from '../systems/ResourceSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { audio } from '../systems/AudioManager';
import { generateWorld, SOLID_PROPS, type DecorKind, type PropKind, type WorldMapData } from '../systems/MapGen';
import { SOLID_TILES, TILE_SIZE } from '../art/sprites/tiles';
import { TilesetBuilder, applyTransitions } from '../art/sprites/transitions';
import { isSolidIndex } from '../systems/MapGen';
import { SCENERY_KEYS } from '../art/sprites/scenery';
import { FX } from '../art/sprites/fx';
import { CAMP_KEYS, campfireKey } from '../art/sprites/camp';
import { hex, mix, PAL } from '../art/palette';
import { FONT } from '../art/PixelFont';
import { hud } from '../core/HudState';
import { Label } from '../ui/Label';
import { Prompt } from '../ui/Prompt';
import { WorldMap } from '../ui/WorldMap';
import { WEAPONS, type WeaponId } from '../data/weapons';
import { activeEvent } from '../data/events';
import { WINTER, winterActiveCount, winterLootMult } from '../data/winter';
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

const DECOR_TEXTURE: Record<string, string> = {
  fallenLog: SCENERY_KEYS.fallenLog,
  snowMound: SCENERY_KEYS.snowMound,
  deadShrub: SCENERY_KEYS.deadShrub,
  grassTuft: SCENERY_KEYS.grassTuft,
  bones: SCENERY_KEYS.bones,
  signpost: SCENERY_KEYS.signpost,
  oldFire: SCENERY_KEYS.oldFire,
  lampPost: SCENERY_KEYS.lampPost,
  stump: SCENERY_KEYS.stump,
  skull: SCENERY_KEYS.skull,
  iceCrack: SCENERY_KEYS.iceCrack,
  reeds: SCENERY_KEYS.reeds,
  glowShroom: SCENERY_KEYS.glowShroom,
  fence: SCENERY_KEYS.fence,
  tyre: SCENERY_KEYS.tyre,
  clawMarks: SCENERY_KEYS.clawMarks,
  rockSpire: SCENERY_KEYS.rockSpire,
};

/** Decor that lies on the ground and sorts under everything that walks. */
const FLAT_DECOR: DecorKind[] = ['grassTuft', 'bones', 'oldFire', 'iceCrack', 'clawMarks'];
/** Decor you cannot walk through, with the width of its footprint. */
const SOLID_DECOR: Partial<Record<DecorKind, number>> = { rockSpire: 10, fence: 14, lampPost: 5, stump: 9 };
/** Decor that is lit once the sun has gone. */
const LIT_DECOR: Partial<Record<DecorKind, number>> = { lampPost: 54, glowShroom: 30 };

interface WarmSpot {
  x: number;
  y: number;
  lit: boolean;
}

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
  private lighting!: Lighting;
  private dialogue!: Dialogue;
  private touch!: TouchControls;
  private canInteract = false;
  private caches: Cache[] = [];
  private notes: WorldNote[] = [];
  private gates: Gate[] = [];
  private mira: NPCMira | null = null;
  private bosses: Boss[] = [];
  private ranger: BossRanger | null = null;
  private towerX = 0;
  private towerY = 0;
  private subs = new Subscriptions();

  private mapData!: WorldMapData;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private ambient!: Phaser.GameObjects.Rectangle;
  private frostVignette!: Phaser.GameObjects.Image;
  private currentArea: AreaDef | null = null;
  private prompt!: Prompt;
  private worldMap!: WorldMap;
  private pickups: Pickup[] = [];
  private warmSpots: WarmSpot[] = [];
  private decorLights: Array<{ x: number; y: number; radius: number }> = [];
  private iceHazards = new Set<string>();
  private iceTimer = 0;
  private iceCooldownUntil = 0;
  private bossMusicOn = false;
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
    this.caches = [];
    this.notes = [];
    this.gates = [];
    this.mira = null;
    this.bosses = [];
    this.ranger = null;
    this.currentArea = null;
    this.canInteract = false;
    this.warmSpots = [];
    this.decorLights = [];
    this.iceHazards = new Set();
    this.iceTimer = 0;
    this.iceCooldownUntil = 0;

    this.mapData = generateWorld(seed);
    this.buildTilemap();
    this.buildHorizon();

    this.player = new Player(
      this,
      WORLD_SPAWN.x * TILE_SIZE + TILE_SIZE / 2,
      WORLD_SPAWN.y * TILE_SIZE + TILE_SIZE,
    );
    this.player.setMaxHp(ResourceSystem.maxHp(), false);
    // Health carries over from wherever you were. A fresh run starts with whatever the
    // fire gave you, not a free full bar.
    const carried = state.run.timeSec > 0 ? state.run.hp : state.player.hp;
    this.player.hp = Math.max(1, Math.min(carried, this.player.maxHp));
    state.run.cold = state.run.timeSec > 0 ? state.run.cold : state.player.cold;
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
    this.lighting = new Lighting(this);
    this.dialogue = new Dialogue(this);
    this.buildCaches();
    this.buildNotes();
    this.buildGates();
    this.buildInhabitants();
    this.buildPrompt();
    this.setupCamera();

    this.weather.setStorm(state.run.storm);
    const event = activeEvent(state.run.event);
    if (event.id === 'whiteout') {
      this.time.delayedCall(4000, () => {
        if (!this.ending) this.enemyManager.summonStalker(this.player.cx, this.player.cy);
      });
    }
    if (winterActiveCount() > 0 && state.run.timeSec < 1) {
      this.time.delayedCall(2400, () =>
        bus.emit('juice:toast', {
          text: `Deeper winter: +${Math.round((winterLootMult() - 1) * 100)}% on everything gathered.`,
          color: '#8b3cff',
        }),
      );
    }
    if (event.id !== 'clear' && state.run.timeSec < 1) {
      this.time.delayedCall(700, () => {
        this.announce(event.name);
        bus.emit('juice:toast', { text: event.report, color: '#2fd8ff' });
      });
    }

    this.touch = new TouchControls(this);

    if (!this.scene.isActive('HUD')) this.scene.launch('HUD');
    this.scene.bringToTop('HUD');

    this.subs.add(bus.on('settings:changed', () => this.touch.refreshSettings()));
    this.subs.add(bus.on('player:died', () => this.endDay('death')));
    this.subs.add(bus.on('hud:pause', () => this.openPause()));
    this.worldMap = new WorldMap(this);
    this.subs.add(bus.on('hud:map', () => {
      if (!WINTER.mapHidden()) this.worldMap.toggle();
    }));
    // Anything buffered while paused (the ESC that closed the menu) is dropped.
    this.events.on('resume', () => this.input$.flush());

    if (state.day === 1) {
      this.time.delayedCall(1500, () => this.hint('gather', 'Hit trees for wood. Bushes give food.'));
      this.time.delayedCall(9000, () =>
        this.hint('return', 'Be back at the camp zone before dark. Follow the orange dot.'),
      );
    }
    this.subs.add(
      bus.on('hud:slot', ({ slot }) => {
        if (this.ending || this.dialogue.isOpen) return;
        if (slot === 2) this.eat();
        else this.weapons.select((slot + 1) as 1 | 2);
      }),
    );
    this.subs.add(bus.on('enemy:killed', (e) => this.onEnemyKilled(e.type, e.x, e.y)));
    this.subs.add(bus.on('boss:defeated', ({ id }) => this.onBossDefeated(id)));
    this.subs.add(bus.on('enemy:seen', ({ type }) => this.markSeen(type)));
    this.subs.add(bus.on('boss:attempted', ({ id }) => this.markSeen(id)));
    this.subs.add(bus.on('player:hit', ({ damage }) => {
      if (state.run) state.run.damageTaken += damage;
    }));
    this.events.once('shutdown', () => this.cleanup());
    this.cameras.main.fadeIn(280, 0, 0, 0);
  }

  // --- world building ----------------------------------------------------

  private buildTilemap(): void {
    // Feather every seam at the pixel level, then build a tileset holding exactly the
    // transition tiles this map turned out to need.
    const builder = new TilesetBuilder();
    applyTransitions(this.mapData.kinds, this.mapData.tiles, builder, isSolidIndex);
    builder.build(this, 'tileset-world');

    const map = this.make.tilemap({
      data: this.mapData.tiles,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tileset = map.addTilesetImage('tiles', 'tileset-world', TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) throw new Error('[WorldScene] tileset could not be created');
    const layer = map.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error('[WorldScene] tile layer could not be created');
    this.layer = layer;
    this.layer.setCollision(SOLID_TILES);
    this.layer.setDepth(0);

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    // Clamp the view to what can actually be reached, so the edge of the map is never
    // on screen. What you can see is what you can walk to.
    const walk = this.mapData.walkable;
    this.cameras.main.setBounds(walk.x, walk.y, walk.width, walk.height);
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

    this.drawDecor(rng, solids);
    this.physics.add.collider(this.player.sprite, solids);
    this.scatterBreakables(seed, addPickup);

    for (const dy of [-3, 3]) {
      const px = (RETURN_ZONE.x1 + 1) * TILE_SIZE;
      const py = (WORLD_SPAWN.y + dy) * TILE_SIZE + TILE_SIZE;
      this.add.image(px, py, CAMP_KEYS.gatePost).setOrigin(0.5, 1).setScale(1.4).setDepth(py);
    }
  }

  /**
   * Scenery. Most of it is only there so the place feels inhabited, but some of it
   * does something: fire pits can be lit, lamps and mushrooms glow at night, thin
   * ice gives way, and the bigger things block the way.
   */
  private drawDecor(rng: Rng, solids: Phaser.Physics.Arcade.StaticGroup): void {
    for (const d of this.mapData.decor) {
      const key = DECOR_TEXTURE[d.kind];
      if (!key) continue;
      const x = d.tx * TILE_SIZE + TILE_SIZE / 2;
      const y = d.ty * TILE_SIZE + TILE_SIZE;
      const fixedScale = d.kind === 'lampPost' || d.kind === 'fence' || d.kind === 'iceCrack';
      const scale = fixedScale ? 1.2 : rng.range(0.9, 1.3);

      // Flat things sit under the player; standing things sort with everything else.
      const flat = FLAT_DECOR.includes(d.kind);
      if (!flat) {
        this.add
          .ellipse(x, y - 1, Math.round(16 * scale), Math.round(5 * scale), hex(PAL.blue))
          .setAlpha(0.22)
          .setDepth(y - 2);
      }

      const img = this.add
        .image(x, y, key)
        .setOrigin(0.5, 1)
        .setScale(scale)
        .setFlipX(!fixedScale && rng.chance(0.5))
        .setDepth(flat ? 2 : y);

      const solidW = SOLID_DECOR[d.kind];
      if (solidW) {
        const blocker = solids.create(x, y - 3, 'fx-dot1') as Phaser.Physics.Arcade.Sprite;
        blocker.setVisible(false).setOrigin(0.5, 0.5);
        const body = blocker.body as Phaser.Physics.Arcade.StaticBody;
        const w = Math.round(solidW * scale);
        body.setSize(w, 6);
        body.position.set(x - w / 2, y - 6);
        body.updateCenter();
      }

      const lit = LIT_DECOR[d.kind];
      if (lit) {
        const top = y - img.displayHeight + 4;
        this.decorLights.push({ x, y: d.kind === 'lampPost' ? top : y - 3, radius: lit });
        const glow = this.add
          .image(x, d.kind === 'lampPost' ? top : y - 3, 'fx-glow-md')
          .setTint(hex(d.kind === 'lampPost' ? PAL.gold : PAL.cyan))
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(d.kind === 'lampPost' ? 0.3 : 0.4)
          .setScale(d.kind === 'lampPost' ? 0.9 : 0.5)
          .setDepth(y - 1);
        this.tweens.add({
          targets: glow,
          alpha: glow.alpha * 1.5,
          duration: 900 + rng.int(0, 600),
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

      if (d.kind === 'oldFire') this.warmSpots.push({ x, y: y - 4, lit: false });
      if (d.kind === 'iceCrack') this.iceHazards.add(`${d.tx},${d.ty}`);
    }
  }

  /** Two wood, and an old fire pit is a fire again for the rest of the day. */
  private lightWarmSpot(spot: WarmSpot): void {
    const run = state.run;
    if (!run) return;
    const cost = BAL.warmSpot.woodCost;
    if ((run.collected.wood ?? 0) < cost) {
      bus.emit('juice:toast', { text: `Needs ${cost} wood.`, color: PAL.grey });
      bus.emit('audio:play', { cue: 'empty' });
      return;
    }
    run.collected.wood -= cost;
    spot.lit = true;

    const fire = this.add
      .sprite(spot.x, spot.y + 4, campfireKey(state.player.cosmetics.fireColor))
      .setOrigin(0.5, 1)
      .setScale(1.1)
      .setDepth(spot.y + 4);
    fire.play(`${campfireKey(state.player.cosmetics.fireColor)}_burn`);
    const glow = this.add
      .image(spot.x, spot.y - 4, 'fx-glow-lg')
      .setTint(hex(PAL.orange))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.35)
      .setScale(0.8)
      .setDepth(spot.y - 1);
    this.tweens.add({
      targets: glow,
      alpha: 0.5,
      scale: 0.9,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.juice.sparks(spot.x, spot.y - 4, PAL.gold, 14, 120);
    bus.emit('audio:play', { cue: 'warm' });
    bus.emit('juice:toast', { text: 'The fire takes. Warm here until dark.', color: PAL.gold });
    this.hint('warmspot', 'Cold drains off beside any lit fire.');
  }

  private nearLitFire(): boolean {
    const r = BAL.warmSpot.radius;
    for (const s of this.warmSpots) {
      if (!s.lit) continue;
      if (Math.hypot(s.x - this.player.cx, s.y - this.player.cy) < r) return true;
    }
    return false;
  }

  /** Thin ice: linger on a crack and it gives, and the water is very cold. */
  private updateThinIce(dt: number): void {
    if (this.iceHazards.size === 0 || !state.run) return;
    const tx = Math.floor(this.player.cx / TILE_SIZE);
    const ty = Math.floor(this.player.cy / TILE_SIZE);
    const onCrack = this.iceHazards.has(`${tx},${ty}`) && this.time.now > this.iceCooldownUntil;

    if (!onCrack) {
      this.iceTimer = Math.max(0, this.iceTimer - dt * 2);
      return;
    }
    this.iceTimer += dt;
    if (this.iceTimer < BAL.thinIce.breakAfterMs) return;

    this.iceTimer = 0;
    this.iceCooldownUntil = this.time.now + BAL.thinIce.cooldownMs;
    state.run.cold = Math.min(BAL.cold.max, state.run.cold + BAL.thinIce.coldSpike);
    this.juice.ring(this.player.cx, this.player.cy, PAL.ice, 34, 320);
    this.juice.sparks(this.player.cx, this.player.cy, PAL.cyan, 12, 110);
    this.juice.floatText(this.player.cx, this.player.sprite.y - 24, 'THE ICE GIVES', PAL.ice);
    bus.emit('juice:shake', { intensity: 0.006, ms: 180 });
    bus.emit('audio:play', { cue: 'smash' });
    this.hint('thinice', 'Cracked ice breaks if you stand on it. Keep moving.');
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

  /** Hand-placed caches. Everything the player needs to find is one of these. */
  private buildCaches(): void {
    for (const def of CACHES) {
      if (def.area === 'secret' && !state.map.secretFound) continue;
      this.caches.push(
        new Cache(
          this,
          def,
          def.tx * TILE_SIZE + TILE_SIZE / 2,
          def.ty * TILE_SIZE + TILE_SIZE,
          this.juice,
          (name, rarity) => this.onWeaponFound(name, rarity),
        ),
      );
    }
  }

  private buildNotes(): void {
    for (const def of NOTE_LIST) {
      if (def.area === 'secret' && !state.map.secretFound) continue;
      this.notes.push(
        new WorldNote(this, def, def.tx * TILE_SIZE + TILE_SIZE / 2, def.ty * TILE_SIZE + TILE_SIZE),
      );
    }
  }

  private buildGates(): void {
    for (const id of GATE_IDS) this.gates.push(new Gate(this, id, this.layer, this.juice));
  }

  /** The Alpha guards the cabin, Mira is inside it, and the Maw waits in the den. */
  private buildInhabitants(): void {
    if (!state.bosses.alphaDefeated) {
      const alpha = this.enemyManager.spawn('alpha', 68 * TILE_SIZE, 18 * TILE_SIZE);
      alpha.sprite.setScale(1.7);
    }

    if (!state.story.miraRescued) {
      this.mira = new NPCMira(this, 64 * TILE_SIZE, 22 * TILE_SIZE, 'field');
    }

    if (!state.bosses.mawDefeated) {
      const maw = new BossWhiteMaw(
        this,
        88 * TILE_SIZE,
        44 * TILE_SIZE,
        this.player,
        this.juice,
        (x, y, count) => {
          for (let i = 0; i < count; i++) {
            this.enemyManager.spawn(
              'rat',
              x + Phaser.Math.Between(-30, 30),
              y + Phaser.Math.Between(-24, 24),
            );
          }
        },
      );
      this.bosses.push(maw);
      this.physics.add.collider(maw.sprite, this.layer);
    }

    this.buildTower();

    // The second boss paces the tower pass, past the ice the gate breaks through.
    if (!state.bosses.stagDefeated) {
      const stag = new BossHollowStag(this, 92 * TILE_SIZE, 20 * TILE_SIZE, this.player, this.juice);
      this.bosses.push(stag);
      this.physics.add.collider(stag.sprite, this.layer);
    }
    // The third only once Mira has said where to look, and only after dark.
    if (state.story.rangerTold && !state.bosses.rangerDefeated) {
      this.ranger = new BossRanger(this, 72 * TILE_SIZE, 22 * TILE_SIZE, this.player, this.juice, (x, y, count) => {
        const nearby = this.enemyManager.enemies.filter(
          (e) => e.alive && e.def.id === 'walker' && Math.hypot(e.cx - x, e.cy - y) < 260,
        ).length;
        for (let i = 0; i < Math.max(0, Math.min(count, 4 - nearby)); i++) {
          const a = Math.random() * Math.PI * 2;
          this.enemyManager.spawn('walker', x + Math.cos(a) * 150, y + Math.sin(a) * 110);
        }
      });
      this.bosses.push(this.ranger);
      this.physics.add.collider(this.ranger.sprite, this.layer);
    }
    this.combat.bosses = this.bosses;
    this.bossMusicOn = false;
  }

  /**
   * The tower itself, at the top of the pass. It is on the horizon from day one and
   * it is a place you can stand under from day one; the stair only opens once the
   * radio has answered.
   */
  private buildTower(): void {
    const x = 93 * TILE_SIZE + 8;
    const y = 10 * TILE_SIZE + TILE_SIZE;
    this.towerX = x;
    this.towerY = y - 20;

    this.add.ellipse(x, y - 2, 54, 16, hex(PAL.blue)).setAlpha(0.3).setDepth(y - 2);
    this.add.image(x, y, SCENERY_KEYS.tower).setOrigin(0.5, 1).setScale(4).setDepth(y);

    const blink = this.add.rectangle(x, y - 42, 3, 3, hex(PAL.blood)).setDepth(y + 1);
    this.tweens.add({ targets: blink, alpha: 0, duration: 340, yoyo: true, repeat: -1, repeatDelay: 1500 });

    const glow = this.add
      .image(x, y - 26, FX.glowMed)
      .setTint(hex(PAL.cyan))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.22)
      .setDepth(y - 1);
    this.tweens.add({
      targets: glow,
      alpha: 0.4,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private climbTower(): void {
    if (this.ending) return;
    this.ending = true;
    SaveSystem.save();
    bus.emit('audio:play', { cue: 'discover' });
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.time.delayedCall(760, () => {
      this.scene.stop('HUD');
      this.scene.start('Ending');
    });
  }

  private onWeaponFound(name: string, rarity: string): void {
    bus.emit('juice:toast', {
      text: `${name.toUpperCase()} found.`,
      color: RARITY_COLOR[rarity as keyof typeof RARITY_COLOR],
    });
    this.juice.floatText(
      this.player.cx,
      this.player.sprite.y - 34,
      name.toUpperCase(),
      RARITY_COLOR[rarity as keyof typeof RARITY_COLOR],
      1.3,
    );
    bus.emit('juice:shake', { intensity: 4, ms: 180 });
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

    this.frostVignette = this.add
      .image(width / 2, height / 2, 'fx-glow-xl')
      .setScrollFactor(0)
      .setTint(hex(PAL.cyan))
      .setAlpha(0)
      .setScale(3)
      .setDepth(5020);
  }

  private buildPrompt(): void {
    this.prompt = new Prompt(this);
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
    if (input.menuPressed) {
      if (this.worldMap.visible) this.worldMap.hide();
      else this.openPause();
      return;
    }
    if (input.mapPressed && !WINTER.mapHidden()) this.worldMap.toggle();
    if (input.mapPressed && WINTER.mapHidden()) bus.emit('juice:toast', { text: 'No map this winter.', color: PAL.grey });
    this.worldMap.update(this.player.cx, this.player.cy);
    if (input.swapPressed) this.weapons.swap();
    if (input.slotPressed) this.weapons.select(input.slotPressed);
    if (input.eatPressed) this.eat();

    this.enemyManager.update(dt, this.player.cx, this.player.cy);
    this.ranger?.setNight(this.clock.isNight);
    for (const boss of this.bosses) boss.update(dt);
    this.updateBossMusic();
    this.combat.update();
    this.enemyManager.sweep();
    this.enemyManager.setNight(this.clock.isNight, this.player.cx, this.player.cy);

    this.updatePickups(dt);
    this.updateArea();
    this.updateClockAndCold(dt);
    this.updateInteraction(input.interactPressed);
    this.updateHud();
    if (this.player.hp < this.player.maxHp * 0.6 && (state.run?.collected.food ?? 0) > 0) {
      this.hint('eat', 'Hurt? F eats food. On touch, tap the food slot.');
    }
    this.touch.update(this.canInteract, !!state.player.equipped[1], (state.run?.collected.food ?? 0) > 0);

    this.weather.update(dt, Math.max(this.currentArea?.id === 'lake' ? 0.5 : 0.18, activeEvent(state.run?.event).fog));
    this.weather.setNight(this.clock.darkness);
    this.lighting.update(_time, this.clock.darkness, this.collectLights());
    audio.setWindIntensity(this.clock.darkness + (state.run?.storm ? 0.4 : 0));

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

    if (state.run) {
      state.run.hp = this.player.hp;
      state.player.hp = this.player.hp;
      state.player.cold = state.run.cold;
    }
  }

  private lastEatAt = -9999;

  /**
   * Eat one food from the run's haul. This is the answer to being hurt out in the
   * open: it costs something you were going to bank, so it is a real trade.
   */
  /** A one-time toast, remembered in the save so it never nags. */
  private hint(id: string, text: string): void {
    if (state.story.hints.includes(id)) return;
    state.story.hints.push(id);
    bus.emit('juice:toast', { text, color: PAL.cyan });
  }

  private openPause(): void {
    if (this.ending || this.dialogue.isOpen) return;
    if (this.scene.isActive('Pause')) return;
    this.input$.flush();
    this.scene.launch('Pause');
    this.scene.bringToTop('Pause');
  }

  private eat(): void {
    const run = state.run;
    if (!run) return;
    const now = this.time.now;
    if (now - this.lastEatAt < BAL.eat.cooldown * 1000) return;

    if ((run.collected.food ?? 0) <= 0) {
      bus.emit('juice:toast', { text: 'Nothing to eat. Bushes and rats carry food.', color: '#a8b8dc' });
      bus.emit('audio:play', { cue: 'empty', volume: 0.5 });
      return;
    }
    if (this.player.hp >= this.player.maxHp && this.cold.cold < 10) {
      bus.emit('juice:toast', { text: 'You are not hungry.', color: '#a8b8dc' });
      return;
    }

    this.lastEatAt = now;
    run.collected.food -= 1;
    const heal = ResourceSystem.campEffects().foodHeal;
    this.player.heal(heal, 'food');
    this.cold.relieve(BAL.cold.foodRelief);
    this.juice.floatText(this.player.cx, this.player.sprite.y - 26, `+${heal}`, PAL.green);
    this.juice.sparks(this.player.cx, this.player.cy - 6, PAL.green, 6, 60);
    bus.emit('audio:play', { cue: 'eat' });
    bus.emit('consumable:used', { id: 'ration' });
  }

  /** Drops are rolled here rather than in the enemy, so loot rules live in one place. */
  private onEnemyKilled(type: string, x: number, y: number): void {
    if (state.run) state.run.kills++;
    state.stats.enemiesKilled[type] = (state.stats.enemiesKilled[type] ?? 0) + 1;

    if (type === 'alpha' && !state.bosses.alphaDefeated) {
      state.bosses.alphaDefeated = true;
      bus.emit('juice:toast', {
        text: 'The cabin is quiet now. Something is moving inside it.',
        color: '#ffcf1f',
      });
    }

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

  /** What is still lit once the sun has gone. */
  private collectLights(): Array<{ x: number; y: number; radius: number }> {
    const lights: Array<{ x: number; y: number; radius: number }> = [];
    const carried = ResourceSystem.campEffects().playerLightMult * WINTER.lightMult();
    lights.push({ x: this.player.cx, y: this.player.cy, radius: 66 * carried });
    for (const l of this.decorLights) lights.push(l);
    for (const s of this.warmSpots) {
      if (s.lit) lights.push({ x: s.x, y: s.y, radius: BAL.warmSpot.lightRadius });
    }
    const lantern = this.ranger?.light;
    if (lantern) lights.push(lantern);

    // Home always shows, so the way back is never guesswork.
    lights.push({
      x: WORLD_SPAWN.x * TILE_SIZE,
      y: WORLD_SPAWN.y * TILE_SIZE,
      radius: 90,
    });

    // Crystal spires and unopened caches are the only other things that glow.
    for (const cache of this.caches) {
      if (cache.isOpen) continue;
      if (Math.abs(cache.cx - this.player.cx) > 320) continue;
      if (Math.abs(cache.cy - this.player.cy) > 220) continue;
      lights.push({ x: cache.cx, y: cache.cy, radius: 46 });
    }
    return lights;
  }

  /** Killing the Maw is the closing beat of this version. */
  private onBossDefeated(id: string): void {
    if (id === 'stag') {
      this.onStagDefeated();
      return;
    }
    if (id === 'ranger') {
      this.onRangerDefeated();
      return;
    }
    state.bosses.mawDefeated = true;
    UpgradeSystem.award('trophy');
    this.dropBossWeapon('hammer', 'maw');
    const night = this.clock.bountyActive;
    ResourceSystem.collect('scrap', 40, night);
    ResourceSystem.collect('crystal', 5, night);
    ResourceSystem.collect('medical', 2, night);
    if (state.run) state.run.rareFinds += 2;

    bus.emit('juice:toast', { text: 'The White Maw is dead.', color: '#ffffff' });
    this.time.delayedCall(1400, () => {
      this.dialogue.show(
        [
          'It takes a long time to stop moving.',
          'Around its neck, under the fur, there is a collar. Cut, not broken.',
          'Somebody let this out on purpose.',
        ],
        'The Den',
      );
    });
  }

  private markSeen(type: string): void {
    if (state.stats.enemiesSeen.includes(type)) return;
    state.stats.enemiesSeen.push(type);
  }

  /** A boss drops the one weapon nothing else does. */
  private dropBossWeapon(base: WeaponId, bossId: string): void {
    if (state.player.weapons.some((w) => w.base === base)) return;
    const weapon = LootSystem.makeWeapon(base, 'rare', new Rng(hashString(`${bossId}:${state.day}`)));
    LootSystem.takeWeapon(weapon);
    this.onWeaponFound(WEAPONS[base].name, 'rare');
  }

  private onRangerDefeated(): void {
    state.bosses.rangerDefeated = true;
    UpgradeSystem.award('lantern');
    const night = this.clock.bountyActive;
    ResourceSystem.collect('medical', 4, night);
    ResourceSystem.collect('scrap', 20, night);
    ResourceSystem.collect('food', 10, night);
    if (state.run) state.run.rareFinds += 2;

    bus.emit('juice:toast', { text: 'The lantern goes out for good.', color: '#ffcf1f' });
    this.time.delayedCall(1400, () => {
      this.dialogue.show(
        [
          'The coat is a ranger coat. The name tape has been picked off.',
          'In the pocket, a rope, cut to the length of a wrist, and a list of eleven names.',
          'The twelfth line says only: and me, when they come back.',
        ],
        'The Cabin',
      );
    });
  }

  private onStagDefeated(): void {
    state.bosses.stagDefeated = true;
    this.dropBossWeapon('antler', 'stag');
    const night = this.clock.bountyActive;
    ResourceSystem.collect('crystal', 12, night);
    ResourceSystem.collect('medical', 3, night);
    ResourceSystem.collect('scrap', 25, night);
    if (state.run) state.run.rareFinds += 2;

    bus.emit('juice:toast', { text: 'The Hollow Stag comes apart.', color: '#7bf3ff' });
    this.time.delayedCall(1400, () => {
      this.dialogue.show(
        [
          'The ice in it goes dull as it falls. Under the frost, the bones are old.',
          'Something tied a strip of orange cloth round one antler. The same cloth as the tower.',
          'Whoever climbed it wanted this thing kept here. Or kept out.',
        ],
        'The Pass',
      );
    });
  }

  /** The boss you are nearest to, if you are in its fight. */
  private nearBoss(): Boss | null {
    let best: Boss | null = null;
    let bestDist = 260;
    for (const boss of this.bosses) {
      if (!boss.alive) continue;
      const d = Math.hypot(boss.cx - this.player.cx, boss.cy - this.player.cy);
      if (d < bestDist) {
        best = boss;
        bestDist = d;
      }
    }
    return best;
  }

  /** The music changes when a den does, and counts the attempt. */
  private updateBossMusic(): void {
    const boss = this.nearBoss();
    hud.mapHidden = WINTER.mapHidden();
    hud.bossName = boss ? boss.name : null;
    hud.bossHp = boss ? boss.hp : 0;
    hud.bossMaxHp = boss ? boss.maxHp : 1;

    if (boss && !this.bossMusicOn) {
      this.bossMusicOn = true;
      if (boss.id === 'maw') state.bosses.mawAttempts++;
      else if (boss.id === 'stag') state.bosses.stagAttempts++;
      else state.bosses.rangerAttempts++;
      bus.emit('boss:attempted', { id: boss.id });
      bus.emit('audio:music', { cue: 'boss' });
    } else if (!boss && this.bossMusicOn) {
      this.bossMusicOn = false;
      bus.emit('audio:music', { cue: null });
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
      nearHome || this.nearLitFire() ? 'fire' : 'none',
    );
    this.updateThinIce(dt);
    if (damage > 0) this.player.hp = Math.max(0, this.player.hp - damage);
    if (this.player.hp <= 0 && !this.ending) this.endDay('death');

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
    const label = new Label(this, Math.round(width / 2), Math.round(height / 2) - 30, name.toUpperCase(), {
      color: PAL.white,
      scale: 2,
      originX: 0.5,
      originY: 0.5,
    })
      .setScrollFactor(0)
      .setDepth(7600)
      .setAlpha(0);

    this.tweens.add({
      targets: label.target,
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

    // A reading panel swallows the key, so E never does two things at once.
    if (this.dialogue.isOpen) {
      this.prompt.hide();
      if (pressed) this.dialogue.advance();
      return;
    }

    if (this.mira && this.mira.inRange(this.player.cx, this.player.cy) && this.mira.prompt) {
      this.showPrompt(this.mira.prompt);
      if (pressed) {
        const lines = this.mira.interact();
        if (lines.length) this.dialogue.show(lines, 'Mira');
      }
      return;
    }

    for (const note of this.notes) {
      if (!note.inRange(this.player.cx, this.player.cy)) continue;
      this.showPrompt('Read');
      if (pressed) {
        const def = note.take();
        this.dialogue.show(def.body.split('\n'), def.title);
      }
      return;
    }

    for (const gate of this.gates) {
      if (!gate.inRange(this.player.cx, this.player.cy)) continue;
      this.showPrompt(gate.prompt);
      if (pressed) {
        const message = gate.strike();
        if (message) this.dialogue.show([message]);
      }
      return;
    }

    for (const cache of this.caches) {
      if (!cache.inRange(this.player.cx, this.player.cy)) continue;
      this.showPrompt(cache.prompt);
      if (pressed) {
        const flavour = cache.open();
        if (flavour) bus.emit('juice:toast', { text: flavour, color: '#fff3ce' });
      }
      return;
    }

    if (
      state.story.towerOpen &&
      !state.story.ending &&
      Math.hypot(this.towerX - this.player.cx, this.towerY - this.player.cy) < 34
    ) {
      this.showPrompt('Climb the tower');
      if (pressed) this.climbTower();
      return;
    }

    for (const spot of this.warmSpots) {
      if (spot.lit) continue;
      if (Math.hypot(spot.x - this.player.cx, spot.y - this.player.cy) > 22) continue;
      this.showPrompt(`Light fire (${BAL.warmSpot.woodCost} wood)`);
      if (pressed) this.lightWarmSpot(spot);
      return;
    }

    if (rectContains(RETURN_ZONE, tx, ty)) {
      this.showPrompt('Return to camp');
      if (pressed) this.endDay('return');
      return;
    }
    this.canInteract = false;
    this.prompt.hide();
  }

  private showPrompt(verb: string): void {
    this.canInteract = !!verb;
    if (!verb) {
      this.prompt.hide();
      return;
    }
    this.prompt.show(verb, this.player.cx, this.player.sprite.y - 30);
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
    this.worldMap?.destroy();
    this.subs.dispose();
    for (const p of this.pickups) p.destroy();
    this.pickups = [];
    for (const c of this.caches) c.destroy();
    for (const n of this.notes) n.destroy();
    this.caches = [];
    this.notes = [];
    this.mira?.destroy();
    for (const boss of this.bosses) boss.destroy();
    this.bosses = [];
    this.dialogue?.close();
    this.lighting?.destroy();
    this.enemyManager?.destroy();
    this.weapons?.destroy();
    this.weather?.destroy();
    this.juice?.destroy();
    this.player?.destroy();
    this.registry.remove('player');
  }
}
