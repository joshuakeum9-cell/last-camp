import { bus } from '../core/EventBus';
import { state } from '../core/GameState';
import { BAL, phaseAt, type PhaseId } from '../data/balance';
import { activeEvent } from '../data/events';
import { WINTER } from '../data/winter';

/**
 * The day clock. It is the source of the game's only real pressure: light falls, the
 * cold bites harder, the enemies hit harder, and everything you pick up after dark is
 * worth half as much again if you get it home.
 */
export class DayNightSystem {
  private lastPhase: PhaseId = 'morning';
  private warned = false;

  get phase(): PhaseId {
    return (state.run?.phase ?? 'morning') as PhaseId;
  }

  get timeSec(): number {
    return state.run?.timeSec ?? 0;
  }

  get progress(): number {
    return Math.min(1, this.timeSec / BAL.day.length);
  }

  get secondsToNightfall(): number {
    const nightfallAt = BAL.day.phases[2].until;
    return Math.max(0, nightfallAt - this.timeSec);
  }

  get isNight(): boolean {
    return this.phase === 'night';
  }

  /** After nightfall everything gathered counts for more. */
  get bountyActive(): boolean {
    return this.phase === 'nightfall' || this.phase === 'night';
  }

  get darkness(): number {
    return phaseAt(this.timeSec).darkness;
  }

  get coldMultiplier(): number {
    return (
      phaseAt(this.timeSec).coldMult *
      (state.run?.storm ? BAL.day.stormMult : 1) *
      activeEvent(state.run?.event).coldMult *
      WINTER.coldMult()
    );
  }

  get enemyDamageMultiplier(): number {
    return phaseAt(this.timeSec).enemyDmg;
  }

  get enemySpeedMultiplier(): number {
    return this.isNight ? BAL.day.nightEnemySpeed : 1;
  }

  update(dt: number): void {
    const run = state.run;
    if (!run) return;

    run.timeSec += dt / 1000;
    const phase = phaseAt(run.timeSec);
    run.phase = phase.id as PhaseId;

    if (run.phase !== this.lastPhase) {
      this.lastPhase = run.phase;
      bus.emit('day:phase', { phase: run.phase });

      if (run.phase === 'nightfall' && !this.warned) {
        this.warned = true;
        bus.emit('juice:toast', { text: 'The light is going. Get home.', color: '#ffcf1f' });
        bus.emit('audio:play', { cue: 'nightfall' });
      }
      if (run.phase === 'night') {
        run.wentOutAtNight = true;
        bus.emit('juice:toast', {
          text: 'Night. Anything you carry home now is worth more.',
          color: '#2fd8ff',
        });
        bus.emit('audio:music', { cue: 'night' });
      }
    }
  }

  reset(): void {
    this.lastPhase = 'morning';
    this.warned = false;
  }
}
