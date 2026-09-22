export const ACHIEVEMENT_IDS = [
  'firstNight',
  'scavenger',
  'packHunter',
  'prepared',
  'untouched',
  'curious',
  'nightwalker',
  'theWhiteMaw',
  'theHollowStag',
  'theOneWhoStayed',
  'theTower',
  'notEmpty',
  'wholeStory',
] as const;
export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

export interface AchievementDef {
  id: AchievementId;
  name: string;
  desc: string;
  /** What unlocking it gives. Cosmetic only, always. */
  reward: { kind: 'title' | 'outfit' | 'skin' | 'fire' | 'trail'; value: string; label: string };
}

/** Long-term goals that are not on the critical path. Rewards are never power. */
export const ACHIEVEMENTS: Record<AchievementId, AchievementDef> = {
  firstNight: {
    id: 'firstNight',
    name: 'First Night',
    desc: 'Survive a whole day and get home.',
    reward: { kind: 'title', value: 'survivor', label: 'Title: Survivor' },
  },
  scavenger: {
    id: 'scavenger',
    name: 'Scavenger',
    desc: 'Gather a hundred of anything.',
    reward: { kind: 'trail', value: 'dust', label: 'Snow trail: Dust' },
  },
  packHunter: {
    id: 'packHunter',
    name: 'Pack Hunter',
    desc: 'Kill ten Ice Wolves.',
    reward: { kind: 'skin', value: 'bone', label: 'Weapon skin: Bone' },
  },
  prepared: {
    id: 'prepared',
    name: 'Prepared',
    desc: 'Build five things at camp.',
    reward: { kind: 'fire', value: 'gold', label: 'Campfire: Gold' },
  },
  untouched: {
    id: 'untouched',
    name: 'Untouched',
    desc: 'Come home from a full day without being hit once.',
    reward: { kind: 'title', value: 'unmarked', label: 'Title: Unmarked' },
  },
  curious: {
    id: 'curious',
    name: 'Curious',
    desc: 'Find the place nothing pointed you toward.',
    reward: { kind: 'outfit', value: 'frost', label: 'Outfit: Frost White' },
  },
  nightwalker: {
    id: 'nightwalker',
    name: 'Nightwalker',
    desc: 'Get home after dark with a full night bounty.',
    reward: { kind: 'fire', value: 'blue', label: 'Campfire: Cold Blue' },
  },
  theWhiteMaw: {
    id: 'theWhiteMaw',
    name: 'The White Maw',
    desc: 'Kill the thing in the den.',
    reward: { kind: 'title', value: 'mawbreaker', label: 'Title: Mawbreaker' },
  },
  theHollowStag: {
    id: 'theHollowStag',
    name: 'The Hollow Stag',
    desc: 'Bring down what paces the tower pass.',
    reward: { kind: 'title', value: 'stagbreaker', label: 'Title: Stagbreaker' },
  },
  theOneWhoStayed: {
    id: 'theOneWhoStayed',
    name: 'The One Who Stayed',
    desc: 'Put out the lantern at the cabin.',
    reward: { kind: 'title', value: 'lightkeeper', label: 'Title: Lightkeeper' },
  },
  theTower: {
    id: 'theTower',
    name: 'Two Hundred Steps',
    desc: 'Climb the tower and decide what the valley is for.',
    reward: { kind: 'title', value: 'climber', label: 'Title: Climber' },
  },
  notEmpty: {
    id: 'notEmpty',
    name: 'Not Empty Any More',
    desc: 'Bring Mira back to camp.',
    reward: { kind: 'trail', value: 'ember', label: 'Snow trail: Ember' },
  },
  wholeStory: {
    id: 'wholeStory',
    name: 'Everything Written Down',
    desc: 'Find all six notes.',
    reward: { kind: 'title', value: 'archivist', label: 'Title: Archivist' },
  },
};

export const ACHIEVEMENT_LIST = ACHIEVEMENT_IDS.map((id) => ACHIEVEMENTS[id]);
