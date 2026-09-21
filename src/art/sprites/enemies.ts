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

const WOLF_BODY = [
  '........................',
  '.................oo..oo.',
  '..............oooWWooWWo',
  '.........ooooooWWWWWWWWo',
  '....ooooWWWWWWWWWWWWWcWo',
  '.oooWWWWWWWWWWWWWWWWWWWo',
  'toWWWWWWWWffffWWWWWWWWo.',
  'toWWWWffffffffffffWWWo..',
  '.toWfffffffffffffffo....',
  '..offffffffffffffo......',
];

const WOLF_LEGS_A = ['..oo..oo......oo..oo....', '..o....o.......o....o...'];
const WOLF_LEGS_B = ['...oo.oo.......oo.oo....', '...o...o........o...o...'];
const WOLF_LEGS_C = ['.oo....oo....oo....oo...', '.o......o....o......o...'];

const wolfStand = withLegs([...WOLF_BODY, '', ''], WOLF_LEGS_A);

export const wolfSprite: PixelSprite = {
  key: 'enemy-wolf',
  fps: 10,
  palette: P,
  anims: {
    idle: [wolfStand, bob(wolfStand, 1)],
    run: [
      withLegs([...WOLF_BODY, '', ''], WOLF_LEGS_A),
      withLegs([...WOLF_BODY, '', ''], WOLF_LEGS_B),
      withLegs([...WOLF_BODY, '', ''], WOLF_LEGS_C),
      withLegs([...WOLF_BODY, '', ''], WOLF_LEGS_B),
    ],
    // Crouches low before the charge: the tell is the silhouette, not just a colour.
    windup: [
      [
        '........................',
        '........................',
        '........................',
        '.................oo..oo.',
        '..............oooWWooWWo',
        '.........ooooooWWWWWWcWo',
        '....ooooWWWWWWWWWWWWWWWo',
        '.oooWWWWWWWWffffWWWWWWo.',
        'toWWWWffffffffffffWWWo..',
        'toWfffffffffffffffo.....',
        '.offffffffffffffo.......',
        '..oo.oo......oo.oo......',
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

export const ENEMY_SPRITES = [ratSprite, wolfSprite, walkerSprite, spitterSprite];

export const ENEMY_SPRITE_KEY: Record<string, string> = {
  rat: ratSprite.key,
  wolf: wolfSprite.key,
  walker: walkerSprite.key,
  spitter: spitterSprite.key,
  stalker: wolfSprite.key,
  alpha: wolfSprite.key,
};

export function buildEnemyArt(scene: Phaser.Scene): void {
  for (const sprite of ENEMY_SPRITES) PixelFactory.build(scene, sprite);
}
