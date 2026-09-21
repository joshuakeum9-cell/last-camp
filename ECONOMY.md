# LAST CAMP — economy

Every number here lives in `src/data/`. Nothing in this document is hardcoded in logic.

## The five resources

Five, and never a sixth. Each one has an obvious job, and the player should be able to
say what it is for without opening a menu.

| Resource | Where it comes from | What it is for |
|---|---|---|
| **Wood** | Pines and dead trees, 2 to 5 per tree | Shelter and fire. The early currency |
| **Scrap** | Wrecked cars, walkers, crates | Weapons and stations. The mid currency |
| **Food** | Bushes, rats, wolves | Healing, warmth, and the Hearty perk |
| **Frost Crystal** | Crystal spires, walkers, spitters | Advanced upgrades. Rare, glows, has its own sound |
| **Medical Supplies** | The Alpha Beast, epic caches | Two things in the whole game need it. Very rare |

The Frost Bow uses regenerating charges rather than arrows, specifically so that
ammunition never becomes a sixth currency.

## Yield

```
granted = round(base × (1 + campYieldBonus + perkYieldBonus))
```

| Source | Bonus |
|---|---|
| Scavenger Rack (camp) | +15% |
| Scavenger (perk) | +10% |
| Scavenger Axe (weapon branch) | +30% wood only |

A player who takes all three gets +55% wood and +25% of everything else. That is a
meaningful build choice, not a requirement.

## Where a day's haul comes from

A typical day in the forest and the road, played reasonably thoroughly:

| Source | Typical yield |
|---|---|
| 5 to 7 trees | 14 to 28 wood |
| 2 to 4 wrecks | 6 to 14 scrap |
| 3 to 5 bushes | 4 to 9 food |
| 10 to 16 enemies | 4 to 8 food, 3 to 6 scrap |
| 8 to 12 breakables | 4 to 9 mixed |
| 1 to 2 caches | 8 to 20 mixed, sometimes a crystal |

## Camp upgrades

| # | Upgrade | Cost | Effect |
|---|---|---|---|
| 1 | Better Fire | 10 W | Cold 20% slower |
| 2 | Roaring Fire | 25 W, 1 C | Cold 35% slower, more firelight |
| 3 | Patched Shelter | 15 W, 5 S | +20 max health |
| 4 | Fortified Shelter | 30 W, 15 S | +50 max health |
| 5 | Workbench | 12 W, 10 S | Weapon upgrades, craft the spear |
| 6 | Storage Crate | 10 W, 8 S | Keep 75% on death |
| 7 | Supply Store | 25 W, 20 S | Keep 90% on death |
| 8 | Cooking Pot | 12 S, 5 F | Food heals 25 not 15, cook broth |
| 9 | Scavenger Rack | 20 W, 10 S | +15% yield |
| 10 | Medical Table | 20 S, 1 M | Medical heals fully, clears cold |
| 11 | Weapon Rack | 15 W, 15 S | A second weapon slot |
| 12 | Watchtower | 40 W, 20 S | Caches on the map, exact time on the clock |
| 13 | Ember Lantern | 15 S, 2 C | Carry light at night, cold 10% slower. Needs Mira |
| 14 | Signal Table | 30 S, 3 C | The closing beat. Needs Mira and the boss dead |
| 15 | Maw Trophy | awarded | +5% damage. Cannot be bought |

W wood, S scrap, F food, C frost crystal, M medical supplies.

Upgrades in the same group do not stack: owning the Roaring Fire supersedes the Better
Fire rather than adding to it. Across groups, effects sum.

## Perks

| Perk | Cost | Effect | Max |
|---|---|---|---|
| Hearty | 6 F | +10 max health | x3 |
| Sharp Edge | 8 S | +5% damage | x3 |
| Scavenger | 12 S | +10% yield | x1 |
| Quick Step | 10 S, 4 F | Dash cooldown 0.8s → 0.6s | x1 |
| Thick Coat | 10 W, 6 F | Cold 15% slower | x1 |
| Lucky Find | 2 C | Better cache rolls | x1 |

Cold resistance from every source is capped at 60%, so cold never stops mattering.

## Weapon upgrades

| Step | Cost | Effect |
|---|---|---|
| Reinforce | 15 S | +20% damage, opens the branches |
| Branch | 30 S, 2 C | One of two, changing behaviour rather than numbers |

Crafting the Scrap Spear costs 18 scrap and needs the Workbench.

## Pacing target

What a first-time player should be doing, day by day. These are targets to test against,
not a script.

| Day | What happens | Rough haul (W/S/F) | Likely purchases |
|---|---|---|---|
| 1 | Forest, rats, first cache, one note, home before dark | 14 / 6 / 4 | Better Fire |
| 2 | Wolves appear, reach the road, find the Hunter Knife | 18 / 14 / 5 | Workbench, Storage Crate |
| 3 | Walkers, maybe a storm, the cabin door, the Alpha is probably too much | 20 / 18 / 6 | Cooking Pot, craft the spear, reinforce something |
| 4 | Kill the Alpha, free Mira, the cabin as shelter, first night bounty | 22 / 20 / 6, 2 C, 2 M | Patched → Fortified Shelter, Scavenger Rack |
| 5 | The lake, spitters, crystals, the cracked ice, the Frost Bow | 24 / 22 / 6, 4 C | Weapon Rack, Ember Lantern, a branch |
| 6 to 8 | Boss attempts, Watchtower, Signal Table, the closing beat | | Watchtower, Signal Table |

### Rules the balance has to hold

These are the invariants. If a change breaks one of them, the change is wrong.

1. **The first upgrade is affordable after day one, whatever the player did.**
2. **Something new is affordable after every returned day up to day six.** If the
   summary ever says "nothing yet", the curve has a hole in it.
3. **No enemy takes more than eight hits** with the weapon the player is expected to
   have on that day.
4. **A Frost Rat dies in two swings of the starting axe.** Twelve damage, fourteen
   health, so the second swing always kills even without a crit.
5. **The boss is beatable in two to four attempts** by someone who has learned the
   patterns. Its difficulty is pattern reading, not attrition.

## Difficulty

| | Enemy health | Enemy damage | Enemy speed | Cold rate | Death loss | Telegraph |
|---|---|---|---|---|---|---|
| Bearable | 0.85x | 0.65x | 0.85x | 0.7x | 0.6x | 1.25x |
| Hard Winter | 1x | 1x | 1x | 1x | 1x | 1x |
| Killing Cold | 1.25x | 1.45x | 1.12x | 1.35x | 1.3x | 0.85x |

**Nothing in this table touches income.** Yields, upgrade costs, cache contents and
drop rates are identical on all three. That is deliberate: if the easy setting also
paid better, it would stop being a choice about how the game feels and become a choice
about how fast you progress, and the five invariants above would only hold on one of
them.

Enemy health barely moves even on the hardest setting, for the same reason the boss
does not gain health in phase two. The difficulty should come from the animals being
harder to read and harder to survive, not from them taking longer to kill.

## Loot

Cache rarity weights out of 1000, before Lucky Find:

| Rarity | Weight | Contains |
|---|---|---|
| Common | 620 | 3 to 6 wood, 2 to 4 scrap |
| Uncommon | 260 | 4 to 8 wood, 4 to 7 scrap, 1 to 3 food |
| Rare | 100 | 6 to 10 scrap, 2 to 4 food, 1 to 2 crystal |
| Epic | 20 | 10 to 16 scrap, 2 to 4 crystal, 1 to 2 medical |

Lucky Find shifts eight points from common into each of the other three.

Rarity also sets how many modifiers a found weapon rolls: 0, 1, 2, 3.

**All eight caches are placed by hand and have a fixed rarity.** Every weapon the
player needs to progress is in one of them. Random rolls vary the texture of a run; they
never gate it. A player who has terrible luck for six days still finishes the game on
the same schedule as one who does not.

Cache contents are seeded from the cache id and the day, so reloading cannot reroll
them.

## Bonuses on the way home

| Bonus | Size | Why it exists |
|---|---|---|
| Night bounty | +50% on anything gathered after nightfall | Makes staying out a paid bet rather than a mistake |
| Untouched | +10% on everything | Rewards mastery without demanding it |
| Challenge reward | A small bundle | A nudge to play differently for one day |

## Death

| Owned | Kept |
|---|---|
| Nothing | 50% |
| Storage Crate | 75% |
| Supply Store | 90% |

Permanent upgrades, weapons, notes, unlocks and achievements are never lost.
