import type { ResourceId } from './resources';

export const CHALLENGE_IDS = [
  'kill10',
  'wood20',
  'wolves3',
  'untouched',
  'rareCache',
  'food5',
  'break15',
  'nightfall',
] as const;
export type ChallengeId = (typeof CHALLENGE_IDS)[number];

export interface ChallengeDef {
  id: ChallengeId;
  label: string;
  target: number;
  reward: Partial<Record<ResourceId, number>>;
  /** Which event moves it forward. DailyChallengeSystem maps these. */
  track:
    | 'kills'
    | 'wood'
    | 'wolfKills'
    | 'untouchedReturn'
    | 'rareCache'
    | 'food'
    | 'breakables'
    | 'reachNightfall';
}

/**
 * One rotating challenge per day. Missing one costs nothing: it is a nudge toward
 * playing differently for a day, not a chore with a penalty attached.
 */
export const CHALLENGES: Record<ChallengeId, ChallengeDef> = {
  kill10: {
    id: 'kill10',
    label: 'Put down ten of them',
    target: 10,
    reward: { scrap: 6, food: 2 },
    track: 'kills',
  },
  wood20: {
    id: 'wood20',
    label: 'Bring home twenty wood',
    target: 20,
    reward: { scrap: 5 },
    track: 'wood',
  },
  wolves3: {
    id: 'wolves3',
    label: 'Kill three Ice Wolves',
    target: 3,
    reward: { food: 5, scrap: 4 },
    track: 'wolfKills',
  },
  untouched: {
    id: 'untouched',
    label: 'Come home without a scratch',
    target: 1,
    reward: { crystal: 1, scrap: 5 },
    track: 'untouchedReturn',
  },
  rareCache: {
    id: 'rareCache',
    label: 'Open something rare',
    target: 1,
    reward: { scrap: 8 },
    track: 'rareCache',
  },
  food5: {
    id: 'food5',
    label: 'Gather five food',
    target: 5,
    reward: { wood: 8 },
    track: 'food',
  },
  break15: {
    id: 'break15',
    label: 'Break fifteen things open',
    target: 15,
    reward: { wood: 6, scrap: 4 },
    track: 'breakables',
  },
  nightfall: {
    id: 'nightfall',
    label: 'Still be out there at nightfall',
    target: 1,
    reward: { crystal: 1, food: 3 },
    track: 'reachNightfall',
  },
};

export const CHALLENGE_LIST = CHALLENGE_IDS.map((id) => CHALLENGES[id]);
