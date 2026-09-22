import type { ResourceId } from './resources';
import type { WeaponId } from './weapons';
import { hashString } from '../core/Rng';
import { activeEvent } from './events';

/** One offer: give this, get that. A weapon offer gives a rolled weapon instead. */
export interface TradeOffer {
  id: string;
  give: Partial<Record<ResourceId, number>>;
  get: Partial<Record<ResourceId, number>>;
  weapon?: WeaponId;
  line: string;
}

/**
 * The trader's whole stock. Three are on the sled on any day she comes, picked
 * from the day so reloading cannot reroll them. Every trade converts something
 * common into something the valley is short of, so the sled is worth the walk
 * to the road, and never worth more than a day out there.
 */
export const TRADES: TradeOffer[] = [
  { id: 'scrap-med', give: { scrap: 18 }, get: { medical: 1 }, line: 'Bandages. Clean ones. Do not ask where.' },
  { id: 'wood-food', give: { wood: 14 }, get: { food: 8 }, line: 'Dried fish. It keeps. You will not enjoy it.' },
  { id: 'food-crystal', give: { food: 9 }, get: { crystal: 2 }, line: 'Pulled off the lake ice at night. Cold to hold.' },
  { id: 'crystal-scrap', give: { crystal: 2 }, get: { scrap: 24 }, line: 'Stripped from something that used to fly.' },
  { id: 'scrap-knife', give: { scrap: 22 }, get: {}, weapon: 'knife', line: 'A knife with a story. I will not tell it.' },
  { id: 'wood-spear', give: { wood: 26 }, get: {}, weapon: 'spear', line: 'A spear. Reach is worth more than you think out here.' },
  { id: 'crystal-bow', give: { crystal: 4 }, get: {}, weapon: 'bow', line: 'A bow, and the cold that lives in it.' },
  { id: 'wood-med', give: { wood: 20, food: 4 }, get: { medical: 1 }, line: 'For the wood and something to eat: a kit.' },
];

/** Whether the sled is on the road today, and which three things are on it. */
export function traderToday(day: number, eventId: string | undefined): TradeOffer[] | null {
  if (day < 3) return null;
  if (activeEvent(eventId).storm) return null;
  const roll = hashString(`trader:${day}`) % 3;
  if (roll !== 0) return null;
  const seed = hashString(`stock:${day}`);
  const picks: TradeOffer[] = [];
  const pool = [...TRADES];
  let h = seed;
  while (picks.length < 3 && pool.length > 0) {
    h = (h * 1103515245 + 12345) >>> 0;
    picks.push(pool.splice(h % pool.length, 1)[0]);
  }
  return picks;
}

/** The day the trader next comes, for the summary's tease. */
export function nextTraderDay(fromDay: number): number {
  for (let d = fromDay; d < fromDay + 12; d++) {
    if (d >= 3 && hashString(`trader:${d}`) % 3 === 0) return d;
  }
  return fromDay + 12;
}
