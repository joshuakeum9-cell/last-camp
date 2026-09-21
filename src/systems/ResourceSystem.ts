import { bus } from '../core/EventBus';
import { state } from '../core/GameState';
import { BAL } from '../data/balance';
import { RESOURCES, emptyResources, type ResourceId } from '../data/resources';
import { UPGRADES, type UpgradeId } from '../data/upgrades';

/**
 * The rules for gathering and for what survives a bad day. Pure state: no display
 * objects, so it can be reasoned about and tested on its own.
 */
export const ResourceSystem = {
  /** Aggregated camp upgrade effects. Within a group only the best tier counts. */
  campEffects() {
    const owned = Object.keys(state.camp.upgrades).filter(
      (id) => (state.camp.upgrades[id as UpgradeId] ?? 0) > 0,
    ) as UpgradeId[];

    const bestInGroup = new Map<string, UpgradeId>();
    const standalone: UpgradeId[] = [];
    for (const id of owned) {
      const def = UPGRADES[id];
      if (!def) continue;
      if (!def.group) {
        standalone.push(id);
        continue;
      }
      const current = bestInGroup.get(def.group);
      if (!current || UPGRADES[current].order < def.order) bestInGroup.set(def.group, id);
    }

    const result = {
      coldResist: 0,
      maxHp: 0,
      deathKeep: 1 - BAL.death.lossBase,
      foodHeal: 15,
      yieldMult: 0,
      weaponSlots: 1,
      fireLightMult: 1,
      playerLightMult: 1,
      damageMult: 0,
      unlocks: new Set<string>(),
    };

    for (const id of [...bestInGroup.values(), ...standalone]) {
      const e = UPGRADES[id].effects;
      if (e.coldResist) result.coldResist += e.coldResist;
      if (e.maxHp) result.maxHp += e.maxHp;
      if (e.deathKeep) result.deathKeep = Math.max(result.deathKeep, e.deathKeep);
      if (e.foodHeal) result.foodHeal = Math.max(result.foodHeal, e.foodHeal);
      if (e.yieldMult) result.yieldMult += e.yieldMult;
      if (e.weaponSlots) result.weaponSlots += e.weaponSlots;
      if (e.fireLightMult) result.fireLightMult *= e.fireLightMult;
      if (e.playerLightMult) result.playerLightMult *= e.playerLightMult;
      if (e.damageMult) result.damageMult += e.damageMult;
      for (const flag of e.unlocks ?? []) result.unlocks.add(flag);
    }

    result.coldResist += 0.15 * (state.player.perks.thickcoat ?? 0);
    result.coldResist = Math.min(BAL.cold.maxResistance, result.coldResist);
    result.maxHp += 10 * (state.player.perks.hearty ?? 0);
    return result;
  },

  /** Everything gathered is multiplied by this. */
  yieldMultiplier(): number {
    return 1 + this.campEffects().yieldMult + 0.1 * (state.player.perks.scavenger ?? 0);
  },

  maxHp(): number {
    return BAL.player.baseMaxHp + this.campEffects().maxHp;
  },

  /** Add to the current run's haul. Returns the amount actually granted. */
  collect(id: ResourceId, amount: number, night: boolean): number {
    const run = state.run;
    const granted = Math.max(1, Math.round(amount * this.yieldMultiplier()));
    if (run) {
      run.collected[id] = (run.collected[id] ?? 0) + granted;
      if (night) run.nightCollected[id] = (run.nightCollected[id] ?? 0) + granted;
    } else {
      state.camp.storage[id] = (state.camp.storage[id] ?? 0) + granted;
    }
    state.stats.resourcesCollected += granted;
    bus.emit('resource:collected', { id, amount: granted, night });
    return granted;
  },

  /**
   * End the day. Banks the haul with the night bounty and the untouched bonus, or
   * takes the loss if the player fell. Returns the numbers the summary shows.
   */
  endDay(reason: 'return' | 'death') {
    const run = state.run;
    const banked = emptyResources();
    const bonusNight = emptyResources();
    const lost = emptyResources();
    if (!run) return { banked, bonusNight, lost, untouched: false, keepFraction: 1 };

    const untouched = reason === 'return' && run.damageTaken === 0;
    const keepFraction = reason === 'death' ? this.campEffects().deathKeep : 1;

    for (const id of Object.keys(run.collected) as ResourceId[]) {
      const raw = run.collected[id] ?? 0;
      if (raw <= 0) continue;

      // The night bounty is the reward for the bet the player chose to make.
      const nightExtra =
        reason === 'return'
          ? Math.round((run.nightCollected[id] ?? 0) * (BAL.day.nightBounty - 1))
          : 0;
      const untouchedExtra = untouched ? Math.round(raw * BAL.untouchedBonus) : 0;

      const total = raw + nightExtra + untouchedExtra;
      const kept = Math.floor(total * keepFraction);

      banked[id] = kept;
      bonusNight[id] = nightExtra;
      lost[id] = total - kept;
      state.camp.storage[id] = (state.camp.storage[id] ?? 0) + kept;
    }

    return { banked, bonusNight, lost, untouched, keepFraction };
  },

  /** Can the camp afford a cost right now? */
  canAfford(cost: Partial<Record<ResourceId, number>>): boolean {
    for (const [id, need] of Object.entries(cost)) {
      if ((state.camp.storage[id as ResourceId] ?? 0) < (need ?? 0)) return false;
    }
    return true;
  },

  /** What is still missing, as a readable line like "3 more scrap". */
  shortfall(cost: Partial<Record<ResourceId, number>>): string | null {
    const missing: string[] = [];
    for (const [id, need] of Object.entries(cost)) {
      const have = state.camp.storage[id as ResourceId] ?? 0;
      const gap = (need ?? 0) - have;
      if (gap > 0) missing.push(`${gap} more ${RESOURCES[id as ResourceId].name.toLowerCase()}`);
    }
    return missing.length ? missing.join(', ') : null;
  },

  spend(cost: Partial<Record<ResourceId, number>>): boolean {
    if (!this.canAfford(cost)) return false;
    for (const [id, need] of Object.entries(cost)) {
      state.camp.storage[id as ResourceId] -= need ?? 0;
    }
    return true;
  },
};
