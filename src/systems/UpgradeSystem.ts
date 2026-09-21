import { bus } from '../core/EventBus';
import { state } from '../core/GameState';
import { campLevelFor, UPGRADES, UPGRADE_LIST, type UpgradeId } from '../data/upgrades';
import { PERKS, type PerkId } from '../data/perks';
import { ResourceSystem } from './ResourceSystem';

export type LockReason = 'affordable' | 'tooPoor' | 'needsUpgrade' | 'needsMira' | 'needsBoss' | 'owned';

export interface UpgradeStatus {
  id: UpgradeId;
  owned: boolean;
  reason: LockReason;
  /** Human sentence for why it is not available yet, or null when it is. */
  blockedBy: string | null;
}

/**
 * Buying things at camp. Every purchase is meant to be legible: a clear cost, a clear
 * benefit, and something that visibly changes about the camp or the survivor.
 */
export const UpgradeSystem = {
  owned(id: UpgradeId): boolean {
    return (state.camp.upgrades[id] ?? 0) > 0;
  },

  status(id: UpgradeId): UpgradeStatus {
    const def = UPGRADES[id];
    if (this.owned(id)) return { id, owned: true, reason: 'owned', blockedBy: null };

    if (def.requires?.upgrade && !this.owned(def.requires.upgrade)) {
      return {
        id,
        owned: false,
        reason: 'needsUpgrade',
        blockedBy: `Needs ${UPGRADES[def.requires.upgrade].name} first.`,
      };
    }
    if (def.requires?.mira && !state.story.miraRescued) {
      return { id, owned: false, reason: 'needsMira', blockedBy: 'Nobody here knows how.' };
    }
    if (def.requires?.boss && !state.bosses.mawDefeated) {
      return {
        id,
        owned: false,
        reason: 'needsBoss',
        blockedBy: 'Not while that thing is still out there.',
      };
    }
    if (!ResourceSystem.canAfford(def.cost)) {
      return {
        id,
        owned: false,
        reason: 'tooPoor',
        blockedBy: ResourceSystem.shortfall(def.cost),
      };
    }
    return { id, owned: false, reason: 'affordable', blockedBy: null };
  },

  /** Everything the player could conceivably work toward, in menu order. */
  visible(): UpgradeStatus[] {
    return UPGRADE_LIST.filter((def) => !def.awarded || this.owned(def.id)).map((def) =>
      this.status(def.id),
    );
  },

  buy(id: UpgradeId): boolean {
    const status = this.status(id);
    if (status.reason !== 'affordable') return false;

    const def = UPGRADES[id];
    if (!ResourceSystem.spend(def.cost)) return false;

    state.camp.upgrades[id] = 1;
    state.stats.campUpgradesBought++;

    const before = state.camp.level;
    const after = campLevelFor(this.ownedCount());
    state.camp.level = after;

    bus.emit('camp:upgrade', { id, level: 1 });
    bus.emit('audio:play', { cue: 'upgrade' });
    if (after > before) bus.emit('camp:levelUp', { level: after });
    return true;
  },

  /** Given, not bought. The boss trophy is the only one. */
  award(id: UpgradeId): void {
    if (this.owned(id)) return;
    state.camp.upgrades[id] = 1;
    state.camp.level = campLevelFor(this.ownedCount());
    bus.emit('camp:upgrade', { id, level: 1 });
  },

  ownedCount(): number {
    return Object.values(state.camp.upgrades).filter((n) => (n ?? 0) > 0).length;
  },

  // --- perks -------------------------------------------------------------

  perkLevel(id: PerkId): number {
    return state.player.perks[id] ?? 0;
  },

  canBuyPerk(id: PerkId): boolean {
    const def = PERKS[id];
    return this.perkLevel(id) < def.maxLevel && ResourceSystem.canAfford(def.cost);
  },

  buyPerk(id: PerkId): boolean {
    if (!this.canBuyPerk(id)) return false;
    if (!ResourceSystem.spend(PERKS[id].cost)) return false;
    state.player.perks[id] = this.perkLevel(id) + 1;
    bus.emit('perk:bought', { id });
    bus.emit('audio:play', { cue: 'upgrade' });
    return true;
  },

  /** Recompute the cached camp level, e.g. after loading a save. */
  refreshCampLevel(): void {
    state.camp.level = campLevelFor(this.ownedCount());
  },
};
