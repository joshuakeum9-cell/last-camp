import type { PixelSprite } from '../PixelFactory';
import { withLegs, bob } from '../PixelFactory';

/**
 * The survivor: 16x22, a warm rust parka with cream fur trim so they read instantly
 * against the blue wilderness. Three directions; the left side is the right side flipped.
 */
const PALETTE: Record<string, string | null> = {
  '.': null,
  o: 'navy',
  c: 'ember',
  d: 'rust',
  f: 'cream',
  h: 'orange',
  s: 'skin',
  e: 'navy',
  b: 'woodDark',
};

/** Rows 0..17. The last four rows are supplied by a leg pose. */
const TORSO = [
  '....ffffffff....',
  '...occcccccco...',
  '..occcccccccco..',
  '..ocdccccccdco..',
  '..ocdccccccdco..',
  '..occcccccccco..',
  '..occcccccccco..',
  '...occcccccco...',
  '...oddddddddo...',
];

const HEAD_DOWN = [
  '................',
  '....oooooooo....',
  '...offffffffo...',
  '..offhhhhhhffo..',
  '..offssssssffo..',
  '..ofssessessfo..',
  '..ofssssssssfo..',
  '..offssssssffo..',
  '...offffffffo...',
];

const HEAD_UP = [
  '................',
  '....oooooooo....',
  '...offffffffo...',
  '..offhhhhhhffo..',
  '..ofhhhhhhhhfo..',
  '..ofhhhhhhhhfo..',
  '..ofhhhhhhhhfo..',
  '..offhhhhhhffo..',
  '...offffffffo...',
];

const HEAD_SIDE = [
  '................',
  '....oooooooo....',
  '...offffffffo...',
  '..offhhhhhhffo..',
  '..offsssssssfo..',
  '..offsssessffo..',
  '..offsssssssfo..',
  '..offssssssffo..',
  '...offffffffo...',
];

// --- leg poses -----------------------------------------------------------
const LEGS_STAND = ['....obb..bbo....', '....obb..bbo....', '....obb..bbo....', '.....oo..oo.....'];
const LEGS_PASS = ['.....obbbbo.....', '.....obbbbo.....', '.....obbbbo.....', '.....oo.oo......'];
const LEGS_LEFT = ['...obb...bbo....', '...obb...bbo....', '..obb.....bbo...', '..oo.......oo...'];
const LEGS_RIGHT = ['....obb...bbo...', '....obb...bbo...', '...obb.....bbo..', '...oo.......oo..'];

function body(head: string[]): string[] {
  return [...head, ...TORSO];
}

function frames(head: string[]) {
  const base = body(head);
  const stand = withLegs(base, LEGS_STAND);
  return {
    idle: [stand, bob(stand, 1)],
    walk: [
      withLegs(base, LEGS_LEFT),
      withLegs(base, LEGS_PASS),
      withLegs(base, LEGS_RIGHT),
      withLegs(base, LEGS_PASS),
    ],
    /** A short forward lean used under the weapon swing. */
    attack: [bob(stand, 1), stand],
  };
}

export const playerDown: PixelSprite = {
  key: 'player-down',
  fps: 8,
  palette: PALETTE,
  anims: frames(HEAD_DOWN),
  fpsOverride: { idle: 2, attack: 14 },
};

export const playerUp: PixelSprite = {
  key: 'player-up',
  fps: 8,
  palette: PALETTE,
  anims: frames(HEAD_UP),
  fpsOverride: { idle: 2, attack: 14 },
};

export const playerSide: PixelSprite = {
  key: 'player-side',
  fps: 8,
  palette: PALETTE,
  anims: frames(HEAD_SIDE),
  fpsOverride: { idle: 2, attack: 14 },
};

export const PLAYER_SPRITES = [playerDown, playerUp, playerSide];

export type Facing = 'down' | 'up' | 'side';

export function playerKeyFor(facing: Facing): string {
  return facing === 'down' ? 'player-down' : facing === 'up' ? 'player-up' : 'player-side';
}
