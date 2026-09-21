import Phaser from 'phaser';
import { buildPixelFont } from '../art/PixelFont';
import { PixelFactory } from '../art/PixelFactory';
import { PLAYER_SPRITES } from '../art/sprites/player';
import { buildTileset } from '../art/sprites/tiles';
import { buildScenery } from '../art/sprites/scenery';
import { buildCampArt } from '../art/sprites/camp';
import { buildFx } from '../art/sprites/fx';
import { buildEnemyArt } from '../art/sprites/enemies';
import { buildWeaponFx, buildWeaponIcons } from '../art/sprites/weapons';
import { buildCacheArt } from '../entities/Cache';
import { buildNoteArt } from '../entities/WorldNote';
import { buildMiraArt } from '../entities/NPCMira';
import { buildMawArt } from '../entities/BossWhiteMaw';
import { buildResourceIcons } from '../art/sprites/icons';
import { SaveSystem } from '../core/SaveSystem';
import { state } from '../core/GameState';
import { bus } from '../core/EventBus';

/**
 * Builds every texture in the game from code, then hands over to the title. Nothing is
 * loaded from disk, so this is fast and cannot fail on a missing file.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    buildPixelFont(this);
    buildFx(this);
    buildTileset(this);
    buildScenery(this);
    buildCampArt(this);
    buildEnemyArt(this);
    buildWeaponFx(this);
    buildWeaponIcons(this);
    buildCacheArt(this);
    buildNoteArt(this);
    buildMiraArt(this);
    buildMawArt(this);
    buildResourceIcons(this);
    for (const sprite of PLAYER_SPRITES) PixelFactory.build(this, sprite);

    SaveSystem.load();
    bus.emit('session:start', { day: state.day });

    this.scene.start('Title');
  }
}
