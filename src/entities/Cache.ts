import Phaser from 'phaser';
import { bus } from '../core/EventBus';
import { state } from '../core/GameState';
import { RARITY_COLOR, hex, PAL } from '../art/palette';
import { FX } from '../art/sprites/fx';
import { PixelFactory } from '../art/PixelFactory';
import type { CacheDef } from '../data/loot';
import { LootSystem } from '../systems/LootSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import type { Juice } from '../systems/Juice';

const CHEST_KEY = 'cache-chest';
const CHEST_OPEN_KEY = 'cache-chest-open';

const CHEST = [
  '..nnnnnnnnnnnn..',
  '.nyyyyyyyyyyyyn.',
  'nyyyyyyyyyyyyyyn',
  'nykkkkkkkkkkkkyn',
  'nykyyyyyyyyyykyn',
  'nnnnnnnLLnnnnnnn',
  'nkkkkkkLLkkkkkkn',
  'nkyyyyyLLyyyyykn',
  'nkykkkkLLkkkkykn',
  'nkykkkkkkkkkkykn',
  'nkyyyyyyyyyyyykn',
  'nnnnnnnnnnnnnnnn',
  '.ssssssssssssss.',
];

const CHEST_OPEN = [
  'nyyyyyyyyyyyyyyn',
  'nykkkkkkkkkkkkyn',
  '.nnnnnnnnnnnnnn.',
  '................',
  '................',
  '..wwwwwwwwwwww..',
  'nkkkkkkkkkkkkkkn',
  'nkyyyyyyyyyyyykn',
  'nkykkkkkkkkkkykn',
  'nkykkkkkkkkkkykn',
  'nkyyyyyyyyyyyykn',
  'nnnnnnnnnnnnnnnn',
  '.ssssssssssssss.',
];

export function buildCacheArt(scene: Phaser.Scene): void {
  const palette: Record<string, string | null> = {
    '.': null,
    n: 'woodDark',
    k: 'wood',
    y: 'gold',
    L: 'steel',
    w: 'cream',
    s: 'snow',
  };
  PixelFactory.makeTexture(scene, CHEST_KEY, CHEST, palette);
  PixelFactory.makeTexture(scene, CHEST_OPEN_KEY, CHEST_OPEN, palette);
}

/**
 * A treasure cache. It glows in its rarity colour from a long way off, because the
 * thing that makes a player walk further into danger is seeing something worth having.
 */
export class Cache {
  readonly sprite: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private opened: boolean;

  constructor(
    private scene: Phaser.Scene,
    readonly def: CacheDef,
    x: number,
    y: number,
    private juice: Juice,
    private onWeapon: (name: string, rarity: string) => void,
  ) {
    this.opened = LootSystem.isOpened(def.id);
    const color = RARITY_COLOR[def.rarity ?? 'uncommon'];

    this.glow = scene.add
      .image(x, y - 8, FX.glowMed)
      .setTint(hex(color))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(this.opened ? 0 : 0.5)
      .setDepth(y - 1);

    if (!this.opened) {
      scene.tweens.add({
        targets: this.glow,
        alpha: 0.85,
        scale: 1.25,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    scene.add
      .ellipse(x, y - 1, 20, 7, hex(PAL.blue))
      .setAlpha(0.3)
      .setDepth(y - 2);

    this.sprite = scene.add
      .image(x, y, this.opened ? CHEST_OPEN_KEY : CHEST_KEY)
      .setOrigin(0.5, 1)
      .setScale(1.2)
      .setDepth(y);
  }

  get cx(): number {
    return this.sprite.x;
  }

  get cy(): number {
    return this.sprite.y - 8;
  }

  get isOpen(): boolean {
    return this.opened;
  }

  get prompt(): string {
    return this.opened ? '' : 'E  OPEN';
  }

  inRange(px: number, py: number): boolean {
    return !this.opened && Phaser.Math.Distance.Between(px, py, this.cx, this.cy) < 26;
  }

  /** Returns the flavour line so the scene can show it. */
  open(): string {
    if (this.opened) return '';
    this.opened = true;

    const contents = LootSystem.open(this.def);
    this.sprite.setTexture(CHEST_OPEN_KEY);
    this.scene.tweens.killTweensOf(this.glow);
    this.scene.tweens.add({ targets: this.glow, alpha: 0, duration: 600 });

    const color = RARITY_COLOR[contents.rarity];
    this.juice.sparks(this.cx, this.cy, color, 16, 150);
    this.juice.ring(this.cx, this.cy, color, 40, 400);
    bus.emit('juice:shake', { intensity: 3, ms: 140 });
    bus.emit('audio:play', {
      cue: contents.rarity === 'rare' || contents.rarity === 'epic' ? 'pickupRare' : 'cache',
    });

    const night = state.run?.phase === 'night' || state.run?.phase === 'nightfall';
    for (const entry of contents.resources) {
      ResourceSystem.collect(entry.id, entry.amount, night);
    }

    if (contents.weapon) {
      LootSystem.takeWeapon(contents.weapon);
      this.onWeapon(LootSystem.weaponName(contents.weapon), contents.weapon.rarity);
    }

    if (contents.note && state.run && !state.story.notesFound.includes(contents.note)) {
      state.story.notesFound.push(contents.note);
      state.run.notesFound.push(contents.note);
    }

    return contents.flavour;
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.glow);
    this.glow.destroy();
    this.sprite.destroy();
  }
}
