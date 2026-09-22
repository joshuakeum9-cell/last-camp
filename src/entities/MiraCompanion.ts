import Phaser from 'phaser';
import { bus } from '../core/EventBus';
import { BAL } from '../data/balance';
import { hex, PAL } from '../art/palette';
import { FX } from '../art/sprites/fx';
import { miraSprite } from './NPCMira';
import type { AreaId } from '../data/areas';

/** One line per area, said the first time she walks into it with you. */
const AREA_LINES: Partial<Record<AreaId, string>> = {
  forest: 'Mira: I set snares along here once. Something kept eating the snares.',
  road: 'Mira: The cars were full when we found them. People just left them.',
  cabin: 'Mira: I do not like being back here. Keep walking.',
  lake: 'Mira: Do not stand on the cracks. I watched a man learn that.',
  secret: 'Mira: Warm down here. That should not be possible.',
  bossden: 'Mira: This is where the collar came from. Stay close.',
  towerpass: 'Mira: You can hear it from here. The tower. It hums.',
};

/**
 * Mira, out in the field with the player. She follows a few steps behind, picks
 * up what falls near her, carries a lantern that helps after dark, and says one
 * thing about each place the first time she sees it. Nothing hunts her: the
 * enemies are the player's problem and she is the reason it is not lonely.
 */
export class MiraCompanion {
  readonly sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Ellipse;
  private lantern: Phaser.GameObjects.Image;
  private x: number;
  private y: number;
  private said = new Set<AreaId>();
  private lineAt = 0;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
  ) {
    this.x = x;
    this.y = y;
    this.shadow = scene.add.ellipse(x, y - 1, 16, 6, hex(PAL.blue)).setAlpha(0.3).setDepth(y - 2);
    this.sprite = scene.add
      .sprite(x, y, miraSprite.key)
      .setOrigin(0.5, 1)
      .setDepth(y)
      .play(`${miraSprite.key}_idle`);
    this.lantern = scene.add
      .image(x + 7, y - 10, FX.glowSmall)
      .setTint(hex(PAL.gold))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.4)
      .setScale(0.9)
      .setDepth(y + 1);
  }

  get cx(): number {
    return this.x;
  }

  get cy(): number {
    return this.y - 10;
  }

  /** Her lantern, for the lighting pass. Small, but it is at your shoulder. */
  get light(): { x: number; y: number; radius: number } {
    return { x: this.x, y: this.y - 8, radius: 44 };
  }

  update(dt: number, playerX: number, playerY: number, playerMoving: boolean, area: AreaId | null): void {
    const seconds = dt / 1000;
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.hypot(dx, dy);

    // Lost her: she catches up rather than getting stuck behind a tree forever.
    if (dist > 220) {
      this.x = playerX - Math.sign(dx || 1) * 20;
      this.y = playerY + 6;
    } else if (dist > 34) {
      const speed = BAL.player.speed * (dist > 90 ? 1.15 : 0.95);
      this.x += (dx / dist) * speed * seconds;
      this.y += (dy / dist) * speed * seconds;
      this.sprite.play(`${miraSprite.key}_walk`, true);
      if (Math.abs(dx) > 2) this.sprite.setFlipX(dx < 0);
    } else if (!playerMoving) {
      this.sprite.play(`${miraSprite.key}_idle`, true);
    }

    this.sprite.setPosition(Math.round(this.x), Math.round(this.y)).setDepth(this.y);
    this.shadow.setPosition(this.x, this.y - 1).setDepth(this.y - 2);
    this.lantern.setPosition(this.x + (this.sprite.flipX ? -7 : 7), this.y - 10).setDepth(this.y + 1);

    if (area && !this.said.has(area) && AREA_LINES[area] && this.scene.time.now > this.lineAt) {
      this.said.add(area);
      this.lineAt = this.scene.time.now + 4000;
      bus.emit('juice:toast', { text: AREA_LINES[area]!, color: PAL.teal });
    }
  }

  destroy(): void {
    this.shadow.destroy();
    this.lantern.destroy();
    this.sprite.destroy();
  }
}
