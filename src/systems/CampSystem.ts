import { state } from '../core/GameState';
import { CAMP_KEYS } from '../art/sprites/camp';
import { SCENERY_KEYS } from '../art/sprites/scenery';
import type { UpgradeId } from '../data/upgrades';

export type StationId =
  | 'fire'
  | 'workbench'
  | 'storage'
  | 'board'
  | 'shelter'
  | 'cookpot'
  | 'medtable'
  | 'weaponrack'
  | 'watchtower'
  | 'signaltable'
  | 'mira'
  | 'pup'
  | 'trophy'
  | 'supplydrop';

export interface CampPlacement {
  key: string;
  /** Tile coordinates. Everything is drawn bottom-anchored to the tile's bottom edge. */
  tx: number;
  ty: number;
  scale: number;
  flip?: boolean;
  /** Attaches an interaction prompt at this spot. */
  station?: StationId;
  /** Drawn behind everything, e.g. walls. */
  behind?: boolean;
}

/**
 * What the camp looks like right now. Every upgrade puts something physical on the
 * ground, and the camp's level swaps the shelter and the walls, so walking back in
 * after a purchase looks different.
 */
export const CampSystem = {
  owned(id: UpgradeId): boolean {
    return (state.camp.upgrades[id] ?? 0) > 0;
  },

  get level(): number {
    return state.camp.level;
  },

  /** One line describing the camp, shown on the notice board. */
  description(): string {
    switch (this.level) {
      case 1:
        return 'A fire and a torn tent. It is not much yet.';
      case 2:
        return 'Patched, staked down, and starting to look deliberate.';
      case 3:
        return 'A working camp. Somewhere to come back to.';
      case 4:
        return 'Walls, lanterns, and room for more than one person.';
      default:
        return 'Not a camp any more. A place.';
    }
  },

  placements(): CampPlacement[] {
    const out: CampPlacement[] = [];
    const add = (p: CampPlacement) => out.push(p);

    // --- walls, drawn behind everything ----------------------------------
    if (this.owned('shelter2')) {
      for (const tx of [11, 13, 15, 17, 19]) {
        add({ key: CAMP_KEYS.logWall, tx, ty: 8, scale: 1.3, behind: true });
      }
      for (const ty of [11, 14]) {
        add({ key: CAMP_KEYS.logWall, tx: 9, ty, scale: 1.3, behind: true });
        add({ key: CAMP_KEYS.logWall, tx: 21, ty, scale: 1.3, behind: true });
      }
    }

    // --- level 5: it stops being a camp ----------------------------------
    if (this.level >= 5) {
      add({ key: CAMP_KEYS.cabin, tx: 19, ty: 16, scale: 1.1 });
    }

    // --- the fire, always ------------------------------------------------
    const fireScale = this.owned('fire2') ? 2.4 : this.owned('fire1') ? 2.05 : 1.75;
    add({ key: 'campfire', tx: 15, ty: 12, scale: fireScale, station: 'fire' });

    // --- shelter ---------------------------------------------------------
    add({
      key: this.owned('shelter1') ? CAMP_KEYS.tentPatched : CAMP_KEYS.tentBroken,
      tx: 12,
      ty: 11,
      scale: 1.35,
      station: 'shelter',
    });

    // --- storage ---------------------------------------------------------
    add({
      key: CAMP_KEYS.crateStack,
      tx: 18,
      ty: 13,
      scale: this.owned('storage2') ? 1.6 : 1.3,
      station: 'storage',
    });

    add({ key: CAMP_KEYS.noticeBoard, tx: 17, ty: 10, scale: 1.3, station: 'board' });
    add({ key: CAMP_KEYS.log, tx: 14, ty: 14, scale: 1.4 });

    // --- things that make it a place someone lives, not a diagram ---------
    add({ key: CAMP_KEYS.woodpile, tx: 10, ty: 10, scale: 1.3 });
    add({ key: CAMP_KEYS.stool, tx: 17, ty: 13, scale: 1.3 });
    add({ key: CAMP_KEYS.stool, tx: 13, ty: 12, scale: 1.2, flip: true });
    add({ key: CAMP_KEYS.barrel, tx: 20, ty: 14, scale: 1.2 });
    add({ key: CAMP_KEYS.hangingLantern, tx: 14, ty: 10, scale: 1.3 });
    add({ key: SCENERY_KEYS.snowMound, tx: 8, ty: 15, scale: 1.2 });
    add({ key: SCENERY_KEYS.snowMound, tx: 23, ty: 8, scale: 1.4, flip: true });
    add({ key: SCENERY_KEYS.rockSmall, tx: 21, ty: 16, scale: 1.3 });
    add({ key: SCENERY_KEYS.rockSmall, tx: 9, ty: 8, scale: 1.1, flip: true });
    add({ key: SCENERY_KEYS.grassTuft, tx: 24, ty: 15, scale: 1.2 });
    add({ key: SCENERY_KEYS.grassTuft, tx: 7, ty: 12, scale: 1.1 });
    add({ key: SCENERY_KEYS.deadShrub, tx: 8, ty: 9, scale: 1.1 });
    add({ key: SCENERY_KEYS.fallenLog, tx: 7, ty: 17, scale: 1.2 });

    // --- bought stations -------------------------------------------------
    if (this.owned('workbench')) {
      add({ key: CAMP_KEYS.workbench, tx: 11, ty: 14, scale: 1.15, station: 'workbench' });
    }
    if (this.owned('cookpot')) {
      add({ key: CAMP_KEYS.cookingPot, tx: 17, ty: 15, scale: 1.1, station: 'cookpot' });
    }
    if (this.owned('scavrack')) {
      add({ key: CAMP_KEYS.dryingRack, tx: 19, ty: 11, scale: 1.1 });
    }
    if (this.owned('medtable')) {
      add({ key: CAMP_KEYS.medicalTable, tx: 13, ty: 9, scale: 1.2, station: 'medtable' });
    }
    if (this.owned('weaponrack')) {
      add({ key: CAMP_KEYS.weaponRack, tx: 10, ty: 12, scale: 1.15, station: 'weaponrack' });
    }
    if (this.owned('watchtower')) {
      add({ key: CAMP_KEYS.watchtower, tx: 20, ty: 9, scale: 1.4, station: 'watchtower' });
    }
    if (this.owned('signaltable')) {
      add({ key: CAMP_KEYS.signalTable, tx: 15, ty: 9, scale: 1.25, station: 'signaltable' });
    }
    if (this.owned('lantern')) {
      for (const [tx, ty] of [
        [10, 9],
        [20, 13],
        [11, 16],
      ]) {
        add({ key: CAMP_KEYS.lanternPost, tx, ty, scale: 1.3 });
      }
    }
    if (this.owned('trophy')) {
      add({ key: CAMP_KEYS.trophy, tx: 22, ty: 10, scale: 1.2, station: 'trophy' });
    }

    // --- the way out -----------------------------------------------------
    // A portal on the right edge. Walking into it starts the day; no key needed.
    add({ key: CAMP_KEYS.gatePost, tx: 24.6, ty: 14, scale: 1.5 });
    add({ key: CAMP_KEYS.gatePost, tx: 27.4, ty: 14, scale: 1.5 });
    add({ key: 'portal', tx: 26, ty: 13.5, scale: 1.6 });

    return out;
  },

  /** Where lanterns and the fire cast light, for the camp's warm glow. */
  lightSources(): Array<{ tx: number; ty: number; radius: number; intensity: number }> {
    const lights = [
      { tx: 15, ty: 12, radius: this.owned('fire2') ? 175 : 135, intensity: 0.5 },
      // The hanging lantern by the tent is always lit.
      { tx: 14, ty: 10, radius: 40, intensity: 0.28 },
    ];
    if (this.owned('lantern')) {
      for (const [tx, ty] of [
        [10, 9],
        [20, 13],
        [11, 16],
      ]) {
        lights.push({ tx, ty, radius: 52, intensity: 0.32 });
      }
    }
    return lights;
  },
};
