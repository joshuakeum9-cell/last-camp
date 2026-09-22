import { hashString, Rng } from '../core/Rng';
import type { ResourceId } from './resources';

/**
 * The thing worth walking to today.
 *
 * The valley is large and most of it is the same snow, so every day one place in
 * it has something in it: an animal in a snare, a fire nobody is sitting at, a
 * mast still blinking. It is marked on the map from the morning, it is always a
 * long walk, and when you get there it asks one question with two answers and
 * no right one. Don't Starve calls these set pieces; Darkest Dungeon calls them
 * curios. They are the cheapest way to make a big map worth crossing.
 */
export interface SightingEffect {
  /** What it hands over, collected the normal way. */
  resources?: Partial<Record<ResourceId, number>>;
  heal?: number;
  /** Drops the cold back to nothing. */
  warm?: boolean;
  /** Nothing hunts you from as far for the rest of the day. */
  calm?: boolean;
  /** The cold climbs slower for the rest of the day. */
  coat?: boolean;
  /** Every cache in the valley is on the map for the rest of the day. */
  mast?: boolean;
  /** Something wakes up where you are standing. */
  wakes?: boolean;
  /** A weapon, rolled uncommon. */
  weapon?: boolean;
  /** One line, said after it is done. */
  line: string;
}

export interface SightingChoice {
  label: string;
  boon?: string;
  cost?: string;
  effect: SightingEffect;
}

export interface SightingDef {
  id: string;
  /** The name on the map marker and in the morning report. */
  name: string;
  /** The morning report line at camp. */
  report: string;
  /** The sprite it is drawn with. */
  sprite: 'bones' | 'skull' | 'oldFire' | 'iceCrack' | 'lampPost';
  /** What you see when you walk up to it. */
  lines: string[];
  choices: [SightingChoice, SightingChoice];
}

export const SIGHTINGS: SightingDef[] = [
  {
    id: 'snare',
    name: 'Something in a snare',
    report: 'Something has been screaming down in the valley since before light.',
    sprite: 'bones',
    lines: [
      'A young wolf, one leg in a wire loop somebody set years ago.',
      'It has worn the snow down to the ground turning circles. It stops when it sees you.',
    ],
    choices: [
      {
        label: 'Cut the wire',
        boon: 'Nothing hunts you as hard today.',
        effect: { calm: true, line: 'It goes without looking back. The others keep their distance now.' },
      },
      {
        label: 'Put it down',
        boon: 'Ten food and a clean end.',
        effect: { resources: { food: 10 }, line: 'It was not going to last the night either way.' },
      },
    ],
  },
  {
    id: 'traveller',
    name: 'Someone who stopped',
    report: 'There is a shape out on the snow that was not there yesterday.',
    sprite: 'skull',
    lines: [
      'Someone sat down against a rock with their back to the wind and did not get up.',
      'A good coat. A full pack. They were not short of anything except time.',
    ],
    choices: [
      {
        label: 'Take the coat',
        boon: 'The cold climbs slower for the rest of today.',
        effect: { coat: true, line: 'It is too big and it smells of someone else. It works.' },
      },
      {
        label: 'Take the pack',
        boon: 'Fifteen scrap and five food.',
        effect: { resources: { scrap: 15, food: 5 }, line: 'You leave the coat on them. It seemed like the least of it.' },
      },
    ],
  },
  {
    id: 'icecache',
    name: 'Something under the ice',
    report: 'Mira says there is a straight edge under the ice where nothing should be straight.',
    sprite: 'iceCrack',
    lines: [
      'A steel case, frozen a hand deep into the lake. The corner of it catches the light.',
      'Getting it out means breaking ice, and breaking ice out here is a noise that carries.',
    ],
    choices: [
      {
        label: 'Break it out',
        boon: 'Whatever is in it.',
        cost: 'Everything within earshot comes.',
        effect: { weapon: true, resources: { crystal: 4 }, wakes: true, line: 'The lid comes off. So does the quiet.' },
      },
      {
        label: 'Chip the loose ice',
        boon: 'Eight frost crystal, quietly.',
        effect: { resources: { crystal: 8 }, line: 'You take what came away easily and leave the rest frozen in.' },
      },
    ],
  },
  {
    id: 'strangerfire',
    name: 'A fire nobody is at',
    report: 'There was a light out east in the night. It is still going.',
    sprite: 'oldFire',
    lines: [
      'A fire built properly, with a windbreak, burning down but not out.',
      'Two sets of prints leaving. None coming back.',
    ],
    choices: [
      {
        label: 'Sit down a while',
        boon: 'The cold goes, and fifteen health back.',
        effect: { warm: true, heal: 15, line: 'The first warm you have been all day. You could have stayed.' },
      },
      {
        label: 'Take the wood',
        boon: 'Twenty wood and six scrap.',
        cost: 'The fire goes out.',
        effect: { resources: { wood: 20, scrap: 6 }, line: 'It is out in a minute. Whoever built it will have to build another.' },
      },
    ],
  },
  {
    id: 'mast',
    name: 'A mast still blinking',
    report: 'Something out there blinked twice in the dark, at the same interval, all night.',
    sprite: 'lampPost',
    lines: [
      'A relay mast bent over at the waist, one light on it still keeping time.',
      'The battery under it has years left. The rest of it is worth carrying home.',
    ],
    choices: [
      {
        label: 'Leave it running',
        boon: 'Every cache in the valley is on your map today.',
        effect: { mast: true, line: 'You tune the handset to it. The map fills in as you walk.' },
      },
      {
        label: 'Strip it',
        boon: 'Twenty-five scrap and three crystal.',
        cost: 'The light goes out.',
        effect: { resources: { scrap: 25, crystal: 3 }, line: 'The light goes out. The valley is a little darker and your pack is heavier.' },
      },
    ],
  },
];

/** Today's, seeded from the day so the morning report and the map agree. */
export function sightingForDay(day: number, salt = 0): SightingDef {
  const rng = new Rng(hashString(`sighting:${day}:${salt}`));
  return SIGHTINGS[rng.int(0, SIGHTINGS.length - 1)];
}
