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
  G: 'greyDark',
  m: 'steel',
  t: 'teal',
  d: 'rust',
  D: 'navy',
  i: 'cyan',
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

export const CAMP_KEYS = {
  tentBroken: 'camp-tent-broken',
  tentPatched: 'camp-tent-patched',
  crateStack: 'camp-crate-stack',
  log: 'camp-log',
  workbench: 'camp-workbench',
  noticeBoard: 'camp-notice-board',
  gatePost: 'camp-gate-post',
} as const;

export function buildCampArt(scene: Phaser.Scene): void {
  PixelFactory.build(scene, campfireSprite);
  const make = (key: string, rows: string[]) => PixelFactory.makeTexture(scene, key, rows, P);
  make(CAMP_KEYS.tentBroken, TENT_BROKEN);
  make(CAMP_KEYS.tentPatched, TENT_PATCHED);
  make(CAMP_KEYS.crateStack, CRATE_STACK);
  make(CAMP_KEYS.log, LOG);
  make(CAMP_KEYS.workbench, WORKBENCH);
  make(CAMP_KEYS.noticeBoard, NOTICE_BOARD);
  make(CAMP_KEYS.gatePost, GATE_POST);
}
