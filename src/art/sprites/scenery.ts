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
  B: 'ember',
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

/** A trunk that came down years ago, half buried. */
const FALLEN_LOG = [
  '..ttttttttttttt.',
  '.tTTTTTTTTTTTTTt',
  'tTbTTbTTTbTTTbTt',
  'tTTTTTTTTTTTTTTt',
  '.tTTTTTTTTTTTTt.',
  '.sttttttttttts..',
  'ssssssssssssss..',
];

/** A wind-heaped mound of snow. */
const SNOW_MOUND = [
  '.....wwww.....',
  '...wwwwwwww...',
  '..wwwwwwwwww..',
  '.wwwwwwwwwwww.',
  'wwwwwwwwwwwwww',
  'wwwshhwwwshhww',
  '.sssssssssss..',
];

/** A shrub the winter got to. */
const DEAD_SHRUB = [
  '..t...t..t....',
  '.t.t.t.t.t.t..',
  '..t.t.t.t.t...',
  '...ttTtTtt....',
  '....tTTTt.....',
  '.....TTT......',
  '..ssssssss....',
  '.ssssssssss...',
];

/** Frozen grass poking through the snow. */
const GRASS_TUFT = [
  '.h..h...h.',
  'h.h.h.h.h.',
  '.hhh.hhh..',
  '..hhhhh...',
  '.sssssss..',
];

/** Something did not make it through the winter. */
const BONES = [
  '..wwww....',
  '.wwoowww..',
  '.wwwwwww..',
  '..wwwww...',
  '.w.w.w.w..',
  'w..w.w..w.',
  '.ssssssss.',
];

/** A road sign nobody is reading any more. */
const SIGNPOST = [
  '.mmmmmmmmm..',
  'mMMMMMMMMMm.',
  'mMdddMdddMm.',
  'mMMMMMMMMMm.',
  'mMdddddMMMm.',
  'mMMMMMMMMMm.',
  '.mmmmmmmmm..',
  '.....tt.....',
  '.....tt.....',
  '.....tt.....',
  '.....tt.....',
  '....ssss....',
];

/** A ring of stones somebody once cooked over. */
const OLD_FIRE = [
  '..rr..rr..',
  '.r..rr..r.',
  'r..bbbb..r',
  'r.bbBBbb.r',
  'r..bbbb..r',
  '.r..rr..r.',
  '..rrrrrr..',
  '.ssssssss.',
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
  fallenLog: 'sc-fallen-log',
  snowMound: 'sc-snow-mound',
  deadShrub: 'sc-dead-shrub',
  grassTuft: 'sc-grass-tuft',
  bones: 'sc-bones',
  signpost: 'sc-signpost',
  oldFire: 'sc-old-fire',
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
  make(SCENERY_KEYS.fallenLog, FALLEN_LOG);
  make(SCENERY_KEYS.snowMound, SNOW_MOUND);
  make(SCENERY_KEYS.deadShrub, DEAD_SHRUB);
  make(SCENERY_KEYS.grassTuft, GRASS_TUFT);
  make(SCENERY_KEYS.bones, BONES);
  make(SCENERY_KEYS.signpost, SIGNPOST);
  make(SCENERY_KEYS.oldFire, OLD_FIRE);
}
