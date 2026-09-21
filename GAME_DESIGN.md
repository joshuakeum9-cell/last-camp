# LAST CAMP — game design

## The one sentence

Leave a warm place, go somewhere cold that wants to kill you, and decide every few
seconds whether one more thing is worth the walk back.

## The core loop

```
       ┌──────────────────────────────────────────────┐
       │                                              │
   EXPLORE ──► COLLECT ──► FIGHT ──► RETURN ──► UPGRADE ──► UNLOCK
       │                                 │            │
       └── "one more node" ──────────────┘            │
                                                      │
                 the camp visibly changes ────────────┘
```

Every arrow in that diagram has to feel good on its own. If a player enjoys only the
swinging, or only the shopping, the loop still works. The design target is that all six
are worth doing.

## Priority order

When two things conflict, the earlier one wins. This is the order the game was built in
and the order any future change should respect.

1. Movement feels good
2. Combat feels good
3. Gathering feels satisfying
4. Returning to camp feels rewarding
5. Upgrades visibly improve the player and the camp
6. Exploration creates curiosity
7. Day progression creates tension
8. Story creates curiosity
9. Retention systems
10. The store prototype

---

## Movement

92 pixels per second, reaching full speed in about four frames and stopping in three.
The approach is exponential rather than linear so it is frame-rate independent and
still snappy. Eight-way facing over three sprite sets, with the left side being the
right side flipped.

**Dash**: 48 pixels over 0.15 seconds, invulnerable for the whole of it, 0.8 second
cooldown. It leaves three cyan afterimages and a burst of snow.

**Perfect dodge**: dashing within 100 milliseconds of an enemy hitbox opening triggers
120 milliseconds of slow motion, a white ring, a refunded dash, and a guaranteed
critical on the next hit within a second. It is the cheapest large feel win in the
design: it costs one timestamp comparison and it teaches dodging better than any
tutorial would.

Inputs are buffered for 120 milliseconds, so a press during a swing still fires.

## Combat

Every weapon runs the same state machine: **windup → active → recovery**, with a combo
window during recovery. Hitboxes are checked geometrically rather than with physics
rectangles, because a swing needs to be an arc.

Every connected hit fires the same feedback package:

| Effect | Value |
|---|---|
| Hitstop | 60ms, 90ms on a crit, 110ms on a kill |
| Enemy flash | White fill for 80ms, plus a three-frame squash |
| Knockback | Per weapon, divided by enemy mass |
| Screen shake | 2px, 4px on a crit, 6px on a kill |
| Weapon trail | An arc sprite that sweeps through the swing |
| Sparks | 4 to 10 particles in the enemy's accent colour |
| Damage number | White, gold on a crit |
| Sound | A different impact per weapon, a two-note chirp on a crit |

**Charged attack**: hold attack for 0.55 seconds for x2.5 damage, x1.6 knockback and a
wider arc. Every melee weapon has it.

Anything overlapping the player is always in range, so a swing never whiffs on
something standing on top of you.

### The five weapons

They are deliberately not a damage ladder. Each one changes how you fight.

| Weapon | How it plays |
|---|---|
| Rusted Axe | Slow, heavy, three-hit combo, the third hit staggers. Moves whatever it hits |
| Hunter Knife | Four fast hits, low damage, 30% crit. Lives on lucky cuts |
| Scrap Spear | Long thrust that pierces a line and pushes you back a step on contact |
| Frost Bow | Three regenerating charges, slows what it hits. Charged shots pierce |
| Survivor Hammer | Very slow, a circle rather than an arc, one full second of stun |

Each has an upgrade path: **base → reinforced → one of two branches**. The branches are
data, not code, and they change behaviour rather than numbers. The Scavenger Axe fells a
tree in one blow and takes 30% more wood; the Heavy Axe staggers everything it touches.
A player will have a preference, and that preference is the build.

Found weapons roll a rarity and carry modifiers: Burning, Keen, Brutal, Vampiric, Warm,
Lucky. Rare and epic drops glow and have their own sound.

### The five enemies

Each one exists to teach a different thing.

| Enemy | Teaches | How |
|---|---|---|
| Frost Rat | Crowd control | Packs of three to five, a short lunge, and they scatter below a third health |
| Ice Wolf | Dodge timing | Circles at a distance, crouches, commits to a charge it cannot cancel. The long recovery is your window |
| Frozen Walker | Patience and position | Cannot be staggered. The longest telegraph and the hardest hit. Walking away always works, if you start in time |
| Snow Spitter | Movement | Never closes. Punishes standing still, which is the habit melee teaches |
| Alpha Beast | All of it | The wolf's charge, the walker's weight, and a howl that brings rats |

Telegraphs are always a **shape** as well as a colour: a ground line for a charge, a
ground circle for a slam, a mark over the head for a lunge. The read never depends on
seeing red.

Enemies scale with the day, but not by inflating health. HP rises 8% a day and caps at
1.6x. What actually changes is which enemies appear, how many are in a pack, and what
they are mixed with.

## Exploration

One compact map, 100 by 60 tiles, with six areas, one hidden pocket and one locked pass.

```
[Camp gate] → Frozen Forest → Abandoned Road → Ruined Cabin → [Signal Tower Pass: LOCKED]
                    │                               │
                    └────────→ Frozen Lake ←────────┘
                                 │      ╲
                           Boss Den      (cracked ice → Hollow Under the Ice)
```

The map is generated by filling everything with solid rock and carving the areas and
corridors out of it, so it is exactly as connected as the data says.

Each area is visually distinct: the forest is bright blue-white with saturated green
pines, the road is violet asphalt under snow, the lake is vivid cyan ice. Crossing a
border changes the temperature of the screen rather than snapping it.

**The secret**: at the lake's eastern edge the ice tiles are darker and glassier. There
is no marker and no quest. Standing on them and pressing interact gives a line about
the ice humming; hitting it twice more opens the hollow, which holds the Frost Bow, the
strangest note in the game, and an outfit.

**The lock**: the tower pass is visible from day one and never opens. The tower itself
is on the horizon in every outdoor scene, with a slow red blink.

## The day cycle

240 seconds, five phases.

| Phase | Time | What changes |
|---|---|---|
| Morning | 0 to 80s | Nothing yet |
| Midday | 80 to 150s | Nothing yet |
| Evening | 150 to 200s | Purple light, thicker fog, cold rises 30% |
| Nightfall | 200 to 240s | Light starts going, cold rises 60%, enemies hit 20% harder, a warning |
| Night | 240s+ | Deep dark, cold doubles, enemies hit 40% harder and move faster, the Night Stalker arrives |

Two decisions make this work.

**The night bounty.** Everything gathered after nightfall is worth 50% more when banked,
shown as its own glowing line on the summary. That turns a vague feeling into a bet the
player chooses to make. Staying out is not a mistake the game punishes; it is an option
the game pays for.

**The home compass.** From nightfall a small campfire icon on the screen edge points
toward camp. Pressure should never become confusion.

Night is dangerous, not instantly lethal. Nothing about it kills on its own.

## Cold

A meter that fills at 0.3 per second outdoors, multiplied by the time of day, the
weather and how exposed the area is. It drops near the fire, inside shelter, and when
you eat. At 70 it warns with a frost vignette and a shivering icon; at 100 it takes two
health a second and slows you by 20%.

Camp upgrades and perks blunt it permanently, capped at 60% resistance so it always
matters. It exists to create decision pressure, not to be a second health bar you have
to babysit.

## The camp

The emotional opposite of the map, and the reason to come back. Warm orange and gold
against the blue outside, with a fire that is meant to be the most recognisable object
in the game.

Everything bought appears physically on the ground. The camp has five levels driven by
how many things you own, and each one changes the shelter, the walls and the layout:

| Level | What it looks like |
|---|---|
| 1 | A fire and a torn tent. It is not much yet |
| 2 | Patched, staked down, starting to look deliberate |
| 3 | A working camp. Somewhere you would choose to come back to |
| 4 | Walls, lanterns, room for more than one person |
| 5 | Not a camp any more. A place |

A morning report gives each day a hook before you leave: the weather, and one line
about something that happened overnight.

## The summary screen

The most important screen in the game after the camp. It has to make the last fifteen
minutes feel like they moved you forward, and then point at what you can buy.

Resource lines count up one at a time with the pickup sound. The night bounty gets its
own line. Then a panel headed **WHAT CAN YOU UPGRADE?** lists everything newly
affordable, pulsing gold, and names the single closest thing you cannot yet buy with
exactly what is missing: "Cooking Pot: 3 more scrap."

That last line is the hook for the next day.

## Death

You return to camp and lose half of what you were carrying, softened to 25% with the
Storage Crate and 10% with the Supply Store. You keep every upgrade, every weapon,
every note and every unlock.

The target feeling is "I can do better next time", never "I just wasted my evening."

## Story

Six notes, two to four sentences each. Together they say that the snow started on a
particular Tuesday, that the tower was tested at 0400 that morning, that eleven people
walked toward it and none came back, that the crystals grow where the ice is thinnest,
that the cold is being pulled toward the tower rather than spreading from it, and that
the thing in the den was wearing a collar that had been cut rather than broken.

They never say why. The journal counts them, which is itself a reason to go back out.

**Mira** is found bound in the cabin once the Alpha Beast is dealt with. After that she
is simply at camp, with a line for each camp level, and she unlocks the two upgrades
that lead toward the tower. Her purpose is that the camp stops being empty.

## The boss

**The White Maw.** 600 health, three patterns, one phase change.

| Pattern | Tell | Punish |
|---|---|---|
| Charge | Rears up, draws a line on the ground, roars | It stuns itself on the arena wall |
| Ice Slam | Raises both paws, an expanding ring outline. Inside is unsafe, outside is safe | 0.7s of recovery |
| Blizzard Howl | Four markers appear on the ground, then rats, then icicles on the markers | It paces slowly while the rats are up |

It never uses the same pattern twice in a row. At half health it roars, shortens every
telegraph by 20% and starts double-charging. Its health does not go up.

Killing it gives the hammer component, a large haul, a permanent camp trophy that adds
5% damage, and the last note.

## Retention

Seven reasons to start another day, none of which is a login bonus.

- **Progression.** The summary names the thing you are closest to
- **Discovery.** The map shows areas you have not walked into
- **Mastery.** Perfect dodges, and returning without being hit
- **Collection.** Six notes, five weapons, ten achievements
- **Story.** The journal counts what you have not found
- **Ownership.** The camp visibly changes and you walk through it every day
- **Risk.** The night bounty asks a real question every single evening

A rotating daily challenge sits on top of these as a nudge to play differently. Missing
it costs nothing.
