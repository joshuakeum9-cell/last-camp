# LAST CAMP — monetization prototype

## What exists in this build

A simulated store and three simulated rewarded-ad buttons. **There is no payment code
anywhere in this project, no SDK, and no network call.** The only button in the store
grants the item outright, so the flow can be tested without anything real happening.

Everything below describes what a paid version *could* do. None of it is implemented.

## The rule this follows

> Nothing sold is required to finish the game, and nothing about normal play was made
> worse in order to sell something.

That is not a marketing line, it is a constraint the economy was designed under and
that you can check against `ECONOMY.md`. Specifically:

- Every weapon the player needs is in a hand-placed cache, not a random roll
- The boss is beatable with the starting axe, reinforced
- The five invariants in `ECONOMY.md` guarantee something new is affordable after every
  returned day up to day six
- Death loses resources, never progress
- Cold is capped so it cannot be turned into a paywall by tuning

If a future change to the economy would sell more but break one of those, it is the
wrong change.

## What a paid version could sell

### Cosmetics

The largest category, and the one that carries no risk to the design.

| Item | Note |
|---|---|
| Character outfits | Warm Survivor Jacket, Frost White |
| Weapon skins | Bone, applied across every weapon |
| Campfire colours | Gold, Cold Blue. The fire is the most looked-at object in the game |
| Snow trails | Dust, Ember |
| Attack effect tints | The swing arc already takes a colour |
| Profile borders | For a future leaderboard |

Several of these are also achievement rewards in this build, and the store shows them
as **earned** and free to wear when they are. That is deliberate: a player who does the
work should never be shown a price for something they already unlocked.

### Convenience

| Item | What it is |
|---|---|
| Small and Large Supply Crates | Skip a day of gathering, if you would rather not |
| Second expedition slot | A second survivor works offline. Convenience, not power |
| Inventory conveniences | Sorting, favourites, quick-equip |

Resource packs are the category that most often goes wrong. The guard is the pacing
table: a large crate is roughly three days of gathering, and the game is eight days
long. It buys time, not a different game.

### What it should not sell

- Anything that raises damage, health or drop rates beyond what is buildable
- Anything that makes the boss easier
- Loot boxes of any kind
- Anything that makes the cold, the day length or the death penalty better than the
  free tuning. Those are exactly the dials you would reach for to make paying feel
  necessary, which is why they are the ones to leave alone

## Rewarded ads

Three, all optional, all opt-in, none of them interrupting anything.

| Where | Reward | Limit |
|---|---|---|
| Summary, after a successful return | Double this haul | Once per day |
| Death screen | Get up. Keep the haul, the day continues | Once per day |
| Camp supply drop | A small bundle | Once per real day |

Rules that are implemented in this prototype and should survive into any real version:

1. **Nothing plays on its own.** The player presses a clearly labelled button
2. **Nothing interrupts gameplay.** No pre-roll, no mid-run break
3. **The fake overlay says it is a prototype** and that nothing is actually playing
4. **Each is capped**, so an ad is a choice rather than a loop

The revive is the one to watch. It is limited to once per day precisely so that death
keeps meaning something; if it were unlimited, the death penalty would stop existing
and the whole risk-and-reward structure of the night would collapse.

## What the prototype records

`state.store.simulatedSpend` accumulates the notional price of anything granted, and
every store open, simulated purchase and ad click goes into the local analytics log.
The developer screen shows the running total.

That is there to answer one question in a playtest: **at what moment does a player
first look at the store?** If they open it on day one, the early game is not generous
enough. If they never open it, the catalogue is not interesting. Neither is a reason to
make the game worse.

## If this were shipped

The honest version of this is a one-off purchase with a cosmetic shop, not a free game
with a resource economy. The loop is 15 to 30 minutes long and the pacing table assumes
a player who is enjoying themselves rather than one who is stuck. Stretching it to
support recurring spend would mean widening the upgrade costs, which means breaking
invariant 2 in `ECONOMY.md`, which means the summary screen stops saying "you can
afford this now" every day, which is the single strongest reason anyone plays a second
day.

That trade is not worth it.
