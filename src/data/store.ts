import type { ResourceId } from './resources';

export type StoreCategory = 'cosmetic' | 'resources' | 'starter' | 'convenience';

export interface StoreItem {
  id: string;
  name: string;
  desc: string;
  category: StoreCategory;
  /** Display only. Nothing here ever touches real money. */
  price: string;
  /** Cosmetic slot this item fills, if any. */
  slot?: 'outfit' | 'weaponSkin' | 'fireColor' | 'trail';
  value?: string;
  /** Resource packs hand these over. */
  resources?: Partial<Record<ResourceId, number>>;
}

/**
 * A simulated store. No payment path exists anywhere in the codebase: the only button
 * is a development one that grants the item so the flow can be tested.
 *
 * The rule the catalogue is built on is in MONETIZATION.md: nothing sold here is
 * required to finish the game, and nothing about normal play was made worse to sell it.
 */
export const STORE_ITEMS: StoreItem[] = [
  {
    id: 'starter',
    name: 'Starter Pack',
    desc: 'Warm Survivor Jacket, a bundle of scrap and wood, and an ember-coloured fire.',
    category: 'starter',
    price: '$4.99',
    slot: 'outfit',
    value: 'jacket',
    resources: { scrap: 20, wood: 20 },
  },
  {
    id: 'outfit-jacket',
    name: 'Warm Survivor Jacket',
    desc: 'A heavier coat. It does nothing. It looks good.',
    category: 'cosmetic',
    price: '$1.99',
    slot: 'outfit',
    value: 'jacket',
  },
  {
    id: 'outfit-frost',
    name: 'Frost White',
    desc: 'The colour of the thing you are trying not to become.',
    category: 'cosmetic',
    price: '$1.99',
    slot: 'outfit',
    value: 'frost',
  },
  {
    id: 'fire-blue',
    name: 'Cold Blue Fire',
    desc: 'It burns the wrong colour. Nobody asks why.',
    category: 'cosmetic',
    price: '$1.99',
    slot: 'fireColor',
    value: 'blue',
  },
  {
    id: 'fire-gold',
    name: 'Gold Fire',
    desc: 'Warmer than it has any right to be.',
    category: 'cosmetic',
    price: '$1.99',
    slot: 'fireColor',
    value: 'gold',
  },
  {
    id: 'skin-bone',
    name: 'Bone Weapon Skin',
    desc: 'Every weapon, rehandled in bone.',
    category: 'cosmetic',
    price: '$2.99',
    slot: 'weaponSkin',
    value: 'bone',
  },
  {
    id: 'trail-ember',
    name: 'Ember Trail',
    desc: 'You leave a little heat behind you.',
    category: 'cosmetic',
    price: '$1.99',
    slot: 'trail',
    value: 'ember',
  },
  {
    id: 'pack-small',
    name: 'Small Supply Crate',
    desc: 'Scrap and wood. Roughly one good expedition.',
    category: 'resources',
    price: '$0.99',
    resources: { scrap: 25, wood: 25 },
  },
  {
    id: 'pack-large',
    name: 'Large Supply Crate',
    desc: 'Enough to skip a day of gathering, if you would rather not.',
    category: 'resources',
    price: '$2.99',
    resources: { scrap: 70, wood: 70, food: 20 },
  },
  {
    id: 'slot-expedition',
    name: 'Second Expedition Slot',
    desc: 'A second survivor works while you are away. Convenience, not power.',
    category: 'convenience',
    price: '$3.99',
  },
];

export const AD_REWARDS = [
  {
    id: 'doubleHaul',
    label: 'Double this haul',
    where: 'summary',
    desc: 'Once per day, after a successful return.',
  },
  {
    id: 'revive',
    label: 'Get up',
    where: 'death',
    desc: 'Once per day. Stand up at half health instead of losing the day.',
  },
  {
    id: 'bundle',
    label: 'Small supply bundle',
    where: 'camp',
    desc: 'Once per real day, at the supply drop.',
  },
] as const;
