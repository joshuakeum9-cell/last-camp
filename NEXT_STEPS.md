# LAST CAMP — what to do next

## The short version

**Do not add content yet.** Put this in front of five people and find out whether the
loop is fun. Everything below is ordered so that the cheapest question that could
invalidate the most work gets answered first.

---

## 1. Validate the loop before anything else

Five playtests, `PLAYTEST.md` in hand, analytics cleared before each one.

The build succeeds if most people, unprompted, keep playing past the point where you
tell them they can stop. It fails if they put it down after a completed day, because a
completed day is exactly the moment the game is supposed to be at its most compelling.

**The three questions that decide what happens next:**

| Question | If the answer is no |
|---|---|
| Did they want another day? | Nothing else matters. Fix this first |
| Did the camp changing register? | Placements are too subtle, or upgrades are too slow |
| Did they take the night bet at least once? | Night is not tempting enough, or not scary enough |

## 2. Fix feel before fixing content

If combat is not satisfying, adding a sixth enemy will not help. The dials, in the
order worth trying:

1. `BAL.combat.hitstopMs` — the single biggest lever on whether a hit lands
2. Weapon `recovery` — the most common cause of "I pressed it and nothing happened"
3. `BAL.combat.shake` and the flash duration
4. `BAL.player.accelTime` — if movement feels heavy, this is why

Change one at a time and retest. Changing three and liking the result teaches nothing.

## 3. Things already known to be weak

Honest list, from building it.

| Thing | Why it is weak | Fix |
|---|---|---|
| The Alpha Beast reuses the wolf sprite | It should look like a boss, because it is the gate to Mira | Its own sprite, roughly 40x28 |
| Consumables cannot be used in the field | Food is bankable but not drinkable mid-run, which blunts the cold system | A quick-use key and a touch button |
| The bridge shortcut is designed but not built | It is in ARCHITECTURE.md and in the save schema, and nothing builds it | A repairable footbridge at the lake for 20 wood |
| The map overview is not built | The Watchtower promises it and delivers only the clock | A fogged pixel map on the notice board |
| Camp props at small sizes are hard to tell apart | The workbench, weapon rack and medical table are all brown rectangles | Stronger silhouettes and one accent colour each |
| There is no tutorial | Day one is the tutorial, which may or may not be enough | Find out from a playtest before writing one |

None of these are worth doing before step 1.

## 4. What to build only if the loop holds

In order.

**More reasons to go further out, not more map.** The map is the right size. What it
lacks is a reason to cross it late in a day. A second hand-placed cache tier that only
appears at night would do more than a seventh area.

**One more weapon with a genuinely different verb.** Not a sixth damage number. Something
that changes what you do with your hands: a thrown weapon you have to walk back to pick
up, or a shield.

**The signal tower.** The locked pass is the strongest hook in the build because it is
visible from day one and never opens. It should be the next region, and it should be
what the Signal Table counts toward. Five parts, one per major area, is the obvious
structure and it reuses everything that already exists.

**A second survivor.** Mira makes the camp feel inhabited. A second person would make it
feel like a place with a future, which is the emotional payoff the whole camp
progression is building toward.

## 5. What not to build

- **More resources.** Five is right. A sixth would make every cost illegible
- **A crafting tree.** The weapon branches already carry build variety
- **Procedural map generation.** The hand placement is what makes the secret findable
  and the pacing reliable
- **Multiplayer, an open world, or a longer story.** All three were out of scope for good
  reasons and none of them have changed

## 6. Technical work worth doing

Only after the design questions are answered.

| Item | Why |
|---|---|
| Object pooling for pickups and particles | The only thing likely to matter on a low-end phone. Not yet measured |
| A real frame-rate check on hardware | Everything so far has been measured in a desktop browser |
| Splitting `WorldScene` | It is approaching 500 lines and is the only file over the limit in CLAUDE.md |
| A handful of unit tests on `ResourceSystem` and `SaveSystem` | Both are pure and both have already produced one real bug |
| Deploying it somewhere | Playtests are much easier with a link than with a repository |

## 7. The bug that was already found

The save migration crashed when loading a save taken mid-expedition, because
`typeof null === 'object'` made it recurse into a null template. The player saw a black
screen and lost nothing except their patience.

It was found by resizing a browser window, not by playing. That is worth remembering:
the failure modes of this build are most likely to be in loading, resuming and
backgrounding, not in the fighting. Those are the paths to test on a real phone first.
