import { bus } from '../core/EventBus';
import { state } from '../core/GameState';
import { STORE_ITEMS, type StoreItem } from '../data/store';
import type { ResourceId } from '../data/resources';

/**
 * A simulated store. There is no payment code anywhere in this project and there is no
 * network call: `simulatePurchase` grants the item outright so the flow can be tested.
 *
 * The catalogue rule, spelled out in MONETIZATION.md: nothing here is needed to finish
 * the game, and nothing about normal play was made worse in order to sell it.
 */
export const StorePrototype = {
  items(): StoreItem[] {
    return STORE_ITEMS;
  },

  owns(item: StoreItem): boolean {
    return state.store.owned.includes(item.id);
  },

  open(): void {
    bus.emit('store:opened', {});
  },

  /** Development only. Grants the item and records what it would have cost. */
  simulatePurchase(item: StoreItem): void {
    if (this.owns(item) && item.category !== 'resources') return;

    if (!state.store.owned.includes(item.id)) state.store.owned.push(item.id);
    state.store.simulatedSpend += priceValue(item.price);

    if (item.slot && item.value) {
      state.player.cosmetics[item.slot] = item.value;
      if (!state.store.owned.includes(item.value)) state.store.owned.push(item.value);
    }

    if (item.resources) {
      for (const [id, amount] of Object.entries(item.resources)) {
        state.camp.storage[id as ResourceId] += amount ?? 0;
      }
    }

    bus.emit('store:purchased', { itemId: item.id });
    bus.emit('audio:play', { cue: 'upgrade' });
    bus.emit('juice:toast', { text: `${item.name} (simulated).`, color: '#c56bff' });
  },

  /** Cosmetics unlocked by achievements can be equipped for nothing. */
  equipOwnedCosmetic(item: StoreItem): boolean {
    if (!item.slot || !item.value) return false;
    if (!state.store.owned.includes(item.value)) return false;
    state.player.cosmetics[item.slot] = item.value;
    bus.emit('audio:play', { cue: 'swap' });
    return true;
  },

  /** A rewarded-ad prototype. Never plays on its own, never blocks anything. */
  adAvailable(rewardId: string, key: string | number): boolean {
    return state.store.adsUsed[`${rewardId}-${key}`] === undefined;
  },

  markAdUsed(rewardId: string, key: string | number): void {
    state.store.adsUsed[`${rewardId}-${key}`] = Date.now();
    bus.emit('ad:clicked', { rewardId });
  },

  get simulatedSpend(): number {
    return state.store.simulatedSpend;
  },
};

function priceValue(price: string): number {
  const n = Number(price.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
