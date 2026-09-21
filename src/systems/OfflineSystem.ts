import { bus } from '../core/EventBus';
import { state } from '../core/GameState';
import { BAL } from '../data/balance';
import { RESOURCES, type ResourceId } from '../data/resources';

export type Job = 'wood' | 'food' | 'scrap';

const JOB_RESOURCE: Record<Job, ResourceId> = {
  wood: 'wood',
  food: 'food',
  scrap: 'scrap',
};

/**
 * Mira keeps working while the game is closed. It is capped at an hour's worth, which
 * is the whole design: a small welcome back, never a replacement for playing.
 */
export const OfflineSystem = {
  assign(job: Job | null): void {
    state.story.miraAssignment = job;
    state.story.miraAssignedAt = job ? Date.now() : null;
    if (job) bus.emit('npc:assigned', { job });
  },

  get job(): Job | null {
    return state.story.miraAssignment;
  },

  /** How much is waiting right now, without taking it. */
  pending(): { job: Job; amount: number } | null {
    const job = state.story.miraAssignment;
    const since = state.story.miraAssignedAt;
    if (!job || !since) return null;

    const minutes = (Date.now() - since) / 60000;
    const units = Math.floor(minutes / BAL.offline.minutesPerUnit);
    const amount = Math.min(BAL.offline.capUnits, Math.max(0, units));
    return amount > 0 ? { job, amount } : null;
  },

  /** Take what is waiting and restart the clock. */
  collect(): { job: Job; amount: number } | null {
    const pending = this.pending();
    if (!pending) return null;

    const id = JOB_RESOURCE[pending.job];
    state.camp.storage[id] += pending.amount;
    state.story.miraAssignedAt = Date.now();

    bus.emit('offline:collected', { job: pending.job, amount: pending.amount });
    bus.emit('juice:toast', {
      text: `Mira brought in ${pending.amount} ${RESOURCES[id].name.toLowerCase()}.`,
      color: '#3ff07f',
    });
    return pending;
  },

  /** A line for the camp menu. */
  describe(): string {
    const job = state.story.miraAssignment;
    if (!job) return 'Mira is not working on anything.';
    const pending = this.pending();
    const capped = pending?.amount === BAL.offline.capUnits;
    if (!pending) return `Mira is gathering ${job}. Nothing ready yet.`;
    return `Mira has ${pending.amount} ${job} ready${capped ? ', and has run out of room' : ''}.`;
  },
};
