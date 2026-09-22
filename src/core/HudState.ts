import { emptyResources, type ResourceId } from '../data/resources';

/**
 * What the HUD draws. The active gameplay scene writes this every frame and HUDScene
 * reads it, so the overlay never has to reach into another scene's objects.
 */
export interface HudState {
  visible: boolean;
  /** 'camp' hides the clock and cold meter; 'world' shows everything. */
  context: 'camp' | 'world';
  hp: number;
  maxHp: number;
  cold: number;
  maxCold: number;
  day: number;
  phaseName: string;
  /** 0..1 through the day. */
  dayProgress: number;
  /** Seconds left before nightfall, shown only with the Watchtower. */
  secondsLeft: number;
  showSeconds: boolean;
  dashCharge: number;
  weaponName: string;
  weaponColor: string;
  comboCount: number;
  chargeAmount: number;
  /** Resources carried this run, shown only once the player has any. */
  carried: Record<ResourceId, number>;
  /** Direction to camp, shown from nightfall. Null hides the compass. */
  homeAngle: number | null;
  /** The boss in the fight, or null. */
  bossName: string | null;
  bossHp: number;
  bossMaxHp: number;
  /** Deeper Winter's No Map: the compass stays off too. */
  mapHidden: boolean;
  /** A reading panel is up, so toasts move above it. */
  dialogueOpen: boolean;
  /** The day's event, in capitals, or empty when the day is clear. */
  eventName: string;
  /** The pact taken this morning, shown under the event. */
  pactName: string;
  /** Things worth a dot on the minimap: your pack, a crate, the trader. */
  marks: Array<{ x: number; y: number; color: string }>;
  /** The player's world position, for the minimap. */
  playerX: number;
  playerY: number;
}

export const hud: HudState = {
  visible: true,
  context: 'camp',
  hp: 60,
  maxHp: 60,
  cold: 0,
  maxCold: 100,
  day: 1,
  phaseName: 'MORNING',
  dayProgress: 0,
  secondsLeft: 0,
  showSeconds: false,
  dashCharge: 1,
  weaponName: 'RUSTED AXE',
  weaponColor: '#c3ccdd',
  comboCount: 0,
  chargeAmount: 0,
  carried: emptyResources(),
  homeAngle: null,
  bossName: null,
  bossHp: 0,
  bossMaxHp: 1,
  mapHidden: false,
  dialogueOpen: false,
  eventName: '',
  pactName: '',
  marks: [],
  playerX: 0,
  playerY: 0,
};

export function resetHud(): void {
  hud.carried = emptyResources();
  hud.comboCount = 0;
  hud.chargeAmount = 0;
  hud.homeAngle = null;
  hud.cold = 0;
}
