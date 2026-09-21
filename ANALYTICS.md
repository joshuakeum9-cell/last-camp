# LAST CAMP — analytics

## What this is

A local event log, written to `localStorage` under `lastcamp.analytics`. It exists to
answer the questions in `PLAYTEST.md` with numbers rather than memory.

**Nothing is ever sent anywhere.** There is no endpoint, no SDK, no fetch call and no
identifier of any kind in this project. The log is read by opening the developer screen
and copying it out by hand.

## Getting at it

Press `` ` `` in game, or click the version label on the title screen.

The developer screen shows the current state, a count of everything logged, the twelve
most common events, and four buttons:

| Button | What it does |
|---|---|
| COPY ANALYTICS | The full export as JSON, to the clipboard |
| SAVE JSON | The current save blob, to the clipboard |
| GRANT 50 | 50 of every resource, for reaching a later day quickly |
| CLEAR EVENTS | Wipes the log. Do this before a fresh playtest |

## The export

```json
{
  "exportedAt": "2026-09-21T...",
  "sessionSeconds": 1840,
  "totalEvents": 412,
  "summary": [ { "name": "resource:collected", "count": 180 }, ... ],
  "events": [
    { "t": 1790000000000, "day": 3, "name": "day:started", "props": { "day": 3 } },
    ...
  ]
}
```

Every event carries a timestamp, the in-game day it happened on, a name, and optional
properties. The log is capped at 3000 events; the oldest are dropped first. Writes are
batched on a two second timer so a busy fight does not thrash the disk.

## What is recorded

### Session

| Event | Properties |
|---|---|
| `session:start` | `returning` |
| `session:end` | `seconds` |
| `heartbeat` | every 60 seconds, so session length survives a crash |

### The loop

| Event | Properties |
|---|---|
| `day:started` | `day` |
| `day:ended` | `reason` (return or death), `day` |
| `player:died` | `day`, `phase`, `campLevel`, `hp` |
| `area:discovered` | `areaId` |

### Progress

| Event | Properties |
|---|---|
| `upgrade:bought` | `id` |
| `perk:bought` | `id` |
| `weapon:found` | `baseId`, `rarity` |
| `cache:opened` | `id`, `rarity` |
| `secret:found` | none |
| `npc:rescued` | `id` |
| `shortcut_built` | none |

### The boss

| Event | Properties |
|---|---|
| `boss:attempted` | `id`. Fires when the player enters the den |
| `boss:defeated` | `id` |

### Design-specific

These exist to test the additions that were not in the original brief.

| Event | What it tells you |
|---|---|
| `perfect_dodge` | Whether anyone is finding the dodge window, and on which day |
| `night_bounty` | Whether anyone takes the night bet, and how much they gather after dark |
| `challenge_completed` | Whether the daily challenge is noticed |
| `achievement` | Which long-term goals actually land |

### Monetization prototype

| Event | Properties |
|---|---|
| `store:opened` | none |
| `store:purchased` | `itemId` |
| `ad:clicked` | `rewardId` |

## Reading it

Three questions the log is built to answer.

**Is the loop the right length?** Count `day:ended` events and divide the session
length. Four to seven days in half an hour is the target. Two means a day takes too
long or the player is lost; twelve means there is not enough in a day.

**Where does it stop being fun?** Find the last `day:started` and look at what happened
between it and `session:end`. If sessions end after a `player:died`, death is too harsh.
If they end after a `day:ended` with reason `return`, the summary is not pointing at
anything worth coming back for.

**Are the new mechanics doing anything?** `perfect_dodge` and `night_bounty` are the two
additions with the highest cost-to-value uncertainty. If either is near zero across
several sessions, it is not earning the code it takes.

## Privacy

There is nothing to protect, because nothing leaves the machine. Should this ever gain
a real analytics backend, the things in this log that would need thought before being
sent are: nothing. Every field is a game state value. There is no identifier, no
timestamp precise enough to fingerprint, no device information and no free text.

Keeping it that way is a design constraint worth carrying forward.
