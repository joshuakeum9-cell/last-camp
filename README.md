# LAST CAMP

A mobile-first 2D pixel survival RPG. You wake in a permanent winter beside a dying
campfire. Every day you leave camp, gather what you can, fight what finds you, and try
to get home before the light goes. Everything you carry back makes the camp better and
makes you harder to kill.

The whole game is one loop: **explore, collect, fight, return, upgrade, unlock, repeat.**

## ▶ Play it now

### **https://joshuakeum9-cell.github.io/last-camp/**

No install, no account. It runs in a browser on desktop or on a phone held sideways.

---

## Running it locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run preview` | Serve the built output |

There is nothing else to install. The project has no asset pipeline, no backend, no
accounts and no network calls.

## Controls

**Desktop**

| Key | Action |
|---|---|
| `W` `A` `S` `D` or arrows | Move |
| `Q` or left mouse | Attack. Hold to charge |
| `Space` | Dash. Invulnerable while dashing |
| `E` | Interact, read, open, advance dialogue |
| `F` | Eat food to heal out in the field |
| `1` `2` or `R` | Pick a weapon slot, or swap, once you have the Weapon Rack |
| `M` | The map of everything found so far |
| `Esc` | Pause out in the field, or close a menu |
| Settings | Download or restore your camp as a file |
| `` ` `` | Developer screen |

**Touch**

A stick appears wherever you first touch the left half of the screen. Attack, dash and
eat sit bottom right, and the hotbar moves to bottom centre so a thumb can tap a slot:
weapon slots select, the food slot eats. The interact button only appears when there is
something in reach. The II button top right pauses; tapping the compass opens the map.
Everything is sized and placed to stay out of the top of the screen and out of the way
of your thumbs. Phones held in portrait get a rotate prompt.

## Every day is different

Each morning the report names the day: a whiteout, a wolf moon, a rich vein of crystal,
a blizzard, or still air. Each one bends something out there: how many things hunt you,
what the nodes give, how fast the cold climbs, how far you can see. Every area has its
own scenery too. Lamps light the road at night, thin ice on the lake gives way if you
stand on a crack, and old fire pits can be lit with two wood to shed cold mid-trip.

## What lives where

Frost rats and ice wolves in the forest. Crows that wheel over the road and the tower
pass and dive straight through you. Skaters on the lake that slide at full speed and
never slow down. Drift brutes at the cabin and the den, hulks under a foot of snow with
a slam that has no safe side. The stalker comes at night, and in a whiteout it comes by
day. Three bosses: the White Maw in its den past the snowbank; the Hollow Stag pacing the
tower pass past the ice, with a charge to sidestep, a ring to dash through, and an ice
fall that punishes standing still; and, once Mira tells you about him, the One Who
Stayed, a ranger who only comes to the cabin after dark with a lantern, a fan of embers,
a blink that puts him behind you, and a call the trees answer. Kill him and the cabin's
walkers stop coming.

## Bestiary and boss weapons

The BEASTS tab at camp lists everything that has come for you, with the one thing it
exists to teach and how many you have killed. Unmet things are a row of question marks.
Each boss drops the one weapon nothing else does: the Survivor Hammer from the Maw, the
Hollow Antler from the Stag.

## The end of it

Build the Signal Table, kill all three of the valley's bosses, then work the radio at
camp. The tower answers. After that the tower at the top of the pass can be climbed,
and at the top there is a switch and a choice: end the winter, or keep the camp warm
and only the camp. The save remembers which, the title screen changes, and Mira has
something to say about it either way. You can keep playing afterwards.

## Difficulty

Three settings, chosen on the title screen and changeable at any time.

| | What changes |
|---|---|
| **Bearable** | Animals hit softer and move slower, the cold is patient, mistakes cost less |
| **Hard Winter** | The winter as it was designed. Start here |
| **Killing Cold** | Animals are faster and hit far harder, the cold does not wait, falling hurts |

Difficulty changes how dangerous the wilderness is, never how much it gives you.
Yields, costs and drop rates are identical across all three, so the pacing in
`ECONOMY.md` holds whichever you pick and nobody is pushed toward the easy setting to
make progress at a reasonable speed.

## Your camp is a file

Open **Settings** from the title screen or the camp menu. At the bottom:

- **DOWNLOAD CAMP** saves everything to `last-camp-day-4-2026-09-21.json`
- **RESTORE FROM FILE** loads one back. It asks twice, because it replaces everything

The game also autosaves to browser storage, but a browser can clear that without
warning and it does not follow you to another computer. The file is the copy that is
actually yours. A restored camp always starts at camp rather than mid-expedition.

## The first five minutes

Walk into the portal on the right edge of camp to head out. Hit trees for wood and bushes for food. Two
or three hits fells a pine. Rats come in packs and die in two swings of the axe. When
the clock at the top reaches **NIGHTFALL**, a compass appears pointing home and
everything you pick up after that is worth half as much again, if you live to carry it
back. Return through the camp gate on the left to bank it.

Back at camp, walk to the notice board or the tent and press `E` to open the menu. On
day one you can always afford at least one thing.

---

## Architecture

```
src/
  core/        state, saving, input, the event bus, the seeded RNG
  data/        every tunable number and every definition. No logic
  systems/     game rules. Plain TypeScript, no display objects
  entities/    things in the world that draw themselves
  scenes/      Phaser scenes
  ui/          pixel UI primitives
  art/         the entire art pipeline, generated from code
```

**Three rules hold the codebase together.**

1. **Systems never touch Phaser display objects.** Files under `src/systems/` and
   `src/core/` read and write `GameState` and talk over `EventBus`. Scenes and entities
   do the drawing. Four systems genuinely need a scene (Juice, Weather, Lighting,
   AudioManager); they take one in the constructor and own only their own objects.

2. **All numbers live in `src/data/`.** `balance.ts` holds everything a designer would
   want to change: movement speed, hitstop length, day length, cold rates, drop
   chances. Logic files import from it and never hardcode.

3. **No external assets.** Every sprite, tile, UI panel and glyph is rasterised at boot
   by `art/PixelFactory.ts` from pixel maps written as strings. Every sound is
   synthesised by `systems/AudioManager.ts` from oscillators and noise. There are no
   PNGs, no MP3s and no font files in this repository, which means nothing is licensed
   from anywhere and the art can be iterated by editing text.

### The event bus

`core/EventBus.ts` declares every message the game can send as a typed map, so a wrong
event name is a compile error rather than a silent no-op. Systems subscribe in their
constructor and hand back unsubscribe functions that scenes release on shutdown.

Input is the exception: it is polled once a frame rather than evented, because a
buffered press has to be readable at a known point in the frame.

### Saving

One JSON blob in `localStorage` under `lastcamp.save.v1`, with the previous good save
kept at `lastcamp.save.backup`. Loading runs a migration that fills any missing field
from a fresh state, so adding a field never breaks an existing player's camp. The game
saves on return to camp, on death, on every purchase, on settings changes, and every
ten seconds mid-expedition so backgrounding a tab loses nothing.

### Generating the world

`systems/MapGen.ts` fills the whole map with solid cliff and then carves the area
rectangles and corridors out of it. The map is therefore exactly as connected as
`data/areas.ts` says it is, and it is impossible to generate a map where an area cannot
be reached. Scenery is placed in clusters so the forest has thickets and clearings
rather than an even sprinkle.

### Performance

Enemies beyond 400px of the player stop updating and hide. Pickups, particles, damage
numbers and projectiles are short-lived and cleaned up on a timer. The night lighting is
a single RenderTexture refreshed at 30fps, using `erase` rather than a lighting
pipeline, so it behaves identically in WebGL and Canvas.

---

## The other documents

| File | What is in it |
|---|---|
| `ARCHITECTURE.md` | The approved design this was built from |
| `GAME_DESIGN.md` | Loop, combat, exploration, day cycle, camp, story, retention |
| `ECONOMY.md` | Resources, costs, pacing, loot |
| `MONETIZATION.md` | What a paid version could sell, and the rule it follows |
| `PLAYTEST.md` | The questions to ask someone playing it |
| `ANALYTICS.md` | What the local event log records and how to read it |
| `NEXT_STEPS.md` | What to validate before building anything else |

## Scope

This is a vertical slice, not a finished game. It holds roughly 15 to 30 minutes of
content: one map with six areas plus a hidden one, five enemies, five weapons, one
miniboss, one boss, one survivor, six notes, fifteen camp upgrades and six perks. The
locked pass to the signal tower is deliberately visible and deliberately shut. The
point of this build is to find out whether the loop is fun before anything else is
added to it.
