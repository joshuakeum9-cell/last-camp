import { BAL } from '../data/balance';
import {
  emptyConsumables,
  emptyResources,
  type ConsumableId,
  type ResourceId,
} from '../data/resources';
import { emptyPerks, type PerkId } from '../data/perks';
import { type UpgradeId } from '../data/upgrades';
import type { AreaId, GateId } from '../data/areas';
import type { Rarity } from '../art/palette';
import type { PhaseId } from '../data/balance';
import type { DifficultyId } from '../data/difficulty';

export const SAVE_VERSION = 1;

/** A weapon the player owns. Definitions live in data/weapons.ts; this is the save data. */
export interface WeaponInstance {
  uid: string;
  /** Base weapon id: axe, knife, spear, bow, hammer. */
  base: string;
  rarity: Rarity;
  /** Modifier ids rolled at drop time. */
  mods: string[];
  /** 0 = base, 1 = reinforced, 2 = branched. */
  tier: number;
  /** Chosen branch id once tier reaches 2. */
  branch: string | null;
}

/** Live state of the current expedition. Null while at camp. */
export interface RunState {
  seed: number;
  timeSec: number;
  phase: PhaseId;
  storm: boolean;
  /** The day's event, see data/events.ts. */
  event: string;
  /** What last hurt the player, for the death line. */
  lastHitBy: string;
  hp: number;
  cold: number;
  collected: Record<ResourceId, number>;
  /** Subset of `collected` gathered after nightfall, for the night bounty line. */
  nightCollected: Record<ResourceId, number>;
  kills: number;
  damageTaken: number;
  rareFinds: number;
  newAreas: AreaId[];
  notesFound: string[];
  weaponsFound: string[];
  breakables: number;
  /** Set once the player is still outside at night. */
  wentOutAtNight: boolean;
}

export interface GameState {
  version: number;
  createdAt: number;
  lastSeenAt: number;
  day: number;

  camp: {
    upgrades: Partial<Record<UpgradeId, number>>;
    storage: Record<ResourceId, number>;
    level: 1 | 2 | 3 | 4 | 5;
    shortcutBuilt: boolean;
  };

  player: {
    /** Carried between the world and the camp. Nothing resets them but the fire. */
    hp: number;
    cold: number;
    perks: Record<PerkId, number>;
    weapons: WeaponInstance[];
    /** Two slots. The second is null until the Weapon Rack is built. */
    equipped: [string | null, string | null];
    /** Which slot is in the hand. Slots keep their place; only this moves. */
    activeSlot: 0 | 1;
    consumables: Record<ConsumableId, number>;
    cosmetics: { outfit: string; weaponSkin: string; fireColor: string; trail: string; title: string };
  };

  run: RunState | null;

  map: {
    discoveredAreas: AreaId[];
    openedGates: GateId[];
    secretFound: boolean;
    cachesOpened: string[];
    /** What was dropped where you last fell, waiting to be picked up. */
    deathPack: { x: number; y: number; day: number; lost: Record<ResourceId, number> } | null;
  };

  story: {
    notesFound: string[];
    miraRescued: boolean;
    miraAssignment: 'wood' | 'food' | 'scrap' | null;
    /** Mira comes out with the player instead of working the camp. */
    miraFollows: boolean;
    /** The alpha's pup has been taken in, and whether it comes along. */
    pupFound: boolean;
    pupFollows: boolean;
    miraAssignedAt: number | null;
    /** Morning report shown for this day already. */
    reportSeenDay: number;
    /** One-time hints already shown, by id. */
    hints: string[];
    /** Mira has told the player about the ranger, so he is out there at night. */
    rangerTold: boolean;
    /** The radio has answered: the tower can be climbed. */
    towerOpen: boolean;
    /** Which ending was taken, or null while the story is still open. */
    ending: 'shutdown' | 'kept' | null;
    /** The day the tower was climbed. */
    finishedOnDay: number;
  };

  bosses: {
    alphaDefeated: boolean;
    mawDefeated: boolean;
    mawAttempts: number;
    stagDefeated: boolean;
    stagAttempts: number;
    rangerDefeated: boolean;
    rangerAttempts: number;
  };

  challenge: {
    id: string;
    dayIssued: number;
    progress: number;
    claimed: boolean;
    source: 'local' | 'remote';
  };

  achievements: Record<string, number | null>;

  stats: {
    enemiesKilled: Record<string, number>;
    /** Enemy ids that have come for the player at least once, for the bestiary. */
    enemiesSeen: string[];
    fishCaught: number;
    tradesMade: number;
    pitsLit: number;
    elitesKilled: number;
    resourcesCollected: number;
    deaths: number;
    daysSurvived: number;
    campUpgradesBought: number;
    bestDay: number;
  };

  store: {
    owned: string[];
    simulatedSpend: number;
    /** Reward id -> the day (or real day number) it was last used. */
    adsUsed: Record<string, number>;
  };

  /** Deeper Winter modifiers switched on, see data/winter.ts. */
  winter: Record<string, boolean>;

  /** Real calendar days played, for the supply crate that greets a return. */
  meta: {
    /** YYYY-MM-DD of the last day the game was opened. */
    lastVisit: string;
    streak: number;
    bestStreak: number;
    /** How many winters have been played through to the tower. */
    winters: number;
  };

  settings: {
    difficulty: DifficultyId;
    music: number;
    sfx: number;
    shake: number;
    flashReduction: boolean;
    largeText: boolean;
    longTelegraphs: boolean;
    touchOpacity: number;
    showTouch: 'auto' | 'on' | 'off';
  };
}

export function newGameState(): GameState {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSeenAt: now,
    day: 1,
    camp: {
      upgrades: {},
      storage: emptyResources(),
      level: 1,
      shortcutBuilt: false,
    },
    player: {
      hp: BAL.player.baseMaxHp,
      cold: 0,
      perks: emptyPerks(),
      weapons: [{ uid: 'w-axe-0', base: 'axe', rarity: 'common', mods: [], tier: 0, branch: null }],
      equipped: ['w-axe-0', null],
      activeSlot: 0,
      consumables: emptyConsumables(),
      cosmetics: { outfit: 'default', weaponSkin: 'default', fireColor: 'default', trail: 'none', title: 'none' },
    },
    run: null,
    map: {
      discoveredAreas: ['gate'],
      openedGates: [],
      secretFound: false,
      cachesOpened: [],
      deathPack: null,
    },
    story: {
      notesFound: [],
      miraRescued: false,
      miraAssignment: null,
      miraFollows: false,
      pupFound: false,
      pupFollows: true,
      miraAssignedAt: null,
      reportSeenDay: 0,
      hints: [],
      rangerTold: false,
      towerOpen: false,
      ending: null,
      finishedOnDay: 0,
    },
    bosses: { alphaDefeated: false, mawDefeated: false, mawAttempts: 0, stagDefeated: false, stagAttempts: 0, rangerDefeated: false, rangerAttempts: 0 },
    challenge: { id: '', dayIssued: 0, progress: 0, claimed: false, source: 'local' },
    achievements: {},
    stats: {
      enemiesKilled: {},
      enemiesSeen: [],
      fishCaught: 0,
      tradesMade: 0,
      pitsLit: 0,
      elitesKilled: 0,
      resourcesCollected: 0,
      deaths: 0,
      daysSurvived: 0,
      campUpgradesBought: 0,
      bestDay: 0,
    },
    store: { owned: [], simulatedSpend: 0, adsUsed: {} },
    winter: {},
    meta: { lastVisit: '', streak: 0, bestStreak: 0, winters: 0 },
    settings: {
      difficulty: 'normal',
      music: BAL.audio.music,
      sfx: BAL.audio.sfx,
      shake: 1,
      flashReduction: false,
      largeText: false,
      longTelegraphs: false,
      touchOpacity: 0.55,
      showTouch: 'auto',
    },
  };
}

export function newRunState(seed: number, maxHp: number, storm: boolean, event = 'clear'): RunState {
  return {
    seed,
    timeSec: 0,
    phase: 'morning',
    storm,
    event,
    lastHitBy: '',
    hp: maxHp,
    cold: 0,
    collected: emptyResources(),
    nightCollected: emptyResources(),
    kills: 0,
    damageTaken: 0,
    rareFinds: 0,
    newAreas: [],
    notesFound: [],
    weaponsFound: [],
    breakables: 0,
    wentOutAtNight: false,
  };
}

/**
 * The single live state object. Systems read and write this directly; it is replaced
 * wholesale only by SaveSystem on load or by starting a new camp.
 */
/**
 * A new winter after the tower: the valley resets, the survivor does not. What
 * carries over is what was learned and earned: achievements, titles, cosmetics,
 * the bestiary, the streak, the settings, and the best day. Deeper Winter is
 * open from the first morning.
 */
export function newWinterState(prev: GameState): GameState {
  const next = newGameState();
  next.achievements = { ...prev.achievements };
  next.store = { ...prev.store, owned: [...prev.store.owned] };
  next.player.cosmetics = { ...prev.player.cosmetics };
  next.stats.enemiesSeen = [...prev.stats.enemiesSeen];
  next.stats.enemiesKilled = { ...prev.stats.enemiesKilled };
  next.stats.bestDay = prev.stats.bestDay;
  next.stats.deaths = 0;
  next.settings = { ...prev.settings };
  next.meta = { ...prev.meta, winters: (prev.meta.winters ?? 0) + 1 };
  next.story.hints = [...prev.story.hints];
  return next;
}

export let state: GameState = newGameState();

export function setState(next: GameState): void {
  state = next;
}

/** Deep-ish clone used when writing a save, so later mutation cannot corrupt the blob. */
export function snapshot(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s)) as GameState;
}
