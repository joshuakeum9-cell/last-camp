import Phaser from 'phaser';
import { PixelFactory } from '../PixelFactory';
import type { ResourceId } from '../../data/resources';

/**
 * Resource icons.
 *
 * These were coloured squares, which told the player there were five of something
 * without telling them which five. Every icon now has a silhouette you can name at a
 * glance, so the colour is reinforcement rather than the only signal.
 */
const P: Record<string, string | null> = {
  '.': null,
  o: '#0a1030',
  n: 'wood',
  k: 'woodDark',
  b: 'bark',
  m: 'steel',
  M: 'grey',
  d: 'greyDark',
  g: 'green',
  G: 'greenDark',
  r: 'blood',
  w: 'white',
  W: 'cream',
  c: 'cyan',
  C: 'ice',
  e: 'ember',
};

/** A cut log, seen end on, with rings. */
const WOOD = [
  '..oooooo..',
  '.onnnnnno.',
  'onkkkknkno',
  'onknnnkkno',
  'onknkknkno',
  'onknkknkno',
  'onknnnkkno',
  'onkkkknkno',
  '.onnnnnno.',
  '..oooooo..',
];

/** A bent metal plate with two bolt holes. */
const SCRAP = [
  '..oooooo..',
  '.oMMMMMMo.',
  'oMmmmmmMMo',
  'oMmoMMomMo',
  'oMmmmmmmMo',
  '.oMmmmmMo.',
  '..oMmmMo..',
  '..oMmoMo..',
  '...oMMo...',
  '....oo....',
];

/** A haunch of dried meat on the bone. */
const FOOD = [
  '...oooo...',
  '..orrrro..',
  '.orrWWrro.',
  'orrWWWWrro',
  'orrWWWWrro',
  'orrrWWrrro',
  '.orrrrrro.',
  '..owwwwo..',
  '..ow..wo..',
  '...oooo...',
];

/** A frost crystal shard. */
const CRYSTAL = [
  '....cc....',
  '...cCCc...',
  '..cCCCCc..',
  '.cCCwwCCc.',
  'cCCwwwwCCc',
  'cCCCwwCCCc',
  '.cCCCCCCc.',
  '..cCCCCc..',
  '...cCCc...',
  '....cc....',
];

/** A medical tin with a cross on it. */
const MEDICAL = [
  '..oooooo..',
  '.owwwwwwo.',
  'owwwrrwwwo',
  'owwwrrwwwo',
  'owrrrrrrwo',
  'owrrrrrrwo',
  'owwwrrwwwo',
  'owwwrrwwwo',
  '.owwwwwwo.',
  '..oooooo..',
];

export const RESOURCE_ICON: Record<ResourceId, string> = {
  wood: 'icon-wood',
  scrap: 'icon-scrap',
  food: 'icon-food',
  crystal: 'icon-crystal',
  medical: 'icon-medical',
};

export function buildResourceIcons(scene: Phaser.Scene): void {
  const make = (key: string, rows: string[]) => PixelFactory.makeTexture(scene, key, rows, P);
  make(RESOURCE_ICON.wood, WOOD);
  make(RESOURCE_ICON.scrap, SCRAP);
  make(RESOURCE_ICON.food, FOOD);
  make(RESOURCE_ICON.crystal, CRYSTAL);
  make(RESOURCE_ICON.medical, MEDICAL);
}
