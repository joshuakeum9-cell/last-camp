import { state } from '../core/GameState';

/**
 * Deeper Winter: modifiers the player switches on for a better haul, in the way
 * Hades sells heat and Dead Cells sells boss cells. Each one makes the valley
 * meaner in one specific way and pays a flat bonus on everything gathered while
 * it is on. They unlock a few days in, once the ordinary winter is understood.
 */
export type WinterModId = 'packs' | 'dark' | 'cold' | 'teeth' | 'blind';

export interface WinterModDef {
  id: WinterModId;
  name: string;
  desc: string;
  /** Added to the loot multiplier, 0.2 is +20%. */
  bonus: number;
}

export const WINTER_MODS: Record<WinterModId, WinterModDef> = {
  packs: { id: 'packs', name: 'Bigger Packs', desc: 'Half again as many things hunting you.', bonus: 0.2 },
  dark: { id: 'dark', name: 'Deeper Dark', desc: 'Every light reaches only two thirds as far.', bonus: 0.15 },
  cold: { id: 'cold', name: 'Hungrier Cold', desc: 'The cold climbs half again as fast.', bonus: 0.15 },
  teeth: { id: 'teeth', name: 'Sharper Teeth', desc: 'Everything hits a third harder.', bonus: 0.2 },
  blind: { id: 'blind', name: 'No Map', desc: 'The map and the compass stay shut.', bonus: 0.1 },
};

export const WINTER_MOD_IDS = Object.keys(WINTER_MODS) as WinterModId[];

/** The day Deeper Winter opens up. */
export const WINTER_UNLOCK_DAY = 6;

export function winterUnlocked(): boolean {
  return state.day >= WINTER_UNLOCK_DAY || state.story.ending !== null || (state.meta.winters ?? 0) > 0;
}

export function winterOn(id: WinterModId): boolean {
  return winterUnlocked() && !!state.winter?.[id];
}

/** 1 plus every active bonus. */
export function winterLootMult(): number {
  let mult = 1;
  for (const id of WINTER_MOD_IDS) if (winterOn(id)) mult += WINTER_MODS[id].bonus;
  return mult;
}

export function winterActiveCount(): number {
  return WINTER_MOD_IDS.filter((id) => winterOn(id)).length;
}

export const WINTER = {
  spawnMult: () => (winterOn('packs') ? 1.5 : 1),
  lightMult: () => (winterOn('dark') ? 0.66 : 1),
  coldMult: () => (winterOn('cold') ? 1.5 : 1),
  damageMult: () => (winterOn('teeth') ? 1.33 : 1),
  mapHidden: () => winterOn('blind'),
};
