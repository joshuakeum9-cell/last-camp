/**
 * Every tunable number in the game. Logic files import from here; they must not hold
 * magic numbers a designer would want to change.
 */
export const BAL = {
  // --- render ------------------------------------------------------------
  view: { width: 480, height: 270 },
  tile: 16,
  world: { cols: 100, rows: 60 },

  // --- player movement ---------------------------------------------------
  player: {
    speed: 92,
    /** Seconds to reach full speed and to stop. Small numbers feel snappy. */
    accelTime: 0.07,
    stopTime: 0.05,
    baseMaxHp: 75,
    /** Radius of the physics body, in pixels. */
    bodyRadius: 5,
    /** Body offset from the 16x22 sprite's top-left. */
    bodyOffset: { x: 3, y: 12 },
    invulnAfterHit: 0.75,
    knockbackTaken: 90,
  },

  dash: {
    distance: 48,
    duration: 0.15,
    cooldown: 0.8,
    cooldownQuickStep: 0.6,
    afterimages: 3,
    /** A dash that starts within this many seconds of an incoming hit is a perfect dodge. */
    perfectWindow: 0.1,
    perfectSlowMo: 0.3,
    perfectSlowMoMs: 120,
    perfectCritWindow: 1.0,
  },

  camera: {
    lerp: 0.12,
    deadzone: { w: 40, h: 24 },
    lookAhead: 12,
  },

  /** Presses are remembered this long so an input during a swing still fires. */
  inputBufferMs: 120,

  // --- combat ------------------------------------------------------------
  combat: {
    critMultiplier: 2.0,
    hitstopMs: 60,
    hitstopCritMs: 90,
    hitstopKillMs: 110,
    hitstopScale: 0.05,
    flashMs: 80,
    shake: { hit: 2, crit: 4, kill: 6, boss: 8 },
    shakeMs: { hit: 80, crit: 120, kill: 140 },
    chargeTime: 0.55,
    /** A press held this long is a charge, not a swing. Shorter is a tap. */
    holdToCharge: 0.14,
    chargeDamageMult: 2.5,
    chargeKnockbackMult: 1.6,
    comboWindow: 0.45,
    /** Pickups within this radius fly to the player. */
    magnetRadius: 28,
    magnetSpeed: 260,
  },

  // --- day cycle ---------------------------------------------------------
  day: {
    /** Seconds of expedition time in one full day. */
    length: 240,
    phases: [
      { id: 'morning', name: 'MORNING', until: 80, darkness: 0.0, coldMult: 1.0, enemyDmg: 1.0 },
      { id: 'midday', name: 'MIDDAY', until: 150, darkness: 0.0, coldMult: 1.0, enemyDmg: 1.0 },
      { id: 'evening', name: 'EVENING', until: 200, darkness: 0.22, coldMult: 1.3, enemyDmg: 1.0 },
      { id: 'nightfall', name: 'NIGHTFALL', until: 240, darkness: 0.6, coldMult: 1.5, enemyDmg: 1.1 },
      { id: 'night', name: 'NIGHT', until: Infinity, darkness: 0.8, coldMult: 1.8, enemyDmg: 1.25 },
    ],
    /** Resources gathered after nightfall are worth this much more in the summary. */
    nightBounty: 1.5,
    nightEnemySpeed: 1.15,
    /** Chance of a storm, from this day onward. */
    stormFromDay: 3,
    stormChance: 0.35,
    stormMult: 1.5,
  },

  // --- cold --------------------------------------------------------------
  cold: {
    max: 100,
    /** Points per second, outdoors, before any multiplier. */
    baseRate: 0.3,
    exposedMult: 1.5,
    stormMult: 1.5,
    campfireRate: -12,
    shelterRate: -4,
    warnAt: 70,
    /** Health lost per second at maximum cold. */
    damagePerSec: 2,
    slowAtMax: 0.2,
    foodRelief: 15,
    brothRelief: 50,
    /** Resistance is capped so cold always matters. */
    maxResistance: 0.6,
  },

  // --- death and return --------------------------------------------------
  death: {
    /** Fraction of the run's haul lost, before Storage upgrades. */
    lossBase: 0.5,
    lossStorage1: 0.25,
    lossStorage2: 0.1,
  },
  /** Bonus for returning with no damage taken. */
  untouchedBonus: 0.1,

  /** Nothing stacks past this. Bank it at camp or spend it. */
  resourceCap: 999,

  // --- recovery ----------------------------------------------------------
  camp: {
    cols: 30,
    rows: 20,
    /** Health per second while standing in the firelight. A full heal is a short wait. */
    fireHealPerSec: 7,
    /** Cold shed per second in the firelight. */
    fireColdPerSec: 14,
    /** How close to the fire counts, in pixels. */
    fireRadius: 84,
    /** Walk this close to the portal's centre and the day starts. */
    portalRadius: 14,
    /** Fraction of max health you wake with after collapsing out there. */
    wakeHpFraction: 0.5,
    /** Cold is capped at this on waking, so the fire has less to undo. */
    wakeColdMax: 40,
  },
  /** Old fire pits out in the world. Two wood lights one for the rest of the day. */
  warmSpot: {
    woodCost: 2,
    /** Within this the cold drains as if at the camp fire. */
    radius: 52,
    lightRadius: 84,
  },
  /** Thin ice on the lake. Stand on a crack too long and it goes. */
  thinIce: {
    breakAfterMs: 650,
    coldSpike: 22,
    cooldownMs: 2500,
  },
  eat: {
    /** Seconds between bites, so a stack of food cannot be inhaled mid-fight. */
    cooldown: 1.2,
  },

  // --- enemy scaling by day ----------------------------------------------
  scaling: {
    hpPerDay: 0.06,
    hpCap: 1.45,
    damagePerDay: 0.03,
    damageCap: 1.25,
    /** A pack grows this slowly on purpose: day eight should not be a wall of bodies. */
    packBonusEveryDays: 3,
    packBonusCap: 1,
  },

  // --- loot --------------------------------------------------------------
  loot: {
    /** Weights out of 1000 for a cache roll, before Lucky Find. */
    rarityWeights: { common: 620, uncommon: 260, rare: 100, epic: 20 },
    luckyFindPoints: 8,
    modifierCount: { common: 0, uncommon: 1, rare: 2, epic: 3 },
  },

  // --- offline -----------------------------------------------------------
  offline: {
    minutesPerUnit: 10,
    capUnits: 6,
  },

  // --- audio defaults ----------------------------------------------------
  audio: { music: 0.5, sfx: 0.7 },

  // --- performance -------------------------------------------------------
  perf: {
    enemySleepDistance: 400,
    maxActiveEnemies: 40,
    darknessFps: 30,
  },
} as const;

export type PhaseId = 'morning' | 'midday' | 'evening' | 'nightfall' | 'night';

export function phaseAt(timeSec: number) {
  for (const p of BAL.day.phases) {
    if (timeSec < p.until) return p;
  }
  return BAL.day.phases[BAL.day.phases.length - 1];
}

/** Enemy stat multipliers for a given day. */
export function dayScale(day: number) {
  const d = Math.max(0, day - 1);
  return {
    hp: Math.min(BAL.scaling.hpCap, 1 + BAL.scaling.hpPerDay * d),
    damage: Math.min(BAL.scaling.damageCap, 1 + BAL.scaling.damagePerDay * d),
    pack: Math.min(BAL.scaling.packBonusCap, Math.floor(d / BAL.scaling.packBonusEveryDays)),
  };
}
