import { bus } from '../core/EventBus';
import { state, type WeaponInstance } from '../core/GameState';
import { BAL } from '../data/balance';
import { CACHE_RESOURCES, CACHE_WEAPON_CHANCE, type CacheDef } from '../data/loot';
import { MODIFIER_IDS, WEAPONS, type WeaponId } from '../data/weapons';
import type { ResourceId } from '../data/resources';
import { RARITY_ORDER, type Rarity } from '../art/palette';
import { Rng, hashString } from '../core/Rng';
import { ResourceSystem } from './ResourceSystem';

export interface CacheContents {
  rarity: Rarity;
  resources: Array<{ id: ResourceId; amount: number }>;
  weapon: WeaponInstance | null;
  note: string | null;
  flavour: string;
}

/**
 * Rarity, modifiers and what is inside a cache. Randomness varies the texture of a run
 * but never gates progress: every weapon the player needs is in a hand-placed cache.
 */
export const LootSystem = {
  /** Roll a rarity, nudged by the Lucky Find perk. */
  rollRarity(rng: Rng): Rarity {
    const lucky = (state.player.perks.luckyfind ?? 0) * BAL.loot.luckyFindPoints;
    const weights = {
      common: Math.max(0, BAL.loot.rarityWeights.common - lucky * 3),
      uncommon: BAL.loot.rarityWeights.uncommon + lucky,
      rare: BAL.loot.rarityWeights.rare + lucky,
      epic: BAL.loot.rarityWeights.epic + lucky,
    };
    const total = weights.common + weights.uncommon + weights.rare + weights.epic;
    let roll = rng.range(0, total);
    for (const r of RARITY_ORDER) {
      roll -= weights[r];
      if (roll <= 0) return r;
    }
    return 'common';
  },

  /** Build a weapon instance of a given base and rarity, with rolled modifiers. */
  makeWeapon(base: WeaponId, rarity: Rarity, rng: Rng): WeaponInstance {
    const count = BAL.loot.modifierCount[rarity];
    const pool = rng.shuffle(MODIFIER_IDS);
    return {
      uid: `w-${base}-${Math.floor(rng.next() * 1e9).toString(36)}`,
      base,
      rarity,
      mods: pool.slice(0, count),
      tier: 0,
      branch: null,
    };
  },

  /** Open a cache. Deterministic per cache id and day, so reloading cannot reroll it. */
  open(def: CacheDef): CacheContents {
    const rng = new Rng(hashString(`${def.id}:${state.day}`));
    const rarity = def.rarity ?? this.rollRarity(rng);

    const resources = (CACHE_RESOURCES[rarity] ?? CACHE_RESOURCES.common).map((entry) => ({
      id: entry.id,
      amount: rng.int(entry.min, entry.max),
    }));

    let weapon: WeaponInstance | null = null;
    if (def.weapon) {
      weapon = this.makeWeapon(def.weapon, rarity, rng);
    } else if (rng.chance(CACHE_WEAPON_CHANCE[rarity] ?? 0)) {
      // Only weapons the player could already have found, so nothing arrives early.
      const pool: WeaponId[] = ['axe', 'knife', 'spear'];
      weapon = this.makeWeapon(rng.pick(pool), rarity, rng);
    }

    state.map.cachesOpened.push(def.id);
    bus.emit('cache:opened', { id: def.id, rarity });
    if (rarity === 'rare' || rarity === 'epic') {
      if (state.run) state.run.rareFinds++;
    }

    return { rarity, resources, weapon, note: def.note ?? null, flavour: def.flavour };
  },

  /** Add a found weapon to the player's kit, equipping it if a slot is free. */
  takeWeapon(weapon: WeaponInstance): void {
    state.player.weapons.push(weapon);
    state.run?.weaponsFound.push(weapon.uid);

    const slots = ResourceSystem.campEffects().weaponSlots;
    if (slots > 1 && !state.player.equipped[1]) {
      state.player.equipped[1] = weapon.uid;
    }
    bus.emit('weapon:found', {
      instanceId: weapon.uid,
      baseId: weapon.base,
      rarity: weapon.rarity,
    });
    bus.emit('audio:play', { cue: 'weaponFound' });
  },

  weaponName(weapon: WeaponInstance): string {
    return WEAPONS[weapon.base as WeaponId]?.name ?? 'Weapon';
  },

  isOpened(id: string): boolean {
    return state.map.cachesOpened.includes(id);
  },
};
