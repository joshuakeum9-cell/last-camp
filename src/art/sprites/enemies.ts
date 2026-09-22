import Phaser from 'phaser';
import type { PixelSprite } from '../PixelFactory';
import { PixelFactory, bob, withLegs } from '../PixelFactory';

/**
 * Enemy sprites. Each one gets a single strong accent colour on the body, which is also
 * the colour of its hit particles, so a fight reads at a glance.
 */
const P: Record<string, string | null> = {
  '.': null,
  o: '#0a1030',
  f: 'grey',
  F: 'steel',
  p: 'magenta',
  P: 'blood',
  t: '#161c3a',
  r: '#2b3358',
  R: '#4d5a8c',
  L: '#5b6fa8',
  N: '#3a4570',
  w: 'white',
  W: 'snow',
  c: 'cyan',
  C: 'ice',
  v: 'violet',
  V: 'violetDark',
  g: 'green',
  G: 'teal',
  b: 'bark',
  B: 'woodDark',
  e: 'ember',
  y: 'gold',
};

// --- Frost Rat: small, fast, always in a group ---------------------------

const RAT_BODY = [
  '................',
  '..........oo.oo.',
  '.........orroRRo',
  '......oooRRRRRRo',
  '....ooRRRRRpRRRo',
  '..ooRRRRRRRRRRPo',
  'toRRRRRRRRRRRRo.',
  'toRRrrrrrrrRRo..',
  '.torrrrrrrrro...',
  '..orrrrrrrro....',
];

const RAT_LEGS_A = ['..o.oo.oo.oo....', '....o...o..o....'];
const RAT_LEGS_B = ['..oo.o.o.oo.o...', '...o.....o...o..'];
const RAT_LEGS_C = ['..o..oo.oo..o...', '.....o...o..o...'];

const ratStand = withLegs([...RAT_BODY, '', ''], RAT_LEGS_A);

export const ratSprite: PixelSprite = {
  key: 'enemy-rat',
  fps: 12,
  palette: P,
  anims: {
    idle: [ratStand, bob(ratStand, 1)],
    run: [
      withLegs([...RAT_BODY, '', ''], RAT_LEGS_A),
      withLegs([...RAT_BODY, '', ''], RAT_LEGS_B),
      withLegs([...RAT_BODY, '', ''], RAT_LEGS_C),
      withLegs([...RAT_BODY, '', ''], RAT_LEGS_B),
    ],
    windup: [bob(ratStand, 1), ratStand],
    attack: [
      [
        '................',
        '...........oo.oo',
        '..........orroRR',
        '.......oooRRRRRR',
        '.....ooRRRRRpRRR',
        '...ooRRRRRRRRRRP',
        '.toRRRRRRRRRRRRo',
        'toRRrrrrrrrRRo..',
        '.torrrrrrro.....',
        '..o.oo.oo.o.....',
        '....o...o.......',
        '................',
      ],
    ],
  },
  fpsOverride: { idle: 3, run: 14, windup: 6 },
};

// --- Ice Wolf: circles, then commits ------------------------------------
//
// It used to be white fur on white snow, which is why it read as an unfinished
// blob. The body is now slate with a pale underbelly and a cyan eye, so the
// silhouette carries at a distance and the accent colour marks the species.

const WOLF_BODY = [
  '........................',
  '..................o..o..',
  '.................oLooLo.',
  '................oLLLLLo.',
  'oo..............oLLLLLLo',
  'oLo............oLLLcLLLo',
  '.oLo...........oLLLLLLLo',
  '..oLo.........oLLLLLLNNo',
  '..oLLo.......oLLLLLNNNNo',
  '...oLLooooooLLLLLLLNNNo.',
  '..oLLLLLLLLLLLLLLLLLoo..',
  '.oLLLLLLLLLLLLLLLLLLo...',
  'oLLLLLLLLLLLLLLLLLLLo...',
  'oWWWWWLLLLLLLLLWWWWWo...',
  '.oWWWWWWWWWWWWWWWWWo....',
  '..oWWWWWWWWWWWWWWWo.....',
];

const WOLF_LEGS_A = ['..oLLo..oLLo....oLLo....', '..oWWo..oWWo....oWWo....', '..o..o..o..o....o..o....'];
const WOLF_LEGS_B = ['...oLLo..oLLo..oLLo.....', '...oWWo..oWWo..oWWo.....', '...o..o..o..o..o..o.....'];
const WOLF_LEGS_C = ['.oLLo....oLLo.....oLLo..', '.oWWo....oWWo.....oWWo..', '.o..o....o..o.....o..o..'];

const wolfStand = withLegs([...WOLF_BODY, '', '', ''], WOLF_LEGS_A);

export const wolfSprite: PixelSprite = {
  key: 'enemy-wolf',
  fps: 10,
  palette: P,
  anims: {
    idle: [wolfStand, bob(wolfStand, 1)],
    run: [
      withLegs([...WOLF_BODY, '', '', ''], WOLF_LEGS_A),
      withLegs([...WOLF_BODY, '', '', ''], WOLF_LEGS_B),
      withLegs([...WOLF_BODY, '', '', ''], WOLF_LEGS_C),
      withLegs([...WOLF_BODY, '', '', ''], WOLF_LEGS_B),
    ],
    // Crouches before the charge: the tell is the silhouette dropping, not a colour.
    windup: [
      [
        '........................',
        '........................',
        '........................',
        '.................oo.....',
        '................oLLo.oo.',
        'o...............oLLLooLo',
        'oo.............oLLLLLLLo',
        '.oo...........oLLLLcLLLo',
        '..oLoooooooooLLLLLLLLLNo',
        '.oLLLLLLLLLLLLLLLLLLLLNo',
        'oLLLLLLLLLLLLLLLLLLLLLoo',
        'oWWWWLLLLLLLLLLLLLLWWo..',
        '.oWWWWWWWWWWWWWWWWWWo...',
        '..oWWWWWWWWWWWWWWWWo....',
        '..oLLo..oLLo....oLLo....',
        '..o..o..o..o....o..o....',
      ],
    ],
    attack: [wolfStand],
  },
  fpsOverride: { idle: 3, run: 13, windup: 4 },
};

// --- Frozen Walker: tall, slow, unstoppable ------------------------------

const WALKER = [
  '..................',
  '......oooooo......',
  '.....oVVVVVVo.....',
  '....oVVvvvvVVo....',
  '....oVvVVVVvVo....',
  '....oVvVooVvVo....',
  '....oVVVooVVVo....',
  '.....oVVVVVVo.....',
  '......oVVVVo......',
  '...ooVVVVVVVVoo...',
  '..oVVVVvvvvVVVVo..',
  '.oVVVvVVVVVVvVVVo.',
  'oVVVvVVVVVVVVvVVVo',
  'oVVvVVVVVVVVVVvVVo',
  'oVVVVVVvvVVVVVVVVo',
  '.oVVVVVvvVVVVVVVo.',
  '..oVVVVVVVVVVVVo..',
  '...oVVVVVVVVVVo...',
  '....oVVVoVVVo.....',
  '....oVVVoVVVo.....',
  '....oVVVoVVVo.....',
  '....oVVVoVVVo.....',
  '...ooVVoooVVoo....',
  '...oVVVo.oVVVo....',
  '...ooooo.ooooo....',
];

export const walkerSprite: PixelSprite = {
  key: 'enemy-walker',
  fps: 4,
  palette: P,
  anims: {
    idle: [WALKER, bob(WALKER, 1)],
    run: [WALKER, bob(WALKER, 1), WALKER, bob(WALKER, 2)],
    windup: [bob(WALKER, 2), bob(WALKER, 1)],
    attack: [WALKER],
  },
  fpsOverride: { idle: 2, run: 5, windup: 5 },
};

// --- Snow Spitter: keeps its distance ------------------------------------

const SPITTER = [
  '................',
  '.....oooooo.....',
  '...ooGGGGGGoo...',
  '..oGGGGGGGGGGo..',
  '.oGGGgggggGGGGo.',
  '.oGGgGGGGGGgGGo.',
  'oGGgGGoGGoGGgGGo',
  'oGGGGGoGGoGGGGGo',
  'oGGGGGGGGGGGGGGo',
  'oGGGgGGGGGGgGGGo',
  '.oGGGggggggGGGo.',
  '.oGGGGGGGGGGGGo.',
  '..oGGGGGGGGGGo..',
  '...ooGGGGGGoo...',
  '..o.oooooooo.o..',
  '..o..........o..',
];

export const spitterSprite: PixelSprite = {
  key: 'enemy-spitter',
  fps: 6,
  palette: P,
  anims: {
    idle: [SPITTER, bob(SPITTER, 1)],
    run: [SPITTER, bob(SPITTER, 1), SPITTER, bob(SPITTER, 2)],
    windup: [bob(SPITTER, 2), SPITTER],
    attack: [SPITTER],
  },
  fpsOverride: { idle: 3, run: 8, windup: 8 },
};

// --- Ice Skater: wide, low, and always sliding ---------------------------

const SKATER = [
  '........................',
  '..........oooo..........',
  '.........oRRRRo.........',
  '........oRRcRRRo........',
  '.......oRRRRRRRRo.......',
  '......oRRRRRRRRRRo......',
  '.......oRRRRRRRRo.......',
  '........oRRRRRRo........',
  '.........oooooo.........',
  '....oo...o....o...oo....',
  '...o..ooo......ooo..o...',
  '..o..................o..',
  '.o....................o.',
  '........................',
];

const SKATER_LEGS = [
  ...SKATER.slice(0, 9),
  '.....o...o....o...o.....',
  '....o.ooo......ooo.o....',
  '...o..................o.',
  '..o....................o',
  '........................',
];

export const skaterSprite: PixelSprite = {
  key: 'enemy-skater',
  fps: 10,
  palette: P,
  anims: {
    idle: [SKATER, bob(SKATER, 1)],
    run: [SKATER, SKATER_LEGS],
    windup: [bob(SKATER, 1), SKATER],
    attack: [SKATER_LEGS],
  },
  fpsOverride: { idle: 3, run: 12, windup: 6 },
};

// --- Ridge Crow: black on white, wings open, always above its shadow -----

const CROW_UP = [
  '....oo........oo....',
  '...oooo......oooo...',
  '..oootto....ottooo..',
  '.oot..ooo..ooo..too.',
  '.o.....ooooooo.....o',
  '........ooPoo.......',
  '.........oooo.......',
  '..........oo........',
  '..........oo........',
  '.........o..o.......',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
];

const CROW_DOWN = [
  '....................',
  '....................',
  '.........oooo.......',
  '........ooPooo......',
  '.oooooooooooooooooo.',
  'oott..ooooooooo..tto',
  '.o.....ooooooo.....o',
  '.........oooo.......',
  '..........oo........',
  '.........o..o.......',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
];

export const crowSprite: PixelSprite = {
  key: 'enemy-crow',
  fps: 8,
  palette: P,
  anims: {
    idle: [CROW_UP, CROW_DOWN],
    run: [CROW_UP, CROW_DOWN],
    windup: [CROW_DOWN, CROW_DOWN],
    attack: [CROW_UP],
  },
  fpsOverride: { idle: 5, run: 9, windup: 4 },
};

// --- Drift Brute: a hulk under a foot of snow ----------------------------

const BRUTE = [
  '........oooooooo........',
  '......ooWWWWWWWWoo......',
  '.....oWWWWWWWWWWWWo.....',
  '....oWWWWWWWWWWWWWWo....',
  '...oWWWWoooWWWWoooWWo...',
  '...oWWWocccoWWoccoWWo...',
  '...oWWWWoooWWWWoooWWo...',
  '..oWWWWWWWWWWWWWWWWWWo..',
  '..oWWRRWWWWWWWWWWRRWWo..',
  '.oWWRRRRWWWWWWWWRRRRWWo.',
  '.oWRRRRRWWWWWWWWRRRRRWo.',
  'oWRRRRRRWWWWWWWWRRRRRRWo',
  'oRRRRRRoWWWWWWWWoRRRRRRo',
  'oRRRRRoWWWWWWWWWWoRRRRRo',
  'oRRRRoWWWWWWWWWWWWoRRRRo',
  'oRRRoWWWWWWWWWWWWWWoRRRo',
  '.oooWWWWWWWWWWWWWWWWooo.',
  '...oWWWWWWWWWWWWWWWWo...',
  '...oWWWWWWWoWWWWWWWWo...',
  '...oWWWWWWWooWWWWWWWo...',
  '...oRRRRRRRooRRRRRRRo...',
  '...oRRRRRRRooRRRRRRRo...',
  '...oRRRRRRo..oRRRRRRo...',
  '...oRRRRRo....oRRRRRo...',
  '...oooooo......oooooo...',
];

const BRUTE_RAISED = [
  'oooo................oooo',
  'oRRRo..............oRRRo',
  'oRRRRo....oooooo..oRRRRo',
  'oRRRRRo.ooWWWWWWoooRRRRo',
  '.oRRRRoWWWWWWWWWWWoRRRRo',
  '.oRRRoWWWWWWWWWWWWWoRRRo',
  '..oRRoWWWoooWWWoooWWoRo.',
  '..oRRoWWocccoWoccoWWoRo.',
  '...ooWWWWoooWWWWoooWWoo.',
  '...oWWWWWWWWWWWWWWWWWWo.',
  '..oWWWWWWWWWWWWWWWWWWWo.',
  '..oWWWWWWWWWWWWWWWWWWWo.',
  '..oWWWWWWWWWWWWWWWWWWWo.',
  '..oWWWWWWWWWWWWWWWWWWWo.',
  '..oWWWWWWWWWWWWWWWWWWWo.',
  '...oWWWWWWWWWWWWWWWWWo..',
  '...oWWWWWWWWWWWWWWWWo...',
  '...oWWWWWWWWWWWWWWWWo...',
  '...oWWWWWWWoWWWWWWWWo...',
  '...oWWWWWWWooWWWWWWWo...',
  '...oRRRRRRRooRRRRRRRo...',
  '...oRRRRRRRooRRRRRRRo...',
  '...oRRRRRRo..oRRRRRRo...',
  '...oRRRRRo....oRRRRRo...',
  '...oooooo......oooooo...',
];

export const bruteSprite: PixelSprite = {
  key: 'enemy-brute',
  fps: 6,
  palette: P,
  anims: {
    idle: [BRUTE, bob(BRUTE, 1)],
    run: [BRUTE, bob(BRUTE, 1), BRUTE, bob(BRUTE, 2)],
    windup: [BRUTE_RAISED],
    attack: [BRUTE],
  },
  fpsOverride: { idle: 2, run: 5, windup: 1 },
};

export const ENEMY_SPRITES = [ratSprite, wolfSprite, walkerSprite, spitterSprite, skaterSprite, crowSprite, bruteSprite];

export const ENEMY_SPRITE_KEY: Record<string, string> = {
  rat: ratSprite.key,
  wolf: wolfSprite.key,
  walker: walkerSprite.key,
  spitter: spitterSprite.key,
  stalker: wolfSprite.key,
  alpha: wolfSprite.key,
  skater: skaterSprite.key,
  crow: crowSprite.key,
  brute: bruteSprite.key,
};

export function buildEnemyArt(scene: Phaser.Scene): void {
  for (const sprite of ENEMY_SPRITES) PixelFactory.build(scene, sprite);
}
