import { state } from '../core/GameState';

export interface ObjectiveDef {
  id: string;
  /** Shown as NEXT on the HUD, so the player always knows what the game wants. */
  text: string;
  done: () => boolean;
  /** Not shown until this is true. */
  available?: () => boolean;
}

/**
 * The thread through the whole game, one step at a time. The HUD shows the first
 * step not yet done, and only that. It is not a quest log: it is the one line a
 * friend would say if you asked them what to do next.
 */
export const OBJECTIVES: ObjectiveDef[] = [
  {
    id: 'gather',
    text: 'Bring ten wood back to the fire',
    done: () => (state.camp.storage.wood ?? 0) >= 10 || Object.keys(state.camp.upgrades).length > 0,
  },
  { id: 'fire1', text: 'Build a better fire', done: () => (state.camp.upgrades.fire1 ?? 0) > 0 },
  { id: 'workbench', text: 'Build the workbench', done: () => (state.camp.upgrades.workbench ?? 0) > 0 },
  {
    id: 'alpha',
    text: 'Deal with the Alpha Beast at the cabin',
    done: () => state.bosses.alphaDefeated,
    available: () => state.day >= 2,
  },
  { id: 'mira', text: 'Cut Mira loose in the cabin', done: () => state.story.miraRescued },
  {
    id: 'snowbank',
    text: 'Break through the snowbank past the lake',
    done: () => state.map.openedGates.includes('bossSnowbank'),
    available: () => state.day >= 3,
  },
  { id: 'maw', text: 'Kill the White Maw in its den', done: () => state.bosses.mawDefeated },
  {
    id: 'towerIce',
    text: 'Break the ice into the tower pass',
    done: () => state.map.openedGates.includes('towerIce'),
  },
  { id: 'stag', text: 'Bring down the Hollow Stag', done: () => state.bosses.stagDefeated },
  {
    id: 'ranger',
    text: 'Put out the lantern at the cabin, after dark',
    done: () => state.bosses.rangerDefeated,
    available: () => state.story.rangerTold,
  },
  { id: 'signal', text: 'Build the signal table', done: () => (state.camp.upgrades.signaltable ?? 0) > 0 },
  {
    id: 'radio',
    text: 'Work the radio at camp',
    done: () => state.story.towerOpen,
    available: () => state.bosses.mawDefeated && state.bosses.stagDefeated && state.bosses.rangerDefeated,
  },
  { id: 'tower', text: 'Climb the tower', done: () => state.story.ending !== null, available: () => state.story.towerOpen },
];

/** The current step, or null once the story is done. */
export function nextObjective(): ObjectiveDef | null {
  for (const o of OBJECTIVES) {
    if (o.done()) continue;
    if (o.available && !o.available()) continue;
    return o;
  }
  return null;
}
