import Phaser from 'phaser';
import type { PixelSprite } from '../PixelFactory';
import { PixelFactory } from '../PixelFactory';

const P: Record<string, string | null> = {
  '.': null,
  e: 'ember',
  o: 'orange',
  y: 'gold',
  w: 'cream',
  k: 'woodDark',
  n: 'wood',
  b: 'bark',
  r: 'ember',
  c: 'orange',
  s: 'snow',
  h: 'snowShade',
  g: 'grey',
  m: 'steel',
  t: 'teal',
  d: 'rust',
  D: 'navy',
  i: 'cyan',
  G: 'greyDark',
  P: 'blood',
  v: 'violet',
  V: 'violetDark',
};

/** The campfire. The most recognisable thing in the game, so it gets real frames. */
const FIRE_FRAMES: string[][] = [
  [
    '................',
    '................',
    '.......y........',
    '......yyy.......',
    '......ywy.......',
    '.....oyyyo......',
    '.....oywyo......',
    '....eoyyyoe.....',
    '....eoyyyoe.....',
    '...eeoyyyoee....',
    '...eeooyooee....',
    '...eeeoooeee....',
    '..kkeeeoeeekk...',
    '.kkkkeeeeekkkk..',
    '.kbkkkkkkkkkbk..',
    '..kk.kkkk.kkk...',
  ],
  [
    '................',
    '.......y........',
    '......yy........',
    '......ywy.......',
    '.....oywyo......',
    '.....oyyyo......',
    '....eoywyoe.....',
    '....eoyyyoe.....',
    '...eeoyyyoee....',
    '...eeoyyyoee....',
    '...eeooooeee....',
    '..eeeeoooeeee...',
    '..kkeeeoeeekk...',
    '.kkkkeeeeekkkk..',
    '.kbkkkkkkkkkbk..',
    '..kk.kkkk.kkk...',
  ],
  [
    '................',
    '................',
    '........y.......',
    '.......yyy......',
    '.......ywy......',
    '......oyyyo.....',
    '.....eoywyo.....',
    '....eeoyyyoe....',
    '....eeoyyyoe....',
    '...eeeoyyyoe....',
    '...eeooyooee....',
    '...eeeoooeee....',
    '..kkeeeoeeekk...',
    '.kkkkeeeeekkkk..',
    '.kbkkkkkkkkkbk..',
    '..kk.kkkk.kkk...',
  ],
  [
    '................',
    '................',
    '......y.........',
    '.....yyy........',
    '.....ywy........',
    '....oyyyo.......',
    '....oywyoe......',
    '...eoyyyoee.....',
    '...eoyyyoee.....',
    '..eeoyyyoeee....',
    '...eeoyooee.....',
    '...eeeoooeee....',
    '..kkeeeoeeekk...',
    '.kkkkeeeeekkkk..',
    '.kbkkkkkkkkkbk..',
    '..kk.kkkk.kkk...',
  ],
];

export const campfireSprite: PixelSprite = {
  key: 'campfire',
  fps: 9,
  palette: P,
  anims: { burn: FIRE_FRAMES },
};

/** The same flames in the two colours the store and the achievements hand out. */
export const FIRE_COLOURS: Record<string, { key: string; palette: Record<string, string | null>; glow: string }> = {
  default: { key: 'campfire', palette: P, glow: 'orange' },
  blue: { key: 'campfire-blue', palette: { ...P, e: 'blueDark', o: 'ice', y: 'cyan', w: 'white', r: 'blueDark', c: 'ice' }, glow: 'ice' },
  gold: { key: 'campfire-gold', palette: { ...P, e: 'orange', o: 'gold', y: 'cream', w: 'white', r: 'orange', c: 'gold' }, glow: 'gold' },
};

export function fireVariants(): PixelSprite[] {
  return Object.values(FIRE_COLOURS).map((v) => ({ ...campfireSprite, key: v.key, palette: v.palette }));
}

/** Texture key for the fire the player has chosen. */
export function campfireKey(colour: string | undefined): string {
  return (FIRE_COLOURS[colour ?? 'default'] ?? FIRE_COLOURS.default).key;
}

/** Palette name of the glow that goes with that fire. */
export function fireGlowName(colour: string | undefined): string {
  return (FIRE_COLOURS[colour ?? 'default'] ?? FIRE_COLOURS.default).glow;
}

/** Level 1: a tent that barely counts as one. The gaps are holes, and they show. */
const TENT_BROKEN = [
  '...........rr...........',
  '..........rrrr..........',
  '.........rrddrr.........',
  '........rrddddrr........',
  '.......rrdd..ddrr.......',
  '......rrdddd..dddr......',
  '.....rrdddddd..ddrr.....',
  '....rrdddddddd..ddrr....',
  '...rrdddddddddd..ddrr...',
  '..rrdddddd..dddd..ddrr..',
  '.rrddddddd..ddddd..ddrr.',
  'rrdddddddd..dddddd..ddrr',
  'rdddddddd....ddddddd..dr',
  'rddddddd......dddddd...r',
  'kkkkkkkk......kkkkkkkkkk',
  'ssssssss......ssssssssss',
  '.ssssssssssssssssssssss.',
];

/** Level 2 and up: stitched, staked, and actually warm. */
const TENT_PATCHED = [
  '...........cc...........',
  '..........cccc..........',
  '.........cccccc.........',
  '........cccccccc........',
  '.......cccceecccc.......',
  '......ccccceeccccc......',
  '.....ccccccceeccccc.....',
  '....ccccccceeccccccc....',
  '...cccccccceecccccccc...',
  '..ccccccccDDDDcccccccc..',
  '.cccccccccDDDDccccccccc.',
  'ccccccccccDDDDcccccccccc',
  'ccccccccccDDDDcccccccccc',
  'kkkkkkkkkkDDDDkkkkkkkkkk',
  'ssssssssssDDDDssssssssss',
  '.ssssssssssssssssssssss.',
];

const CRATE_STACK = [
  '......nnnnnnnn..',
  '.....nkkkkkkkkn.',
  '.....nknnnnnnkn.',
  '.....nknkkkkkkn.',
  '.....nknkkkkkkn.',
  '.....nknnnnnnkn.',
  '.nnnnnkkkkkkkkn.',
  'nkkkkknnnnnnnn..',
  'nknnnnnnkn......',
  'nknkkkkkkn......',
  'nknkkkkkkn......',
  'nknnnnnnkn......',
  'nkkkkkkkkn......',
  '.nnnnnnnn.......',
  '.sssssssssssss..',
];

const LOG = [
  '..nnnnnnnnnnnn..',
  '.nkkkkkkkkkkkkn.',
  'nkbkkbkkkbkkkkkn',
  'nkkkkkkkkkkkkkkn',
  '.nkkkkkkkkkkkkn.',
  '..nnnnnnnnnnnn..',
  '..ssssssssssss..',
];

const WORKBENCH = [
  '....................',
  '..m..m...mm....m....',
  '..m..m...mm...mmm...',
  'nnnnnnnnnnnnnnnnnnnn',
  'kkkkkkkkkkkkkkkkkkkk',
  'nkn..............nkn',
  'nkn..............nkn',
  'nkn..............nkn',
  'nkn..............nkn',
  'nnn..............nnn',
  'sss..............sss',
  '.ssssssssssssssssss.',
];

const NOTICE_BOARD = [
  '..nnnnnnnnnnnn..',
  '.nkkkkkkkkkkkkn.',
  '.nkssskssskkkkn.',
  '.nksssksssksskn.',
  '.nkssskssskssknn',
  '.nkkkkkkkkkssk n',
  '.nksssskkkkkkkn.',
  '.nkssssksskkkkn.',
  '.nkssssksskkkkn.',
  '.nkkkkkkkkkkkkn.',
  '..nnnnnnnnnnnn..',
  '......nkkn......',
  '......nkkn......',
  '......nkkn......',
  '.....ssssss.....',
];

/** Gate posts the player walks between to leave camp. */
const GATE_POST = [
  '.nnnn.',
  'nkkkkn',
  'nkbkkn',
  'nkkkkn',
  'nkkbkn',
  'nkkkkn',
  'nkbkkn',
  'nkkkkn',
  'nkkkkn',
  'nkbkkn',
  'nkkkkn',
  '.nnnn.',
  '.ssss.',
];


const COOKING_POT = [
  '....m..........m....',
  '.....m........m.....',
  '......m......m......',
  '.......m....m.......',
  '........m..m........',
  '.........mm.........',
  '....GGGGGGGGGGGG....',
  '...GmmmmmmmmmmmmG...',
  '...GmwwwwwwwwwwmG...',
  '...Gmwyyyyyyyywm G..',
  '...Gmmmmmmmmmmmm G..',
  '....GGGGGGGGGGGG....',
  '.....G.G....G.G.....',
  '.....sss....sss.....',
  '...ssssssssssssss...',
];

const WEAPON_RACK = [
  '..m....m.....m......',
  '..m....m.....mm.....',
  '.mmm..mmm...mmmm....',
  '..m....m.....mm.....',
  '..m....m.....m......',
  'nnnnnnnnnnnnnnnnnnnn',
  'kkkkkkkkkkkkkkkkkkkk',
  'nkn..............nkn',
  'nkn..............nkn',
  'nkn..............nkn',
  'nnn..............nnn',
  'sss..............sss',
  '.ssssssssssssssssss.',
];

const DRYING_RACK = [
  'n..................n',
  'nkkkkkkkkkkkkkkkkkkn',
  'n.c...e...c....e...n',
  'n.c...e...c....e...n',
  'n.cc..ee..cc...ee..n',
  'n.cc..ee..cc...ee..n',
  'n..c...e...c....e..n',
  'n..................n',
  'n..................n',
  'nn................nn',
  'ss................ss',
  '.ssssssssssssssssss.',
];

const LANTERN_POST = [
  '..yyyy..',
  '.yowwoy.',
  'yowwwwoy',
  'yowwwwoy',
  '.yowwoy.',
  '..oooo..',
  '...nn...',
  '...kn...',
  '...nk...',
  '...kn...',
  '...nk...',
  '...nn...',
  '...kn...',
  '...nk...',
  '..ssss..',
];

/** A palisade section. Upright stakes, so a wall reads as a wall and not a plank. */
const LOG_WALL = [
  '.n..n..n..n..n..',
  'nknknknknknknknk',
  'nknknknknknknknk',
  'nknknknknknknknk',
  'nbnknknbnknknbnk',
  'nknknknknknknknk',
  'nknknknknknknknk',
  'nknbnknknbnknknk',
  'nknknknknknknknk',
  'nknknknknknknknk',
  'nbnknknknknbnknk',
  'nknknknknknknknk',
  'kkkkkkkkkkkkkkkk',
  'ssssssssssssssss',
  '.ssssssssssssss.',
];

const WATCHTOWER = [
  '.......nn.......',
  '......nkkn......',
  '...nnnnnnnnnn...',
  '..nkkkkkkkkkkn..',
  '..nkyyyyyyyykn..',
  '..nkkkkkkkkkkn..',
  '...nnnnnnnnnn...',
  '....n......n....',
  '....nk....kn....',
  '....n.nnnn.n....',
  '...nk......kn...',
  '...n........n...',
  '...nk.nnnn.kn...',
  '..nk........kn..',
  '..n..........n..',
  '..nk..nnnn..kn..',
  '.nk..........kn.',
  '.n............n.',
  'nk....nnnn....kn',
  'n..............n',
  'sss..........sss',
  '.ssssssssssssss.',
];

const SIGNAL_TABLE = [
  '.......i........',
  '.......i........',
  '....GGGiGGG.....',
  '...GmmmmmmmG....',
  '...GmcicicmG....',
  '...GmmmmmmmG....',
  '...GmeimmimG....',
  '...GmmmmmmmG....',
  '...GGGGGGGGG....',
  'nnnnnnnnnnnnnnnn',
  'kkkkkkkkkkkkkkkk',
  'nkn..........nkn',
  'nkn..........nkn',
  'nnn..........nnn',
  'sss..........sss',
  '.ssssssssssssss.',
];

const MEDICAL_TABLE = [
  '..w...w...w.....',
  '..P...c...P.....',
  '..w...w...w.....',
  'wwwwwwwwwwwwwwww',
  'wPwwwwwwwwwwwwPw',
  'wwwwwwwwwwwwwwww',
  'nnnnnnnnnnnnnnnn',
  'kkkkkkkkkkkkkkkk',
  'nkn..........nkn',
  'nkn..........nkn',
  'nnn..........nnn',
  'sss..........sss',
  '.ssssssssssssss.',
];

const CABIN = [
  '.........rr.........',
  '........rrrr........',
  '.......rrrrrr.......',
  '......rrrrrrrr......',
  '.....rrrrrrrrrr.....',
  '....rrrrrrrrrrrr....',
  '...rrrrrrrrrrrrrr...',
  '..rrrrrrrrrrrrrrrr..',
  '.rrrrrrrrrrrrrrrrrr.',
  'rrrrrrrrrrrrrrrrrrrr',
  'nnnnnnnnnnnnnnnnnnnn',
  'nkkkkkkkkkkkkkkkkkkn',
  'nkyyykkkkkkkkyyyykkn',
  'nkyyykkkkkkkkyyyykkn',
  'nkkkkkkkkkkkkkkkkkkn',
  'nkkkkkkDDDDkkkkkkkkn',
  'nkkkkkkDDDDkkkkkkkkn',
  'nkkkkkkDDDDkkkkkkkkn',
  'nnnnnnnDDDDnnnnnnnnn',
  'ssssssssssssssssssss',
];

const TROPHY_SKULL = [
  '...wwwwwwwww....',
  '..wwwwwwwwwww...',
  '.wwwwwwwwwwwww..',
  'wwDDwwwwwwwDDww.',
  'wwDDwwwwwwwDDww.',
  'wwwwwwwwwwwwwww.',
  'wwwwwwDDDwwwwww.',
  '.wwwwwwwwwwwww..',
  '..wwDwDwDwDww...',
  '...wwwwwwwww....',
  '....ww.w.ww.....',
];

/** Split firewood, stacked. The camp's most honest sign that someone lives here. */
const WOODPILE = [
  '..nnnn..nnnn....',
  '.nkkkkn.nkkkkn..',
  '.nkbkkn.nkkbkn..',
  'nnnnnnnnnnnnnnnn',
  'nkkkknkkkknkkkkn',
  'nkkbknkbkknkkbkn',
  'nnnnnnnnnnnnnnnn',
  '.ssssssssssssss.',
];

/** A log end cut for sitting on. */
const STOOL = [
  '.nnnnnn.',
  'nkkkkkkn',
  'nkbkkbkn',
  'nkkkkkkn',
  '.nnnnnn.',
  '.n....n.',
  '.n....n.',
  '.ssssss.',
];

/** A barrel with snow on the lid. */
const BARREL = [
  '..ssssss..',
  '.nnnnnnnn.',
  'nkkkkkkkkn',
  'nmmmmmmmmn',
  'nkkkkkkkkn',
  'nkkkkkkkkn',
  'nmmmmmmmmn',
  'nkkkkkkkkn',
  '.nnnnnnnn.',
  '.ssssssss.',
];

/** A lantern hung from a pole, lit. */
const HANGING_LANTERN = [
  '....nn....',
  '....nn....',
  '...nkkn...',
  '..oyyyyo..',
  '.oywwwwyo.',
  '.oywwwwyo.',
  '.oyyyyyyo.',
  '..oooooo..',
  '....nn....',
  '....nn....',
  '....nn....',
  '....nn....',
  '...ssss...',
];


/**
 * The way out. A swirl in four frames, cycled at the scene, so it turns without
 * needing a spritesheet.
 */
const PORTAL_FRAMES: string[][] = [
  [
    '......DDDD......',
    '....DDvvvvDD....',
    '...DDvvvvvvDD...',
    '..DDVVVVVvvvDD..',
    '..DVViiiVVvvvD..',
    '.DVViiiDiVVvVVD.',
    '.DVViiDDDiVVVVD.',
    '.VVViiDDiDiVVVV.',
    'DVVVViiDiiiVVVVD',
    'DvVVViDDwiiiVVVD',
    'DvvViDiiwiiiiiVD',
    'DvvViiwwwiiiiiVD',
    'DvvVDiwiiDDDiiVD',
    'DvvVDiiiwiiDiVvD',
    'DvviDiDDwwiDiVvD',
    'DvvVDDDDiiDDiVvD',
    '.vvViDiiiDiiVvv.',
    '.DvViiiiiiVVvvD.',
    '.DvviiiVVVVvvvD.',
    '..DvViiVVVvvvD..',
    '..DDvVVVVVvvDD..',
    '...DDVVVVVvDD...',
    '....DDvVVvDD....',
    '......DDDD......',
  ],
  [
    '......DDDD......',
    '....DDvvvvDD....',
    '...DDVVVVvvDD...',
    '..DDVVViiVvvDD..',
    '..DVVViiiiVvvD..',
    '.DvvVViiDiiVvvD.',
    '.DvvVViiDDiVvvD.',
    '.vvvVViiDiDVvvv.',
    'DvvVViDDDiDiVvvD',
    'DvvViDiiDiiiVvvD',
    'DvviDiwwiwiiVVVD',
    'DvViDiwwwwDiVVVD',
    'DvViDiiwiiDiVVVD',
    'DvViDDDwiDiiiVVD',
    'DvViDiDwwDDiiiVD',
    'DvViiiiiiiDDiVVD',
    '.vViiiiDiiDiiVv.',
    '.DViiVViDDiiVvD.',
    '.DvVVVVViiiVVvD.',
    '..DVVVVVVVVvvD..',
    '..DDVVvvvvvvDD..',
    '...DDVvvvvvDD...',
    '....DDvvvvDD....',
    '......DDDD......',
  ],
  [
    '......DDDD......',
    '....DDvVVvDD....',
    '...DDvVVVVVDD...',
    '..DDvvVVVVVvDD..',
    '..DvvvVVViiVvD..',
    '.DvvvVVVViiivvD.',
    '.DvvVViiiiiiVvD.',
    '.vvViiDiiiDiVvv.',
    'DvViDDiiDDDDVvvD',
    'DvViDiwwDDiDivvD',
    'DvViDiiwiiiDVvvD',
    'DViiDDDiiwiDVvvD',
    'DViiiiiwwwiiVvvD',
    'DViiiiiwiiDiVvvD',
    'DVVViiiwDDiVVVvD',
    'DVVVViiiDiiVVVVD',
    '.VVVViDiDDiiVVV.',
    '.DVVVViDDDiiVVD.',
    '.DVVvVViDiiiVVD.',
    '..DvvvVViiiVVD..',
    '..DDvvvVVVVVDD..',
    '...DDvvvvvvDD...',
    '....DDvvvvDD....',
    '......DDDD......',
  ],
  [
    '......DDDD......',
    '....DDvvvvDD....',
    '...DDvvvvvVDD...',
    '..DDvvvvvvVVDD..',
    '..DvvVVVVVVVVD..',
    '.DvVViiiVVVVVvD.',
    '.DvViiDDiVViiVD.',
    '.vViiDiiDiiiiVv.',
    'DVViDDiiiiiiiVvD',
    'DViiiDDwwDiDiVvD',
    'DVViiiDiwDDDiVvD',
    'DVVViDiiwiiDiVvD',
    'DVVViDwwwwiDiVvD',
    'DVVViiwiwwiDivvD',
    'DvvViiiDiiDiVvvD',
    'DvvViDiDDDiVVvvD',
    '.vvvVDiDiiVVvvv.',
    '.DvvViDDiiVVvvD.',
    '.DvvViiDiiVVvvD.',
    '..DvvViiiiVVVD..',
    '..DDvvViiVVVDD..',
    '...DDvvVVVVDD...',
    '....DDvvvvDD....',
    '......DDDD......',
  ],
];

export const PORTAL_FRAME_KEYS = ['camp-portal-0', 'camp-portal-1', 'camp-portal-2', 'camp-portal-3'] as const;

export const CAMP_KEYS = {
  tentBroken: 'camp-tent-broken',
  tentPatched: 'camp-tent-patched',
  crateStack: 'camp-crate-stack',
  log: 'camp-log',
  workbench: 'camp-workbench',
  noticeBoard: 'camp-notice-board',
  gatePost: 'camp-gate-post',
  cookingPot: 'camp-cooking-pot',
  weaponRack: 'camp-weapon-rack',
  dryingRack: 'camp-drying-rack',
  lanternPost: 'camp-lantern-post',
  logWall: 'camp-log-wall',
  watchtower: 'camp-watchtower',
  signalTable: 'camp-signal-table',
  medicalTable: 'camp-medical-table',
  cabin: 'camp-cabin',
  trophy: 'camp-trophy',
  woodpile: 'camp-woodpile',
  stool: 'camp-stool',
  barrel: 'camp-barrel',
  hangingLantern: 'camp-hanging-lantern',
} as const;

export function buildCampArt(scene: Phaser.Scene): void {
  for (const variant of fireVariants()) PixelFactory.build(scene, variant);
  const make = (key: string, rows: string[]) => PixelFactory.makeTexture(scene, key, rows, P);
  make(CAMP_KEYS.tentBroken, TENT_BROKEN);
  make(CAMP_KEYS.tentPatched, TENT_PATCHED);
  make(CAMP_KEYS.crateStack, CRATE_STACK);
  make(CAMP_KEYS.log, LOG);
  make(CAMP_KEYS.workbench, WORKBENCH);
  make(CAMP_KEYS.noticeBoard, NOTICE_BOARD);
  make(CAMP_KEYS.gatePost, GATE_POST);
  PORTAL_FRAMES.forEach((rows, i) => make(PORTAL_FRAME_KEYS[i], rows));
  make(CAMP_KEYS.cookingPot, COOKING_POT);
  make(CAMP_KEYS.weaponRack, WEAPON_RACK);
  make(CAMP_KEYS.dryingRack, DRYING_RACK);
  make(CAMP_KEYS.lanternPost, LANTERN_POST);
  make(CAMP_KEYS.logWall, LOG_WALL);
  make(CAMP_KEYS.watchtower, WATCHTOWER);
  make(CAMP_KEYS.signalTable, SIGNAL_TABLE);
  make(CAMP_KEYS.medicalTable, MEDICAL_TABLE);
  make(CAMP_KEYS.cabin, CABIN);
  make(CAMP_KEYS.trophy, TROPHY_SKULL);
  make(CAMP_KEYS.woodpile, WOODPILE);
  make(CAMP_KEYS.stool, STOOL);
  make(CAMP_KEYS.barrel, BARREL);
  make(CAMP_KEYS.hangingLantern, HANGING_LANTERN);
}
