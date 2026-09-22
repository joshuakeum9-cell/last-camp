export const DIFFICULTY_IDS = ['easy', 'normal', 'hard'] as const;
export type DifficultyId = (typeof DIFFICULTY_IDS)[number];

export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  /** One line the player reads before choosing. */
  desc: string;
  enemyHp: number;
  enemyDamage: number;
  enemySpeed: number;
  /** Multiplies how many packs an area holds. */
  spawnRate: number;
  /** How fast the cold takes hold. */
  coldRate: number;
  /** Multiplies the fraction of a haul lost when you fall. */
  deathLoss: number;
  /** How long enemies hold their tell. Higher is easier to read. */
  telegraph: number;
}

/**
 * Difficulty changes how dangerous the wilderness is, never how much it gives you.
 *
 * Yields, costs and drop rates are identical across all three, so the pacing table in
 * ECONOMY.md holds whichever you pick and nobody is pushed toward Easy to make
 * progress at a reasonable speed. What changes is how hard the animals hit, how fast
 * they close, how quickly you freeze, and how much a bad day costs.
 */
export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  easy: {
    id: 'easy',
    name: 'Bearable',
    desc: 'Softer hits, slower animals, a patient cold.',
    enemyHp: 0.8,
    enemyDamage: 0.5,
    enemySpeed: 0.82,
    spawnRate: 0.65,
    coldRate: 0.6,
    deathLoss: 0.5,
    telegraph: 1.3,
  },
  normal: {
    id: 'normal',
    name: 'Hard Winter',
    desc: 'The winter as it was designed. Start here.',
    enemyHp: 1,
    enemyDamage: 1,
    enemySpeed: 1,
    spawnRate: 1,
    coldRate: 1,
    deathLoss: 1,
    telegraph: 1,
  },
  hard: {
    id: 'hard',
    name: 'Killing Cold',
    desc: 'Faster, harder animals. The cold does not wait.',
    enemyHp: 1.2,
    enemyDamage: 1.25,
    enemySpeed: 1.1,
    spawnRate: 1.3,
    coldRate: 1.25,
    deathLoss: 1.25,
    telegraph: 0.9,
  },
};

export const DIFFICULTY_LIST = DIFFICULTY_IDS.map((id) => DIFFICULTIES[id]);

/** The settings that are in force right now. Everything reads difficulty through this. */
export function activeDifficulty(id: string | undefined): DifficultyDef {
  return DIFFICULTIES[(id as DifficultyId) ?? 'normal'] ?? DIFFICULTIES.normal;
}
