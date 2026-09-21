import { bus } from '../core/EventBus';
import { state } from '../core/GameState';
import { BAL } from '../data/balance';
import { ResourceSystem } from './ResourceSystem';

/**
 * The cold meter. It exists to create decision pressure, not constant frustration:
 * it never kills on its own quickly, it can always be answered with food or a fire,
 * and camp upgrades blunt it permanently.
 */
export class ColdSystem {
  private warned = false;

  get cold(): number {
    return state.run?.cold ?? 0;
  }

  get fraction(): number {
    return this.cold / BAL.cold.max;
  }

  get atMax(): boolean {
    return this.cold >= BAL.cold.max;
  }

  /** Speed multiplier applied to the player while freezing. */
  get speedMultiplier(): number {
    return this.atMax ? 1 - BAL.cold.slowAtMax : 1;
  }

  /**
   * @param areaMult  exposure of the current area
   * @param phaseMult time of day and weather
   * @param sheltered inside a building or standing in firelight
   */
  update(dt: number, areaMult: number, phaseMult: number, sheltered: 'none' | 'shelter' | 'fire'): number {
    const run = state.run;
    if (!run) return 0;
    const seconds = dt / 1000;

    let rate: number;
    if (sheltered === 'fire') {
      rate = BAL.cold.campfireRate;
    } else if (sheltered === 'shelter') {
      rate = BAL.cold.shelterRate;
    } else {
      const resist = 1 - ResourceSystem.campEffects().coldResist;
      rate = BAL.cold.baseRate * areaMult * phaseMult * resist;
    }

    run.cold = Math.max(0, Math.min(BAL.cold.max, run.cold + rate * seconds));

    if (run.cold >= BAL.cold.warnAt && !this.warned) {
      this.warned = true;
      bus.emit('cold:threshold', { level: 70 });
      bus.emit('juice:toast', { text: 'You are losing the feeling in your hands.', color: '#2fd8ff' });
    }
    if (run.cold < BAL.cold.warnAt - 10) this.warned = false;

    // Freezing hurts, but slowly enough that there is always time to do something.
    return this.atMax ? BAL.cold.damagePerSec * seconds : 0;
  }

  relieve(amount: number): void {
    const run = state.run;
    if (!run) return;
    run.cold = Math.max(0, run.cold - amount);
  }
}
