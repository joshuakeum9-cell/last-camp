import { bus, Subscriptions } from '../core/EventBus';
import { state } from '../core/GameState';
import { CHALLENGES, CHALLENGE_IDS, type ChallengeDef, type ChallengeId } from '../data/challenges';
import { ResourceSystem } from './ResourceSystem';

/**
 * One rotating challenge per in-game day. Local only for now, but the save carries a
 * `source` field so a server could hand one down later without changing anything here.
 *
 * Missing a day costs nothing. This is a reason to play differently, not a chore.
 */
export class DailyChallengeSystem {
  private subs = new Subscriptions();

  constructor() {
    this.subs.add(bus.on('day:started', ({ day }) => this.issueFor(day)));
    // Also issued as soon as a save loads, so the notice board is never blank.
    this.subs.add(bus.on('session:start', ({ day }) => this.issueFor(day)));
    this.subs.add(bus.on('enemy:killed', ({ type }) => {
      this.advance('kills', 1);
      if (type === 'wolf') this.advance('wolfKills', 1);
    }));
    this.subs.add(bus.on('resource:collected', ({ id, amount }) => {
      if (id === 'wood') this.advance('wood', amount);
      if (id === 'food') this.advance('food', amount);
    }));
    this.subs.add(bus.on('breakable:broken', () => this.advance('breakables', 1)));
    this.subs.add(bus.on('cache:opened', ({ rarity }) => {
      if (rarity === 'rare' || rarity === 'epic') this.advance('rareCache', 1);
    }));
    this.subs.add(bus.on('day:phase', ({ phase }) => {
      if (phase === 'nightfall') this.advance('reachNightfall', 1);
    }));
    this.subs.add(bus.on('day:ended', ({ reason }) => {
      if (reason === 'return' && state.run?.damageTaken === 0) this.advance('untouchedReturn', 1);
      this.claimIfDone();
    }));
  }

  get current(): ChallengeDef | null {
    const id = state.challenge.id as ChallengeId;
    return CHALLENGES[id] ?? null;
  }

  get progress(): number {
    return state.challenge.progress;
  }

  get done(): boolean {
    const def = this.current;
    return !!def && state.challenge.progress >= def.target;
  }

  /** Rotates through the list rather than picking at random, so nothing repeats. */
  issueFor(day: number): void {
    if (state.challenge.dayIssued === day && state.challenge.id) return;
    const id = CHALLENGE_IDS[(day - 1) % CHALLENGE_IDS.length];
    state.challenge = { id, dayIssued: day, progress: 0, claimed: false, source: 'local' };
    const def = CHALLENGES[id];
    bus.emit('juice:toast', { text: `Today: ${def.label}.`, color: '#7bf3ff' });
  }

  private advance(track: ChallengeDef['track'], amount: number): void {
    const def = this.current;
    if (!def || def.track !== track || state.challenge.claimed) return;
    const before = state.challenge.progress;
    state.challenge.progress = Math.min(def.target, before + amount);

    const nowDone = state.challenge.progress >= def.target;
    bus.emit('challenge:progress', {
      id: def.id,
      progress: state.challenge.progress,
      done: nowDone,
    });
    if (nowDone && before < def.target) {
      bus.emit('juice:toast', { text: `Done: ${def.label}.`, color: '#3ff07f' });
    }
  }

  /** Paid out when the day ends, so the reward lands with the rest of the haul. */
  claimIfDone(): void {
    const def = this.current;
    if (!def || state.challenge.claimed || !this.done) return;
    state.challenge.claimed = true;
    for (const [id, amount] of Object.entries(def.reward)) {
      state.camp.storage[id as keyof typeof state.camp.storage] += amount ?? 0;
    }
    void ResourceSystem;
  }

  /** One line for the notice board and the summary. */
  describe(): string {
    const def = this.current;
    if (!def) return 'Nothing in particular today.';
    if (state.challenge.claimed) return `${def.label}: done.`;
    return `${def.label}  ${state.challenge.progress}/${def.target}`;
  }

  destroy(): void {
    this.subs.dispose();
  }
}

export const dailyChallenge = new DailyChallengeSystem();
