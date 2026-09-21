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
    desc: 'Animals hit softer and move slower. The cold is patient. Mistakes cost less.',
    enemyHp: 0.85,
    enemyDamage: 0.65,
    enemySpeed: 0.85,
    coldRate: 0.7,
    deathLoss: 0.6,
    telegraph: 1.25,
  },
  normal: {
    id: 'normal',
    name: 'Hard Winter',
    desc: 'The winter as it was designed. Start here.',
    enemyHp: 1,
    enemyDamage: 1,
    enemySpeed: 1,
    coldRate: 1,
    deathLoss: 1,
    telegraph: 1,
  },
  hard: {
    id: 'hard',
    name: 'Killing Cold',
    desc: 'Animals are faster and hit far harder. The cold does not wait. Falling hurts.',
    enemyHp: 1.25,
    enemyDamage: 1.45,
    enemySpeed: 1.12,
    coldRate: 1.35,
    deathLoss: 1.3,
    telegraph: 0.85,
  },
};

export const DIFFICULTY_LIST = DIFFICULTY_IDS.map((id) => DIFFICULTIES[id]);

/** The settings that are in force right now. Everything reads difficulty through this. */
export function activeDifficulty(id: string | undefined): DifficultyDef {
  return DIFFICULTIES[(id as DifficultyId) ?? 'normal'] ?? DIFFICULTIES.normal;
}
