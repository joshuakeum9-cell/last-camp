import { bus, Subscriptions } from '../core/EventBus';
import { state } from '../core/GameState';
import { ACHIEVEMENTS, ACHIEVEMENT_LIST, type AchievementId } from '../data/achievements';
import { NOTE_LIST } from '../data/story';
import { UpgradeSystem } from './UpgradeSystem';

/**
 * Long-term goals. Every reward is cosmetic, so nothing here is a power gate and
 * nobody has to grind an achievement to finish the game.
 */
export class AchievementSystem {
  private subs = new Subscriptions();

  constructor() {
    this.subs.add(bus.on('enemy:killed', () => this.check()));
    this.subs.add(bus.on('resource:collected', () => this.check()));
    this.subs.add(bus.on('camp:upgrade', () => this.check()));
    this.subs.add(bus.on('secret:found', () => this.unlock('curious')));
    this.subs.add(bus.on('npc:rescued', () => this.unlock('notEmpty')));
    this.subs.add(
      bus.on('boss:defeated', ({ id }) => this.unlock(id === 'stag' ? 'theHollowStag' : 'theWhiteMaw')),
    );
    this.subs.add(
      bus.on('day:ended', ({ reason }) => {
        if (reason !== 'return') return;
        this.unlock('firstNight');
        if (state.run?.damageTaken === 0) this.unlock('untouched');
        if (state.run?.wentOutAtNight) this.unlock('nightwalker');
        this.check();
      }),
    );
  }

  has(id: AchievementId): boolean {
    return state.achievements[id] != null;
  }

  unlock(id: AchievementId): void {
    if (this.has(id)) return;
    state.achievements[id] = Date.now();
    const def = ACHIEVEMENTS[id];
    this.applyReward(id);
    bus.emit('achievement:unlocked', { id });
    bus.emit('juice:toast', { text: `${def.name}. ${def.reward.label}`, color: '#3ff07f' });
    bus.emit('audio:play', { cue: 'cache' });
  }

  private applyReward(id: AchievementId): void {
    const reward = ACHIEVEMENTS[id].reward;
    if (!state.store.owned.includes(reward.value)) state.store.owned.push(reward.value);
  }

  /** Counting achievements, checked when anything relevant happens. */
  check(): void {
    if (state.stats.resourcesCollected >= 100) this.unlock('scavenger');
    if ((state.stats.enemiesKilled.wolf ?? 0) >= 10) this.unlock('packHunter');
    if (UpgradeSystem.ownedCount() >= 5) this.unlock('prepared');
    if (state.story.notesFound.length >= NOTE_LIST.length) this.unlock('wholeStory');
  }

  get unlockedCount(): number {
    return ACHIEVEMENT_LIST.filter((a) => this.has(a.id)).length;
  }

  destroy(): void {
    this.subs.dispose();
  }
}

export const achievements = new AchievementSystem();
