import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { bus, Subscriptions } from '../core/EventBus';
import { newRunState, state } from '../core/GameState';
import { SaveSystem } from '../core/SaveSystem';
import { InputSystem } from '../core/InputSystem';
import { Player } from '../entities/Player';
import { Juice } from '../systems/Juice';
import { Weather } from '../systems/Weather';
import { ResourceSystem } from '../systems/ResourceSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { CampSystem, type CampPlacement, type StationId } from '../systems/CampSystem';
import { SOLID_TILES, TILE, TILE_SIZE } from '../art/sprites/tiles';
import { TilesetBuilder, applyTransitions } from '../art/sprites/transitions';
import { isSolidIndex } from '../systems/MapGen';
import { SCENERY_KEYS } from '../art/sprites/scenery';
import { campfireKey, fireGlowName, PORTAL_FRAME_KEYS } from '../art/sprites/camp';
import { FX } from '../art/sprites/fx';
import { hex, PAL } from '../art/palette';
import { FONT } from '../art/PixelFont';
import { Rng } from '../core/Rng';
import { hud, resetHud } from '../core/HudState';
import { Label } from '../ui/Label';
import { Prompt } from '../ui/Prompt';
import { drawFrame } from '../ui/Frame';
import { NPCMira } from '../entities/NPCMira';
import { Pup } from '../entities/Pup';
import { Dialogue } from '../ui/Dialogue';
import { TouchControls } from '../ui/TouchControls';
import { MIRA, NOTE_LIST } from '../data/story';
import { pactHand, type PactId } from '../data/pacts';
import type { ResourceId } from '../data/resources';
import { eventForDay } from '../data/events';
import { traderToday } from '../data/trader';

interface Station {
  id: StationId;
  x: number;
  y: number;
  radius: number;
  label: string;
}

/**
 * The camp. Warm, small and safe: the emotional opposite of the map. Everything bought
 * in the menu appears here on the ground, so progress is something you walk past.
 */
export class CampScene extends Phaser.Scene {
  private input$!: InputSystem;
  private player!: Player;
  private juice!: Juice;
  private weather!: Weather;
  private subs = new Subscriptions();

  private layer!: Phaser.Tilemaps.TilemapLayer;
  private campLayer!: Phaser.GameObjects.Container;
  private lightLayer!: Phaser.GameObjects.Container;
  private stations: Station[] = [];
  private prompt!: Prompt;
  private dialogue!: Dialogue;
  private touch!: TouchControls;
  private mira: NPCMira | null = null;
  private pup: Pup | null = null;
  private cold = 0;
  private fireX = 15 * TILE_SIZE + 8;
  private fireY = 12 * TILE_SIZE;
  private portalX = 0;
  private portalY = 0;
  private portalFrame = 0;
  private leaving = false;

  constructor() {
    super('Camp');
  }

  create(): void {
    // Scene instances are reused, so anything that changes during a visit starts
    // over here. `leaving` in particular: left true, the portal never fires again.
    this.leaving = false;
    this.pactPanel = null;
    this.pactHandToday = [];
    this.pendingRematch = null;
    this.portalFrame = 0;
    this.stations = [];
    this.mira = null;

    state.run = null;
    resetHud();
    hud.context = 'camp';
    UpgradeSystem.refreshCampLevel();
    SaveSystem.save();

    this.buildGround();
    this.buildTreeline();

    this.campLayer = this.add.container(0, 0);
    this.lightLayer = this.add.container(0, 0);

    this.player = new Player(this, 15 * TILE_SIZE + 8, 16 * TILE_SIZE);
    // You come home as you left the wilderness. The fire does the rest, slowly.
    this.player.setMaxHp(ResourceSystem.maxHp(), false);
    this.player.hp = Math.max(1, Math.min(state.player.hp, this.player.maxHp));
    this.cold = Math.max(0, Math.min(BAL.cold.max, state.player.cold));
    this.physics.add.collider(this.player.sprite, this.layer);

    this.rebuildCamp();

    this.input$ = new InputSystem(this);
    this.juice = new Juice(this);
    this.weather = new Weather(this);

    this.buildAmbient();
    this.dialogue = new Dialogue(this);
    this.prompt = new Prompt(this);

    const cam = this.cameras.main;
    cam.startFollow(this.player.sprite, true, 0.1, 0.1);
    cam.setBounds(0, 0, BAL.camp.cols * TILE_SIZE, BAL.camp.rows * TILE_SIZE);
    cam.setBackgroundColor(PAL.navy);
    cam.fadeIn(320, 0, 0, 0);

    this.touch = new TouchControls(this);
    this.subs.add(bus.on('settings:changed', () => this.touch.refreshSettings()));
    this.subs.add(
      bus.on('hud:slot', ({ slot }) => {
        if (slot === 2) {
          this.juice.floatText(this.player.cx, this.player.sprite.y - 24, 'Save it for the trail', PAL.grey);
          return;
        }
        if (!state.player.equipped[slot] || state.player.activeSlot === slot) return;
        state.player.activeSlot = slot as 0 | 1;
        bus.emit('audio:play', { cue: 'swap' });
      }),
    );

    if (!this.scene.isActive('HUD')) this.scene.launch('HUD');
    this.scene.bringToTop('HUD');

    bus.emit('audio:music', { cue: 'camp' });
    this.showMorningReport();
    this.greetReturn();
    this.events.once('shutdown', () => this.cleanup());
  }

  // --- ground ------------------------------------------------------------

  private buildGround(): void {
    const { cols, rows } = BAL.camp;
    const rng = new Rng(7);
    const data: number[][] = [];
    const kinds: Array<Array<string | null>> = [];

    for (let y = 0; y < rows; y++) {
      const row: number[] = [];
      const kindRow: Array<string | null> = [];
      for (let x = 0; x < cols; x++) {
        if (x < 2 || y < 2 || x >= cols - 2 || y >= rows - 2) {
          row.push(TILE.CLIFF);
          kindRow.push(null);
          continue;
        }
        // Trodden ground only where people actually walk: a ragged patch round the fire.
        const dist = Math.hypot((x - 15) * 0.85, y - 12);
        const ragged =
          dist + Math.sin(x * 0.9) * 0.8 + Math.cos(y * 1.3 + x * 0.4) * 0.7 + rng.range(-0.4, 0.4);
        // One clean edge. Scattering trodden tiles through a band put a seam on
        // nearly every tile and the feathering turned the whole yard into a maze.
        // The wobble in `ragged` is what keeps the edge from being a circle.
        if (ragged < 7.2) {
          row.push(rng.pick([TILE.CAMP_A, TILE.CAMP_A, TILE.CAMP_B]));
          kindRow.push('camp');
        } else {
          row.push(rng.pick([TILE.SNOW_A, TILE.SNOW_A, TILE.SNOW_B, TILE.SNOW_C]));
          kindRow.push('snow');
        }
      }
      data.push(row);
      kinds.push(kindRow);
    }

    // Snow caps only where a wall actually faces the camera.
    for (let y = 0; y < rows - 1; y++) {
      for (let x = 0; x < cols; x++) {
        if (data[y][x] === TILE.CLIFF && data[y + 1][x] !== TILE.CLIFF) {
          data[y][x] = TILE.CLIFF_TOP;
        }
      }
    }

    const builder = new TilesetBuilder();
    applyTransitions(kinds, data, builder, isSolidIndex);
    builder.build(this, 'tileset-camp');

    const map = this.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage('tiles', 'tileset-camp', TILE_SIZE, TILE_SIZE, 0, 0);
    const layer = map.createLayer(0, tileset!, 0, 0);
    if (!layer) throw new Error('[CampScene] tile layer could not be created');
    this.layer = layer;
    this.layer.setCollision(SOLID_TILES);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  }

  private buildTreeline(): void {
    const rng = new Rng(11);
    for (let i = 0; i < 18; i++) {
      const edge = rng.int(0, 3);
      const x = edge < 2 ? rng.int(2, 28) : edge === 2 ? rng.int(2, 5) : rng.int(25, 28);
      const y = edge < 2 ? (edge === 0 ? rng.int(2, 4) : rng.int(16, 18)) : rng.int(2, 18);
      if (Math.hypot(x - 15, y - 12) < 10) continue;
      // Nothing leaning over the portal.
      if (Math.hypot(x - 26, y - 13) < 4.5) continue;
      const px = x * TILE_SIZE + 8;
      const py = y * TILE_SIZE + TILE_SIZE;
      this.add
        .ellipse(px, py - 1, 22, 7, hex(PAL.blue))
        .setAlpha(0.28)
        .setDepth(py - 2);
      this.add
        .image(px, py, rng.chance(0.3) ? SCENERY_KEYS.pineSmall : SCENERY_KEYS.pine)
        .setOrigin(0.5, 1)
        .setScale(1.3)
        .setDepth(py);
    }
  }

  // --- the camp itself ---------------------------------------------------

  /** Rebuilt whenever something is bought, so a purchase changes the view at once. */
  rebuildCamp(): void {
    this.campLayer.removeAll(true);
    this.lightLayer.removeAll(true);
    this.stations = [];

    for (const p of CampSystem.placements()) this.place(p);

    for (const light of CampSystem.lightSources()) {
      const glow = this.add
        .image(light.tx * TILE_SIZE + 8, light.ty * TILE_SIZE, FX.glowLarge)
        .setTint(hex((PAL as Record<string, string>)[fireGlowName(state.player.cosmetics.fireColor)] ?? PAL.orange))
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(light.intensity)
        .setScale(light.radius / 80)
        .setDepth(4990);
      this.lightLayer.add(glow);
      this.tweens.add({
        targets: glow,
        alpha: light.intensity * 1.35,
        scale: (light.radius / 80) * 1.12,
        duration: 820 + light.tx * 37,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // The pup sleeps by the fire.
    this.pup?.destroy();
    this.pup = null;
    if (state.story.pupFound) {
      this.pup = new Pup(this, 17 * TILE_SIZE + 4, 13 * TILE_SIZE + 6, null);
      this.stations.push({ id: 'pup', x: this.pup.cx, y: this.pup.cy, radius: 22, label: STATION_LABEL.pup });
    }

    // Mira lives here once she is out of the cabin. The camp stops being empty.
    this.mira?.destroy();
    this.mira = null;
    if (state.story.miraRescued) {
      // Where she stands says what she is doing: the treeline for wood, the snares
      // by the grass for food, the barrels for scrap, the fire when she is coming
      // out with you or has nothing on.
      const job = state.story.miraFollows ? null : state.story.miraAssignment;
      const spot =
        job === 'wood' ? { tx: 9, ty: 11 } : job === 'food' ? { tx: 23, ty: 16 } : job === 'scrap' ? { tx: 21, ty: 15 } : { tx: 13, ty: 13 };
      this.mira = new NPCMira(this, spot.tx * TILE_SIZE + 8, spot.ty * TILE_SIZE, 'camp');
      if (job) this.mira.setWorking(true);
      this.stations.push({
        id: 'mira',
        x: this.mira.cx,
        y: this.mira.cy,
        radius: 28,
        label: STATION_LABEL.mira,
      });
    }

  }

  private place(p: CampPlacement): void {
    const x = p.tx * TILE_SIZE + 8;
    const y = p.ty * TILE_SIZE + TILE_SIZE;
    const depth = p.behind ? 1 : y;

    if (p.key === 'portal') {
      this.placePortal(x, y, p.scale);
      return;
    }

    let obj: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
    if (p.key === 'campfire') {
      const fireKey = campfireKey(state.player.cosmetics.fireColor);
      obj = this.add.sprite(x, y, fireKey).play(`${fireKey}_burn`);
      const embers = this.add.particles(x, y - 6, FX.dot1, {
        speedY: { min: -34, max: -14 },
        speedX: { min: -9, max: 9 },
        lifespan: { min: 900, max: 1700 },
        scale: { min: 0.8, max: 1.6 },
        alpha: { start: 0.9, end: 0 },
        tint: emberTints(state.player.cosmetics.fireColor),
        frequency: 160,
        blendMode: Phaser.BlendModes.ADD,
      });
      embers.setDepth(y + 1);
      this.campLayer.add(embers);
    } else {
      obj = this.add.image(x, y, p.key);
    }

    obj.setOrigin(0.5, 1).setScale(p.scale).setDepth(depth).setFlipX(!!p.flip);
    this.campLayer.add(obj);

    if (p.station) {
      this.stations.push({
        id: p.station,
        x,
        y: y - obj.displayHeight * 0.4,
        radius: 26,
        label: STATION_LABEL[p.station],
      });
    }
  }

  /**
   * The way out. It is a thing you walk into, not a thing you press a key at, so
   * heading out feels like a decision made with your feet.
   */
  private placePortal(x: number, y: number, scale: number): void {
    const centreY = y - 12 * scale;
    this.portalX = x;
    this.portalY = centreY;

    const glow = this.add
      .image(x, centreY, FX.glowMed)
      .setTint(hex(PAL.violet))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.55)
      .setScale(1.1)
      .setDepth(y - 1);
    this.campLayer.add(glow);
    this.tweens.add({
      targets: glow,
      alpha: 0.85,
      scale: 1.3,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const swirl = this.add
      .sprite(x, y, PORTAL_FRAME_KEYS[0])
      .setOrigin(0.5, 1)
      .setScale(scale)
      .setDepth(y);
    this.campLayer.add(swirl);
    this.time.addEvent({
      delay: 130,
      loop: true,
      callback: () => {
        if (!swirl.active) return;
        this.portalFrame = (this.portalFrame + 1) % PORTAL_FRAME_KEYS.length;
        swirl.setTexture(PORTAL_FRAME_KEYS[this.portalFrame]);
      },
    });

    // Motes drawn in from around the rim, so it reads as pulling rather than pushing.
    const motes = this.add.particles(x, centreY, FX.dot1, {
      emitZone: {
        type: 'edge',
        source: new Phaser.Geom.Ellipse(0, 0, 40 * scale, 56 * scale),
        quantity: 24,
      },
      moveToX: 0,
      moveToY: 0,
      lifespan: { min: 500, max: 900 },
      scale: { start: 1.4, end: 0.3 },
      alpha: { start: 0.9, end: 0 },
      tint: [hex(PAL.cyan), hex(PAL.violet), hex(PAL.white)],
      frequency: 70,
      blendMode: Phaser.BlendModes.ADD,
    });
    motes.setDepth(y + 1);
    this.campLayer.add(motes);

    const sign = new Label(this, x, centreY - 22 * scale, 'HEAD OUT', {
      color: PAL.cyan,
      originX: 0.5,
      align: 'center',
    }).setDepth(y + 2);
    this.campLayer.add(sign.container);
    this.tweens.add({
      targets: sign.container,
      y: centreY - 22 * scale - 3,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private buildAmbient(): void {
    const { width, height } = BAL.view;
    this.add
      .rectangle(0, 0, width, height, hex(PAL.orange))
      .setOrigin(0)
      .setScrollFactor(0)
      .setAlpha(0.1)
      .setDepth(5000);
  }

  /**
   * One line before the player leaves: the weather, and something that happened while
   * they slept. It gives every day a hook of its own.
   */
  private showMorningReport(): void {
    if (state.story.reportSeenDay === state.day) return;
    state.story.reportSeenDay = state.day;

    const lines: string[] = [];
    const event = eventForDay(state.day, state.stats.deaths);
    if (state.day === 1) {
      lines.push('You do not remember getting here. The fire was already burning.');
    } else if (event.report) {
      lines.push(event.report);
    } else {
      lines.push('Clear, and colder than yesterday.');
    }

    if (state.stats.deaths > 0 && state.day > 1) {
      lines.push('Your hands still do not work properly.');
    }
    if (traderToday(state.day, event.id)) lines.push('Sled tracks on the road. The trader is out today.');
    if (state.map.discoveredAreas.includes('road') && !state.story.miraRescued) {
      lines.push('Something was howling out past the road last night.');
    }

    const { width } = BAL.view;
    const text = lines.join('\n');
    const lineCount = lines.length;
    // A panel behind it, because this lands over open snow and a thin outline is not
    // enough for a sentence you are meant to actually read.
    const panel = this.add
      .rectangle(Math.round(width / 2), 36, width - 60, 10 + lineCount * 11, hex(PAL.black))
      .setOrigin(0.5, 0)
      .setAlpha(0)
      .setStrokeStyle(1, hex(PAL.blueDark), 0.8)
      .setScrollFactor(0)
      .setDepth(7599);

    const label = new Label(this, Math.round(width / 2), 41, text, {
      color: PAL.cream,
      originX: 0.5,
      align: 'center',
    })
      .setScrollFactor(0)
      .setDepth(7600)
      .setAlpha(0);

    this.tweens.add({
      targets: panel,
      alpha: 0.72,
      duration: 600,
      hold: 3200,
      yoyo: true,
      onComplete: () => panel.destroy(),
    });

    this.tweens.add({
      targets: label.target,
      alpha: 1,
      duration: 600,
      hold: 3200,
      yoyo: true,
      onComplete: () => label.destroy(),
    });
  }

  // --- interactions ------------------------------------------------------

  private useStation(id: StationId): void {
    switch (id) {
      case 'fire':
        // No instant heal. Standing here is what heals you, and it says so.
        this.juice.floatText(this.player.cx, this.player.sprite.y - 24, 'Stay close', PAL.gold);
        bus.emit('audio:play', { cue: 'warm' });
        break;

      case 'workbench':
      case 'weaponrack':
        this.openMenu('weapons');
        break;

      case 'storage':
      case 'cookpot':
      case 'medtable':
        this.openMenu('inventory');
        break;

      case 'shelter':
      case 'watchtower':
        this.openMenu('camp');
        break;

      case 'signaltable':
        this.workTheRadio();
        break;

      case 'board':
        this.showJournal();
        break;

      case 'trophy':
        this.openRematch();
        break;

      case 'pup':
        this.juice.floatText(this.player.cx, this.player.sprite.y - 24, 'It leans into your hand.', PAL.cream);
        bus.emit('audio:play', { cue: 'warm', volume: 0.6 });
        break;

      case 'mira':
        if (this.mira) {
          const lines = this.mira.interact();
          // Her greeting first; the things worth asking come after it.
          if (lines.length) this.dialogue.show(lines, 'Mira', () => this.openTopics(), 'npc-mira');
          else this.openTopics();
        }
        break;

      default:
        this.openMenu('camp');
    }
  }

  /**
   * The radio. It answers once the valley is clear, which is what opens the tower.
   * Before that it is noise, and the upgrade screen is still one press away.
   */
  private workTheRadio(): void {
    const clear =
      state.bosses.mawDefeated && state.bosses.stagDefeated && state.bosses.rangerDefeated;

    if (state.story.ending) {
      this.dialogue.show(['The set is quiet now. Mira leaves it on anyway.'], 'The Radio');
      return;
    }
    if (state.story.towerOpen) {
      this.dialogue.show(
        ['The pattern is still repeating. The stair is still on the outside of the tower.'],
        'The Radio',
      );
      return;
    }
    if (!clear) {
      this.dialogue.show(MIRA.radioNotYet, 'The Radio');
      return;
    }

    state.story.towerOpen = true;
    SaveSystem.save();
    bus.emit('audio:play', { cue: 'discover' });
    this.dialogue.show(MIRA.radioAnswer, 'The Radio');
  }

  /**
   * A real-day streak. The first time the game opens on a calendar day, Mira has
   * left supplies by the fire, and they grow with the streak. It is the reason to
   * come back tomorrow that every game people return to has some form of.
   */
  private greetReturn(): void {
    const today = new Date().toISOString().slice(0, 10);
    const meta = state.meta;
    if (meta.lastVisit === today) return;

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    meta.streak = meta.lastVisit === yesterday ? meta.streak + 1 : 1;
    meta.bestStreak = Math.max(meta.bestStreak, meta.streak);
    meta.lastVisit = today;

    const s = Math.min(meta.streak, 7);
    const crate: Array<[ResourceId, number]> = [
      ['wood', 4 + s * 2],
      ['food', 2 + s],
      ['scrap', 2 + s],
    ];
    if (s >= 3) crate.push(['crystal', Math.floor(s / 3)]);
    if (s >= 5) crate.push(['medical', 1]);
    for (const [id, n] of crate) {
      state.camp.storage[id] = Math.min(BAL.resourceCap, (state.camp.storage[id] ?? 0) + n);
    }
    SaveSystem.save();

    const line =
      meta.streak === 1
        ? 'Supplies by the fire. Somebody kept it going while you were gone.'
        : `Day ${meta.streak} of coming back. Mira left more by the fire.`;
    this.time.delayedCall(4200, () => {
      bus.emit('juice:toast', { text: line, color: PAL.gold });
      bus.emit('audio:play', { cue: 'cache' });
      this.juice.sparks(this.fireX, this.fireY - 10, PAL.gold, 12, 90);
    });
  }

  private topicPanel: Phaser.GameObjects.GameObject[] | null = null;
  private rematchPanel: Phaser.GameObjects.GameObject[] | null = null;
  private pactPanel: Phaser.GameObjects.GameObject[] | null = null;
  private pactHandToday: PactId[] = [];
  private pendingRematch: string | null = null;

  /** The bosses already beaten, which the trophy can bring back for a day. */
  private rematchList(): Array<{ id: string; name: string; where: string }> {
    const out: Array<{ id: string; name: string; where: string }> = [];
    if (state.bosses.mawDefeated) out.push({ id: 'maw', name: 'The White Maw', where: 'In its den. Loot only.' });
    if (state.bosses.stagDefeated) out.push({ id: 'stag', name: 'The Hollow Stag', where: 'In the tower pass. Loot only.' });
    if (state.bosses.rangerDefeated) out.push({ id: 'ranger', name: 'The One Who Stayed', where: 'At the cabin, after dark.' });
    return out;
  }

  /**
   * Monster Hunter's rematch, Hades' next run: a beaten boss can be brought
   * back for a day, for its loot, with no effect on the story. Picking one heads
   * out at once.
   */
  private openRematch(): void {
    const list = this.rematchList();
    if (this.rematchPanel) return;
    if (list.length === 0) {
      this.dialogue.show(['A fang on a post. When there is more, this is where you will remember it.'], 'Trophy');
      return;
    }
    const { width, height } = BAL.view;
    const w = 268;
    const h = 20 + list.length * 22 + 10;
    const x = Math.round(width / 2 - w / 2);
    const y = Math.round(height / 2 - h / 2) + 30;
    const objects: Phaser.GameObjects.GameObject[] = [];
    const frame = this.add.graphics().setScrollFactor(0).setDepth(8600);
    drawFrame(frame, x, y, w, h, { edge: PAL.blood, alpha: 0.96 });
    objects.push(
      frame,
      this.add.bitmapText(x + 8, y + 6, FONT, 'FIGHT IT AGAIN').setTint(hex(PAL.blood)).setScrollFactor(0).setDepth(8601),
      this.add.bitmapText(x + w - 8, y + 6, FONT, 'E closes').setOrigin(1, 0).setTint(hex(PAL.uiMuted)).setScrollFactor(0).setDepth(8601),
    );
    list.forEach((b, i) => {
      const ry = y + 20 + i * 22;
      const hit = this.add
        .rectangle(x + 6, ry - 2, w - 12, 20, hex(PAL.deep))
        .setOrigin(0)
        .setAlpha(0.3)
        .setScrollFactor(0)
        .setDepth(8601)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        this.input.stopPropagation();
        this.pickRematch(i);
      });
      objects.push(
        hit,
        this.add.bitmapText(x + 10, ry, FONT, `${i + 1}  ${b.name}`).setTint(hex(PAL.cream)).setScrollFactor(0).setDepth(8602),
        this.add.bitmapText(x + 10, ry + 9, FONT, b.where).setTint(hex(PAL.cyan)).setScrollFactor(0).setDepth(8602),
      );
    });
    this.rematchPanel = objects;
  }

  private pickRematch(i: number): void {
    const b = this.rematchList()[i];
    this.closeRematch();
    if (!b) return;
    this.headOut(b.id);
  }

  private closeRematch(): void {
    if (!this.rematchPanel) return;
    for (const o of this.rematchPanel) o.destroy();
    this.rematchPanel = null;
  }

  /** Which of her topics are open right now, in order. */
  private openTopicList(): Array<{ id: string; label: string; lines: string[] }> {
    const st = state;
    const gates: Record<string, boolean> = {
      her: true,
      eleven: st.story.notesFound.includes('cabin') || st.story.rangerTold,
      collar: st.story.notesFound.includes('collar') || st.bosses.mawDefeated,
      tower: st.story.towerOpen || st.story.ending !== null || st.bosses.stagDefeated,
      pup: st.story.pupFound,
    };
    return MIRA.topics.filter((t) => gates[t.id]);
  }

  /**
   * A short list of things to ask her. 1, 2, 3 or a click picks one; E or walking
   * off closes it. Topics open as the story does, so there is a reason to come
   * back and talk after every big thing.
   */
  private openTopics(): void {
    const topics = this.openTopicList();
    if (topics.length === 0 || this.topicPanel) return;
    const { width, height } = BAL.view;
    const w = 220;
    const h = 20 + topics.length * 14 + 10;
    const x = Math.round(width / 2 - w / 2);
    const y = Math.round(height / 2 - h / 2) + 30;
    const objects: Phaser.GameObjects.GameObject[] = [];
    const frame = this.add.graphics().setScrollFactor(0).setDepth(8600);
    drawFrame(frame, x, y, w, h, { edge: PAL.teal, alpha: 0.96 });
    objects.push(
      frame,
      this.add.bitmapText(x + 8, y + 6, FONT, 'ASK MIRA').setTint(hex(PAL.teal)).setScrollFactor(0).setDepth(8601),
      this.add.bitmapText(x + w - 8, y + 6, FONT, 'E closes').setOrigin(1, 0).setTint(hex(PAL.uiMuted)).setScrollFactor(0).setDepth(8601),
    );
    topics.forEach((t, i) => {
      const ry = y + 20 + i * 14;
      const hit = this.add
        .rectangle(x + 6, ry - 2, w - 12, 13, hex(PAL.deep))
        .setOrigin(0)
        .setAlpha(0.3)
        .setScrollFactor(0)
        .setDepth(8601)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        this.input.stopPropagation();
        this.pickTopic(i);
      });
      objects.push(hit, this.add.bitmapText(x + 10, ry, FONT, `${i + 1}  ${t.label}`).setTint(hex(PAL.cream)).setScrollFactor(0).setDepth(8602));
    });
    this.topicPanel = objects;
  }

  private pickTopic(i: number): void {
    const topics = this.openTopicList();
    const t = topics[i];
    this.closeTopics();
    if (!t) return;
    this.dialogue.show(t.lines, 'Mira', undefined, 'npc-mira');
  }

  private closeTopics(): void {
    if (!this.topicPanel) return;
    for (const o of this.topicPanel) o.destroy();
    this.topicPanel = null;
  }

  /** The journal: what has been found, and how much has not. */
  private showJournal(): void {
    const found = state.story.notesFound;
    const lines: string[] = [`Notes found: ${found.length} of ${NOTE_LIST.length}.`];

    for (const note of NOTE_LIST) {
      if (found.includes(note.id)) lines.push(`${note.title}\n\n${note.body}`);
    }
    if (found.length === 0) {
      lines.push('Nothing written down yet. Somebody must have left something out there.');
    } else if (found.length < NOTE_LIST.length) {
      lines.push('There is more of this somewhere.');
    } else {
      lines.push('That is all of it. It still does not say why.');
    }

    this.dialogue.show(lines, 'Notice board');
  }

  private openMenu(tab: string): void {
    this.input$.flush();
    this.scene.pause();
    this.scene.launch('Menu', { tab });
    this.scene.bringToTop('Menu');
  }

  /**
   * The gate out. Three pacts are dealt first, because the last thing that
   * happens before a day starts should be a decision the player made.
   */
  private headOut(rematch: string | null = null): void {
    if (this.leaving || this.pactPanel) return;
    this.openPacts(rematch);
  }

  /** Deals the morning's three and waits for 1, 2, 3 or a click. */
  private openPacts(rematch: string | null): void {
    this.pendingRematch = rematch;
    const hand = pactHand(state.day, state.stats.deaths);
    const { width, height } = BAL.view;
    const w = 280;
    const h = 22 + hand.length * 28 + 12;
    const x = Math.round(width / 2 - w / 2);
    const y = Math.round(height / 2 - h / 2) + 20;
    const objects: Phaser.GameObjects.GameObject[] = [];
    const frame = this.add.graphics().setScrollFactor(0).setDepth(8600);
    drawFrame(frame, x, y, w, h, { edge: PAL.gold, alpha: 0.96 });
    objects.push(
      frame,
      this.add.bitmapText(x + 8, y + 6, FONT, 'WHAT YOU TAKE').setTint(hex(PAL.gold)).setScrollFactor(0).setDepth(8601),
      this.add
        .bitmapText(x + w - 8, y + 6, FONT, 'E steps back')
        .setOrigin(1, 0)
        .setTint(hex(PAL.uiMuted))
        .setScrollFactor(0)
        .setDepth(8601)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.input.stopPropagation();
          this.closePacts();
        }),
    );
    hand.forEach((p, i) => {
      const ry = y + 22 + i * 28;
      const hit = this.add
        .rectangle(x + 6, ry - 2, w - 12, 26, hex(PAL.deep))
        .setOrigin(0)
        .setAlpha(0.3)
        .setScrollFactor(0)
        .setDepth(8601)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        this.input.stopPropagation();
        this.pickPact(i, rematch);
      });
      objects.push(
        hit,
        this.add.bitmapText(x + 10, ry, FONT, `${i + 1}  ${p.name}`).setTint(hex(PAL.cream)).setScrollFactor(0).setDepth(8602),
        this.add.bitmapText(x + 10, ry + 9, FONT, p.boon).setTint(hex(PAL.teal)).setScrollFactor(0).setDepth(8602),
        this.add.bitmapText(x + 10, ry + 18, FONT, p.cost).setTint(hex(PAL.blood)).setScrollFactor(0).setDepth(8602),
      );
    });
    this.pactPanel = objects;
    this.pactHandToday = hand.map((p) => p.id);
    bus.emit('audio:play', { cue: 'open' });
  }

  private pickPact(i: number, rematch: string | null): void {
    const id = this.pactHandToday[i];
    if (!id) return;
    this.closePacts();
    bus.emit('audio:play', { cue: 'upgrade' });
    this.leaveCamp(rematch, id);
  }

  private closePacts(): void {
    if (!this.pactPanel) return;
    for (const o of this.pactPanel) o.destroy();
    this.pactPanel = null;
  }

  private leaveCamp(rematch: string | null, pact: PactId | null): void {
    if (this.leaving) return;
    this.leaving = true;

    const event = eventForDay(state.day, state.stats.deaths);
    state.run = newRunState(Date.now() & 0xffffff, ResourceSystem.maxHp(), event.storm, event.id);
    state.run.rematch = rematch;
    state.run.pact = pact;
    // The pact can change what full health means, so fill up after taking it.
    state.run.hp = ResourceSystem.maxHp();
    SaveSystem.save();
    bus.emit('day:started', { day: state.day });
    bus.emit('audio:play', { cue: 'portal' });

    // Pulled into the swirl: the sprite shrinks to the portal's centre as the
    // screen goes to black.
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body | null;
    body?.setVelocity(0, 0);
    this.tweens.add({
      targets: this.player.sprite,
      x: this.portalX,
      y: this.portalY + 6,
      scale: 0.15,
      alpha: 0.2,
      angle: 180,
      duration: 340,
      ease: 'Quad.easeIn',
    });
    this.cameras.main.flash(120, 140, 80, 255);
    this.cameras.main.fadeOut(360, 0, 0, 0);
    this.time.delayedCall(400, () => this.scene.start('World'));
  }

  // --- loop --------------------------------------------------------------

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50);
    if (this.leaving) {
      this.weather.update(dt, 0.1);
      return;
    }
    const input = this.input$.update(this.player.cx, this.player.cy);
    this.player.update(dt, input);

    // Walk into the portal and the day starts. No prompt, no key.
    if (
      !this.dialogue.isOpen &&
      Phaser.Math.Distance.Between(this.player.cx, this.player.cy, this.portalX, this.portalY) <
        BAL.camp.portalRadius
    ) {
      this.headOut();
      return;
    }
    this.weather.update(dt, 0.1);

    this.recoverAtFire(dt);

    hud.context = 'camp';
    hud.hp = this.player.hp;
    hud.maxHp = this.player.maxHp;
    hud.cold = this.cold;
    hud.day = state.day;
    hud.dashCharge = this.player.dashCharge;

    if (this.dialogue.isOpen) {
      this.prompt.hide();
      if (input.interactPressed) this.dialogue.advance();
      return;
    }

    if (this.pactPanel) {
      this.prompt.hide();
      if (input.slotPressed) this.pickPact(input.slotPressed - 1, this.pendingRematch);
      else if (input.interactPressed) this.closePacts();
      return;
    }

    if (this.rematchPanel) {
      this.prompt.hide();
      if (input.slotPressed) this.pickRematch(input.slotPressed - 1);
      else if (input.interactPressed) this.closeRematch();
      return;
    }

    if (this.topicPanel) {
      this.prompt.hide();
      if (input.slotPressed) this.pickTopic(input.slotPressed - 1);
      else if (input.interactPressed) this.closeTopics();
      else if (!this.mira || Phaser.Math.Distance.Between(this.player.cx, this.player.cy, this.mira.cx, this.mira.cy) > 40) this.closeTopics();
      return;
    }

    let nearest: Station | null = null;
    let nearestDist = Infinity;
    for (const s of this.stations) {
      const d = Phaser.Math.Distance.Between(this.player.cx, this.player.cy, s.x, s.y);
      if (d < s.radius && d < nearestDist) {
        nearest = s;
        nearestDist = d;
      }
    }

    this.touch.update(!!nearest, !!state.player.equipped[1]);

    if (nearest) {
      this.prompt.show(nearest.label, this.player.cx, this.player.sprite.y - 30);
      if (input.interactPressed) this.useStation(nearest.id);
    } else {
      this.prompt.hide();
    }
  }

  /**
   * The firelight is what mends you. Health comes back and the cold drains off while
   * you stand in it, and both stop the moment you step away, so returning to camp is
   * an act rather than a reset.
   */
  private recoverAtFire(dt: number): void {
    const seconds = dt / 1000;
    const dist = Phaser.Math.Distance.Between(this.player.cx, this.player.cy, this.fireX, this.fireY);
    const inLight = dist < BAL.camp.fireRadius;

    if (inLight) {
      if (this.player.hp < this.player.maxHp) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + BAL.camp.fireHealPerSec * seconds);
      }
      if (this.cold > 0) {
        this.cold = Math.max(0, this.cold - BAL.camp.fireColdPerSec * seconds);
      }
    }

    state.player.hp = this.player.hp;
    state.player.cold = this.cold;
  }

  private cleanup(): void {
    this.subs.dispose();
    this.dialogue?.close();
    this.mira?.destroy();
    this.weather?.destroy();
    this.juice?.destroy();
    this.player?.destroy();
  }
}

/** Verbs only. The prompt widget adds the key, so touch players see a tap mark. */
const STATION_LABEL: Record<StationId, string> = {
  fire: 'Warm up',
  workbench: 'Use workbench',
  storage: 'Open storage',
  board: 'Read the board',
  shelter: 'Rest in shelter',
  cookpot: 'Cook',
  medtable: 'Treat wounds',
  weaponrack: 'Choose weapon',
  watchtower: 'Climb the tower',
  signaltable: 'Work the radio',
  mira: 'Talk to Mira',
  pup: 'Pet the pup',
  trophy: 'Fight one again',
  supplydrop: 'Open supply drop',
};

/** Ember particle colours for a fire of the chosen colour. */
function emberTints(colour: string | undefined): number[] {
  if (colour === 'blue') return [hex(PAL.cyan), hex(PAL.ice), hex(PAL.blueDark)];
  if (colour === 'gold') return [hex(PAL.cream), hex(PAL.gold), hex(PAL.orange)];
  return [hex(PAL.gold), hex(PAL.orange), hex(PAL.ember)];
}
