import Phaser from 'phaser';
import { PixelFactory } from '../PixelFactory';

/**
 * Wilderness props. Phase 1 places these as decoration; Phase 3 turns the harvestable
 * ones into ResourceNode entities using the same textures.
 */
const P: Record<string, string | null> = {
  '.': null,
  o: '#083a1e',
  g: 'greenDark',
  l: 'green',
  w: 'white',
  s: 'snow',
  h: 'snowShade',
  t: 'bark',
  T: 'woodDark',
  r: 'greyDark',
  R: 'grey',
  d: 'deep',
  c: 'cyan',
  C: 'ice',
  b: 'blue',
  m: 'steel',
  M: 'blueDark',
  e: 'ember',
  y: 'gold',
  n: 'wood',
};

const PINE = [
  '.......oo.......',
  '......oggo......',
  '......ollo......',
  '.....oggggo.....',
  '.....ogllgo.....',
  '....oggggggo....',
  '....osggggso....',
  '...oggllggggo...',
  '...oggggggggo...',
  '.....oggggo.....',
  '....oggllggo....',
  '...oggggggggo...',
  '..oggggsgggggo..',
  '..ogglllgggggo..',
  '.oggggggggggggo.',
  '......oggo......',
  '.....oggggo.....',
  '....oggllggo....',
  '...oggggggggo...',
  '..ogggsggggggo..',
  '.ogggggggggggo..',
  'oggllggggggggggo',
  'ogggggggggggggo.',
  '.oooooooooooooo.',
  '......oTTo......',
  '......oTTo......',
  '.....osTTso.....',
  '....ssssssss....',
];

const PINE_SMALL = [
  '......oo......',
  '.....oggo.....',
  '.....ollo.....',
  '....oggggo....',
  '....ogllgo....',
  '...oggggggo...',
  '...osggggso...',
  '..oggllgggo...',
  '..oggggggggo..',
  '.oggggggggggo.',
  '.ooooooooooo..',
  '.....oTTo.....',
  '.....oTTo.....',
  '....ssssss....',
];

const DEAD_TREE = [
  '..t........t....',
  '..tt......tt....',
  '...tt....tt.....',
  '....ttTTtt......',
  '.t...tTTt...t...',
  '..tt..TTt..tt...',
  '...tt.TT.tt.....',
  '.....tTTt.......',
  '......TT........',
  '.....tTTt.......',
  '.....TTTT.......',
  '....TTTTTT......',
  '....sTTTTs......',
  '...ssssssss.....',
];

const ROCK = [
  '....rrrr....',
  '..rrRRRRrr..',
  '.rRRRRRRRRr.',
  'rRRRrrRRRRRr',
  'rRRrrrrRRRRr',
  'rRRRrrRRRRRr',
  '.rRRRRRRRRr.',
  '..ssrrrrss..',
  '.ssssssssss.',
];

const ROCK_SMALL = ['..rrrr..', '.rRRRRr.', 'rRRrrRRr', '.rRRRRr.', '..ssss..'];

/** A wrecked car: the road's scrap node. */
const WRECK = [
  '.....MMMMMMMM.....',
  '...MMmmmmmmmmMM...',
  '..MmmCCCCCCCCmmM..',
  '.MmmCCbbbbbbCCmmM.',
  'MmmmCCbbbbbbCCmmmM',
  'Mmmmmmmmmmmmmmmm M',
  'MmmrrmmmmmmmmrrmmM',
  'sMmrrmmmmmmmmrrmMs',
  '.sMMMMMMMMMMMMMMs.',
  '..ssoossssssoos...',
  '..sssssssssssss...',
];

/** Frost crystal spire. The rare resource, and the strangest thing in the region. */
const CRYSTAL = [
  '.....cc.....',
  '....cCCc....',
  '....cCCc....',
  '...cCCCCc...',
  '..ccCCCCcc..',
  '..cCCCCCCc..',
  '.ccCCCCCCcc.',
  '.cCCCCCCCCc.',
  'ccCCCCCCCCcc',
  'cCCCCbbCCCCc',
  'cCCCbbbbCCCc',
  '.cCCCbbCCCc.',
  '.ccCCCCCCcc.',
  '..cCCCCCCc..',
  '..sscCCcss..',
  '.ssssccssss.',
  '..ssssssss..',
];

const BUSH = [
  '...gg..gg...',
  '..glggglgg..',
  '.gglllgggg..',
  'ggllegglleg.',
  'gglllggllgg.',
  '.ggllgggggg.',
  '..gsggggsg..',
  '..ssssssss..',
];

const CRATE = [
  '.nnnnnnnnnn.',
  'nTTTTTTTTTTn',
  'nTnnnnnnnnTn',
  'nTnTTTTTTnTn',
  'nTnTnnnnTnTn',
  'nTnTnnnnTnTn',
  'nTnTTTTTTnTn',
  'nTnnnnnnnnTn',
  'nTTTTTTTTTTn',
  '.nnnnnnnnnn.',
  '..ssssssss..',
];

const ICE_CHUNK = [
  '...cccc...',
  '..cCCCCc..',
  '.cCCbbCCc.',
  'cCCbbbbCCc',
  'cCbbbbbbCc',
  'cCCbbbbCCc',
  '.cCCCCCCc.',
  '..sccccs..',
  '..ssssss..',
];

/** Distant ridge line drawn behind everything, with the signal tower on it. */
const TOWER = [
  '....o....',
  '...ooo...',
  '...oeo...',
  '...ooo...',
  '..o.o.o..',
  '..o.o.o..',
  '.o..o..o.',
  '.o..o..o.',
  'o...o...o',
  'o..ooo..o',
  'o.o...o.o',
  'ooo...ooo',
];

export const SCENERY_KEYS = {
  pine: 'sc-pine',
  pineSmall: 'sc-pine-small',
  deadTree: 'sc-dead-tree',
  rock: 'sc-rock',
  rockSmall: 'sc-rock-small',
  wreck: 'sc-wreck',
  crystal: 'sc-crystal',
  bush: 'sc-bush',
  crate: 'sc-crate',
  iceChunk: 'sc-ice-chunk',
  tower: 'sc-tower',
} as const;

export function buildScenery(scene: Phaser.Scene): void {
  const make = (key: string, rows: string[]) => PixelFactory.makeTexture(scene, key, rows, P);
  make(SCENERY_KEYS.pine, PINE);
  make(SCENERY_KEYS.pineSmall, PINE_SMALL);
  make(SCENERY_KEYS.deadTree, DEAD_TREE);
  make(SCENERY_KEYS.rock, ROCK);
  make(SCENERY_KEYS.rockSmall, ROCK_SMALL);
  make(SCENERY_KEYS.wreck, WRECK);
  make(SCENERY_KEYS.crystal, CRYSTAL);
  make(SCENERY_KEYS.bush, BUSH);
  make(SCENERY_KEYS.crate, CRATE);
  make(SCENERY_KEYS.iceChunk, ICE_CHUNK);
  make(SCENERY_KEYS.tower, TOWER);
}
