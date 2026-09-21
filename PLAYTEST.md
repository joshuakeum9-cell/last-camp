# LAST CAMP — playtest

## How to run one

Sit someone down with no explanation beyond "it's a survival game, here are the
controls" and watch for 20 to 30 minutes. Do not help them. Write down the timestamp of
anything you want to ask about afterwards, then ask the questions below.

Before they start, open the developer screen (backtick) and clear the event log so the
session is clean. Afterwards, copy the analytics JSON out and keep it with their
answers.

**The single most important thing to watch for is the moment they put the controller
down.** Note when it happens and what they had just done.

---

## The questions

### Movement and combat

1. Was movement immediately understandable?
2. Did the character feel responsive, or did you ever press something and get nothing?
3. Was combat satisfying?
4. Did hits feel like they connected?
5. Did you use the dash? What for?
6. Did you ever dodge something on purpose and feel good about it?
7. Was there a weapon you preferred? Why?
8. Did any enemy feel unfair? Which, and what happened?
9. Did you know what an enemy was about to do before it did it?

### Gathering and the loop

10. Did collecting resources feel rewarding?
11. Did you understand what each resource was for?
12. Did returning to camp feel rewarding?
13. Did you ever feel unsure what to do next?
14. Did you voluntarily explore optional areas, or only go where you had to?
15. Did you feel nervous about staying out too long?
16. Did you ever decide to grab one more thing and regret it?
17. Did you ever decide to go home early? What made you decide?

### The camp and progression

18. Did you care about upgrading the camp?
19. Which upgrade did you want most?
20. Did the camp look different after you bought something? Did you notice?
21. Was progression too slow?
22. Was progression too fast?
23. Did you ever have resources and nothing worth spending them on?
24. Did you ever want something and have no idea how far away it was?

### Difficulty

25. Was combat too easy?
26. Was combat too hard?
27. Did you die? How did you feel about it?
28. After dying, did you want to go straight back out?
29. Was the cold mechanic fun or annoying?

### Story and curiosity

30. Did you care about the story mystery?
31. Do you have a theory about what happened?
32. Did you read the notes, or skip them?
33. Did you find anything nothing pointed you toward?
34. Did you want to know what was past the locked pass?

### The big ones

35. Did you want to play another day?
36. Would you voluntarily play another 30 minutes right now?
37. What moment was most memorable?
38. What would make you come back tomorrow?
39. If you stopped playing, what were you doing at the time?
40. What is the first thing you would change?

---

## What the answers mean

Some answers point at a specific fix. These are the ones worth pre-committing to, so
that a bad result leads to a change rather than a debate.

| If they say | The problem is | Where to look |
|---|---|---|
| "I pressed attack and nothing happened" | Input buffering or swing recovery | `BAL.inputBufferMs`, weapon `recovery` |
| "Hits felt soft" | The feel package, not the damage | `BAL.combat.hitstopMs`, `shake`, flash |
| "I didn't know what to do next" | The summary is not pointing hard enough | `SummaryScene.buildNextUp` |
| "I never felt like going home" | Night is not threatening or the bounty is invisible | `BAL.day.phases`, the night bounty line |
| "The cold was annoying" | It is a second health bar, not a decision | `BAL.cold.baseRate`, resistance caps |
| "I had nothing to buy" | Invariant 2 in ECONOMY.md is broken | `data/upgrades.ts` costs |
| "The camp didn't change" | Placements are too subtle | `CampSystem.placements` |
| "I didn't read the notes" | They interrupt at a bad moment | When `Dialogue` opens |
| "I didn't want another day" | Stop and fix this before anything else | Everything above |

## Numbers to check afterwards

From the developer screen or the exported JSON:

| Number | Healthy | Worrying |
|---|---|---|
| Days completed in 30 minutes | 4 to 7 | 1 to 2, or 12+ |
| `day:ended` with reason `death` | 1 to 3 in a session | 0, or more than half |
| `perfect_dodge` count | At least a few by day three | Zero all session |
| `night_bounty` events | At least one day where they stayed out | Never |
| `area:discovered` | 4 or more | 2 |
| `upgrade:bought` | At least one per completed day | Long gaps |
| `cache:opened` | Most of the ones they walked past | They walked past glowing chests |
| `store:opened` | Late, or not at all | On day one |
| Session length | Longer than you asked for | Shorter than you asked for |

**The one that matters most is whether they kept playing after you said they could
stop.** Everything else is diagnosis.

## Known things not worth reporting yet

These are already known and do not need to come out of a playtest:

- There is no tutorial. The first day is the tutorial
- The locked pass never opens. That is deliberate
- There is one boss and one survivor
- Sound is synthesised and deliberately minimal
- Nothing here has been balanced against more than a handful of sessions
