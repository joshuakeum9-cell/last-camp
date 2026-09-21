import { PAL } from '../art/palette';

/** Exactly five resources. Nothing else is ever a currency. */
export const RESOURCE_IDS = ['wood', 'scrap', 'food', 'crystal', 'medical'] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];

export interface ResourceDef {
  id: ResourceId;
  name: string;
  short: string;
  color: string;
  /** One line shown in the inventory so the player always knows what it is for. */
  use: string;
  /** Rare resources are called out in the summary and glow when dropped. */
  rare: boolean;
}

export const RESOURCES: Record<ResourceId, ResourceDef> = {
  wood: {
    id: 'wood',
    name: 'Wood',
    short: 'WOOD',
    color: PAL.wood,
    use: 'Shelter and fire upgrades.',
    rare: false,
  },
  scrap: {
    id: 'scrap',
    name: 'Scrap',
    short: 'SCRAP',
    color: PAL.steel,
    use: 'Weapons and equipment.',
    rare: false,
  },
  food: {
    id: 'food',
    name: 'Food',
    short: 'FOOD',
    color: PAL.green,
    use: 'Healing and warmth.',
    rare: false,
  },
  crystal: {
    id: 'crystal',
    name: 'Frost Crystal',
    short: 'CRYS',
    color: PAL.cyan,
    use: 'Advanced upgrades. Nobody knows what they are.',
    rare: true,
  },
  medical: {
    id: 'medical',
    name: 'Medical Supplies',
    short: 'MED',
    color: PAL.blood,
    use: 'Serious healing. Very hard to find.',
    rare: true,
  },
};

export function emptyResources(): Record<ResourceId, number> {
  return { wood: 0, scrap: 0, food: 0, crystal: 0, medical: 0 };
}

/** Sum of every resource in a bag, used for the Scavenger achievement and summaries. */
export function totalResources(bag: Record<ResourceId, number>): number {
  return RESOURCE_IDS.reduce((sum, id) => sum + (bag[id] || 0), 0);
}

// --- consumables ---------------------------------------------------------

export const CONSUMABLE_IDS = ['ration', 'broth', 'bandage'] as const;
export type ConsumableId = (typeof CONSUMABLE_IDS)[number];

export interface ConsumableDef {
  id: ConsumableId;
  name: string;
  color: string;
  desc: string;
}

export const CONSUMABLES: Record<ConsumableId, ConsumableDef> = {
  ration: {
    id: 'ration',
    name: 'Cooked Ration',
    color: PAL.orange,
    desc: 'Restores health. Cooked from food at camp.',
  },
  broth: {
    id: 'broth',
    name: 'Warm Broth',
    color: PAL.gold,
    desc: 'Drives back the cold for a long while.',
  },
  bandage: {
    id: 'bandage',
    name: 'Bandage',
    color: PAL.cream,
    desc: 'Stops the bleeding. Restores a little health.',
  },
};

export function emptyConsumables(): Record<ConsumableId, number> {
  return { ration: 0, broth: 0, bandage: 0 };
}
