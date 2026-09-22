import Phaser from 'phaser';
import { PixelFactory } from '../PixelFactory';
import { PAL } from '../palette';

/** Swing effects and projectiles. Tinted per weapon at spawn time. */
export const WFX = {
  arcWide: 'wfx-arc-wide',
  arcNarrow: 'wfx-arc-narrow',
  thrust: 'wfx-thrust',
  shock: 'wfx-shock',
  arrow: 'wfx-arrow',
  spit: 'wfx-spit',
  icicle: 'wfx-icicle',
} as const;

/** A crescent: bright leading edge, fading tail. Drawn once, rotated per swing. */
function buildArc(
  scene: Phaser.Scene,
  key: string,
  size: number,
  halfAngleDeg: number,
  thickness: number,
): void {
  PixelFactory.makeCanvas(scene, key, size, size, (ctx) => {
    const r = size / 2;
    const half = (halfAngleDeg * Math.PI) / 180;
    // Several nested strokes make the leading edge read brighter than the tail.
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      ctx.strokeStyle = `rgba(255,255,255,${0.9 - t * 0.55})`;
      ctx.lineWidth = Math.max(1, thickness - i);
      ctx.beginPath();
      ctx.arc(r, r, r - 2 - i * 1.2, -half, half);
      ctx.stroke();
    }
    // A solid tip, so the front of the swing has weight.
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(r + Math.cos(-half) * (r - 3), r + Math.sin(-half) * (r - 3), thickness * 0.7, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function buildWeaponFx(scene: Phaser.Scene): void {
  buildArc(scene, WFX.arcWide, 64, 55, 6);
  buildArc(scene, WFX.arcNarrow, 44, 35, 4);

  // Thrust: a tapered spike pointing right.
  PixelFactory.makeTexture(
    scene,
    WFX.thrust,
    [
      '.............www',
      '.........wwwwwww',
      '.wwwwwwwwwwwwwww',
      'WWWWWWWWWWWWWWWW',
      '.wwwwwwwwwwwwwww',
      '.........wwwwwww',
      '.............www',
    ],
    { '.': null, w: 'white', W: 'cream' },
  );

  // Hammer shock ring.
  PixelFactory.makeCanvas(scene, WFX.shock, 80, 80, (ctx) => {
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.85 - i * 0.25})`;
      ctx.lineWidth = 4 - i;
      ctx.beginPath();
      ctx.ellipse(40, 40, 36 - i * 3, 22 - i * 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  PixelFactory.makeTexture(
    scene,
    WFX.arrow,
    ['....wwww', '.wwwWWWW', 'wwwwwwww', '.wwwWWWW', '....wwww'],
    { '.': null, w: 'cyan', W: 'white' },
  );

  PixelFactory.makeTexture(
    scene,
    WFX.spit,
    ['.gg.', 'gGGg', 'gGGg', '.gg.'],
    { '.': null, g: 'greenDark', G: 'green' },
  );

  PixelFactory.makeTexture(
    scene,
    WFX.icicle,
    ['.cc.', 'cCCc', 'cCCc', 'cCCc', '.cc.', '.cc.', '..c.'],
    { '.': null, c: 'ice', C: 'white' },
  );
}

// --- weapon icons, used by the HUD and the inventory ---------------------

const ICONS: Record<string, string[]> = {
  axe: [
    '....oooo..',
    '...oSSSSo.',
    '..oSSWWSSo',
    '..oSSWWSSo',
    '..oSSSSSo.',
    '...oShSo..',
    '....ohSo..',
    '....oho...',
    '....oho...',
    '.....o....',
  ],
  knife: [
    '.......oo.',
    '......oSSo',
    '.....oSSSo',
    '....oSSSo.',
    '...oSSSo..',
    '..oSSSo...',
    '.ohhSo....',
    'ohho......',
    'oho.......',
    'o.........',
  ],
  spear: [
    '........o.',
    '.......oSo',
    '......oSSo',
    '.....oSSo.',
    '....ohho..',
    '...ohho...',
    '..ohho....',
    '.ohho.....',
    'ohho......',
    'oo........',
  ],
  bow: [
    '...ooo....',
    '..oCCCo...',
    '.oCCo.o...',
    '.oCo..o...',
    'oCo...o...',
    'oCo...o...',
    '.oCo..o...',
    '.oCCo.o...',
    '..oCCCo...',
    '...ooo....',
  ],
  antler: [
    'C....o...C',
    'oC..oWo..C',
    '.oC.oWo.Co',
    '..oCoWoCo.',
    '...oWWWo..',
    '....oWo...',
    '....oWo...',
    '....oWo...',
    '....oWo...',
    '.....o....',
  ],
  hammer: [
    '..oooooo..',
    '.oSSSSSSo.',
    'oSSWWWWSSo',
    'oSSWWWWSSo',
    '.oSSSSSSo.',
    '...ohho...',
    '...ohho...',
    '...ohho...',
    '...ohho...',
    '....oo....',
  ],
};

export const WEAPON_ICON_KEY: Record<string, string> = {
  axe: 'icon-axe',
  knife: 'icon-knife',
  spear: 'icon-spear',
  bow: 'icon-bow',
  hammer: 'icon-hammer',
  antler: 'icon-antler',
};

export function buildWeaponIcons(scene: Phaser.Scene): void {
  const palette: Record<string, string | null> = {
    '.': null,
    o: '#0a1030',
    S: 'steel',
    W: 'white',
    h: 'wood',
    C: 'cyan',
  };
  for (const [id, rows] of Object.entries(ICONS)) {
    PixelFactory.makeTexture(scene, WEAPON_ICON_KEY[id], rows, palette);
  }
  void PAL;
}
