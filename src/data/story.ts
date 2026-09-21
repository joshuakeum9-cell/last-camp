import type { AreaId } from './areas';

export const NOTE_IDS = ['ranger', 'radio', 'cabin', 'lake', 'hollow', 'collar'] as const;
export type NoteId = (typeof NOTE_IDS)[number];

export interface NoteDef {
  id: NoteId;
  title: string;
  /** Two to four short sentences. Nothing is ever explained outright. */
  body: string;
  area: AreaId;
  /** Tile position of the note in the world. */
  tx: number;
  ty: number;
}

/**
 * Six notes. Together they say that the winter started on a particular day, that people
 * walked toward the tower and did not come back, and that the thing in the den had been
 * tagged by whoever ran it. They do not say why. That is the point.
 */
export const NOTES: Record<NoteId, NoteDef> = {
  ranger: {
    id: 'ranger',
    title: "Ranger's log, day 4",
    body:
      'Snow since Tuesday. That is normal.\n' +
      'It has not stopped since Tuesday. That is not.\n' +
      'Station says sit tight. Station has not answered since this morning.',
    area: 'forest',
    tx: 24,
    ty: 16,
  },
  radio: {
    id: 'radio',
    title: 'Transcript, partial',
    body:
      '— confirm the tower test went ahead at 0400.\n' +
      '— then what is it doing to the air?\n' +
      '— we do not have a word for what it is doing to the air.',
    area: 'road',
    tx: 39,
    ty: 24,
  },
  cabin: {
    id: 'cabin',
    title: 'Left on the table',
    body:
      'Eleven of us walked out toward the tower on the first clear morning.\n' +
      'I am writing this because I am the one who stayed.\n' +
      'It has been nine days. Nobody has come back down the road.',
    area: 'cabin',
    tx: 66,
    ty: 20,
  },
  lake: {
    id: 'lake',
    title: 'Survey notes, water sample',
    body:
      'The crystals grow where the ice is thinnest, not where it is thickest.\n' +
      'Whatever is making them is underneath, and it is warm.\n' +
      'I do not know how to write that down so it sounds sane.',
    area: 'lake',
    tx: 52,
    ty: 44,
  },
  hollow: {
    id: 'hollow',
    title: 'Instrument page',
    body:
      'Readings fall off with distance from the tower in every direction.\n' +
      'Cold is not spreading outward from the tower.\n' +
      'Cold is being pulled inward toward it. I have checked this four times.',
    area: 'secret',
    tx: 72,
    ty: 50,
  },
  collar: {
    id: 'collar',
    title: 'A collar tag, chewed through',
    body:
      'SUBJECT 6 — TOWER SITE — DO NOT RELEASE\n' +
      'The strap has been cut, not broken.\n' +
      'Somebody let it out on purpose.',
    area: 'bossden',
    tx: 88,
    ty: 40,
  },
};

export const NOTE_LIST = NOTE_IDS.map((id) => NOTES[id]);

// --- Mira ----------------------------------------------------------------

export const MIRA = {
  name: 'Mira',
  /** Said once, when the player cuts her loose in the cabin. */
  rescue: [
    'You are not one of them. Good.',
    'I was a mechanic before all this. I can still be useful.',
    'There is a fire somewhere near here. I can smell it from the door.',
  ],
  /** One greeting per camp level, so the camp feels like it has someone in it. */
  greeting: [
    'It is not much yet. It is more than the cabin was.',
    'I patched the tent. Do not thank me, thank the tarp.',
    'This is a real camp now. I keep catching myself calling it home.',
    'Walls and lights. I sleep properly for the first time since the road.',
    'Look at it. Somebody could live here.',
  ],
  assignments: {
    wood: 'I will work the treeline while you are out. Bring the axe back sharp.',
    food: 'I will set snares. Do not expect much.',
    scrap: 'I will strip what is left of the cars. Watch the road for me.',
  },
  /** After the White Maw is dead. */
  afterBoss: [
    'I heard it from here. Then I heard it stop.',
    'Give me the fang and a day. I will make you something that ends arguments.',
  ],
  /** Once the signal table is built. */
  signal: 'The tower is answering. It should not be able to answer.',
};

// --- the journal ---------------------------------------------------------

/** Shown on the notice board once anything has been found. */
export function journalLines(found: string[]): Array<{ title: string; body: string; known: boolean }> {
  return NOTE_LIST.map((note) => ({
    title: found.includes(note.id) ? note.title : '???',
    body: found.includes(note.id) ? note.body : 'Not found yet.',
    known: found.includes(note.id),
  }));
}
