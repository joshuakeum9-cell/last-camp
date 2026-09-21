/**
 * The whole game draws from these named colours. Art files reference them by name so the
 * palette can be retuned in one place. Cold set for the wilderness, warm set for the camp.
 */
export const PAL = {
  // --- cold / wilderness -------------------------------------------------
  black: '#060a18',
  navy: '#0d1442',
  deep: '#1d2a9c',
  blueDark: '#2742e0',
  blue: '#3a63ff',
  ice: '#2fd8ff',
  cyan: '#7bf3ff',
  white: '#ffffff',
  snow: '#e4f4ff',
  snowShade: '#7cb9f7',
  violet: '#8b3cff',
  violetDark: '#5716cc',
  magenta: '#e83ae0',
  teal: '#0fdcc0',

  // --- warm / camp -------------------------------------------------------
  ember: '#ff3b0d',
  orange: '#ff8a00',
  gold: '#ffcf1f',
  cream: '#fff3ce',
  rust: '#d93b0a',
  wood: '#b0601f',
  woodDark: '#6e3510',
  bark: '#46230a',

  // --- organic -----------------------------------------------------------
  skin: '#ffc08f',
  skinShade: '#d98a5a',
  blood: '#ff2b55',
  green: '#3ff07f',
  greenDark: '#12a855',
  grey: '#a8b8dc',
  greyDark: '#46538a',

  // --- interface text ------------------------------------------------------
  /** Secondary interface text. Readable on navy, unlike the art greys. */
  uiDim: '#93a4cf',
  /** Hints and captions. The quietest thing that is still legible. */
  uiMuted: '#7b8cba',
  steel: '#cfe0ff',

  // --- rarity ------------------------------------------------------------
  rarityCommon: '#ffffff',
  rarityUncommon: '#3ff07f',
  rarityRare: '#2fb8ff',
  rarityEpic: '#c56bff',
} as const;

export type PaletteName = keyof typeof PAL;

/** Rarity tiers, used by loot, caches and weapon glows. */
export const RARITY_COLOR = {
  common: PAL.rarityCommon,
  uncommon: PAL.rarityUncommon,
  rare: PAL.rarityRare,
  epic: PAL.rarityEpic,
} as const;

export type Rarity = keyof typeof RARITY_COLOR;

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic'];

/** '#rrggbb' -> 0xrrggbb, for Phaser tints and geometry fills. */
export function hex(color: string): number {
  return parseInt(color.replace('#', ''), 16);
}

/** Blend two '#rrggbb' colours. t = 0 returns a, t = 1 returns b. */
export function mix(a: string, b: string, t: number): string {
  const ca = hex(a);
  const cb = hex(b);
  const r = Math.round((((ca >> 16) & 255) * (1 - t) + ((cb >> 16) & 255) * t));
  const g = Math.round((((ca >> 8) & 255) * (1 - t) + ((cb >> 8) & 255) * t));
  const bl = Math.round(((ca & 255) * (1 - t) + (cb & 255) * t));
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

/** Resolve a palette name or a raw '#rrggbb' string to '#rrggbb'. */
export function color(nameOrHex: string): string {
  return (PAL as Record<string, string>)[nameOrHex] ?? nameOrHex;
}
