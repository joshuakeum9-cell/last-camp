# LAST CAMP — Architecture & Design Blueprint (v1, for approval)

Status: DESIGN ONLY. No code exists yet. This document is the single source of truth the build agent will follow, phase by phase, without re-deciding anything below.

Project root (build target): `C:\Local\Projects\Claude Code\last-camp`

---

## 0. The one-paragraph pitch

A mobile-first 2D pixel survival RPG. Wake in a permanent winter, find a dying campfire, and every day leave camp to explore a compact frozen map, collect five resources, fight five enemy types, and get home before night. At camp, spend what you carried on upgrades that visibly rebuild the camp and make you stronger. Rescue one survivor, find one secret, beat one miniboss and one boss, and read the first clues that the winter is not natural. Target: 15 to 30 minutes of content across roughly 6 to 8 in-game days.

Design law, in priority order: movement feel > combat feel > gathering feel > return feel > visible upgrades > curiosity > time pressure > story > retention extras > store prototype. When two things conflict, the earlier one wins.

---

## 1. Tech stack and project setup

| Concern | Decision |
|---|---|
| Engine | Phaser 3.80+ (Arcade physics, WebGL with Canvas fallback) |
| Language | TypeScript, strict mode |
| Bundler | Vite 5 |
| Save | `localStorage`, single JSON blob, versioned |
| Assets | **Zero external binary assets.** All pixel art and audio is generated at boot from code (see sections 9 and 10) |
| Base resolution | 480x270 logical pixels, `pixelArt: true`, `roundPixels: true`, `Scale.FIT` + `CENTER_BOTH`, landscape |
| Tile size | 16px |
| World size | 100x60 tiles (1600x960px), one map |
| Physics | Arcade, top-down, no gravity, circular bodies for actors |
| Target frame | 60fps on a mid-range phone |

Commands: `npm install`, `npm run dev` (Vite on port 5173), `npm run build`, `npm run preview`.

`.claude/launch.json` will define a `last-camp` dev server so the build agent previews in the in-app browser after every phase.

### 1.1 Folder structure (about 55 files, none over ~350 lines)

```
last-camp/
  index.html                 shell: <div id="game">, viewport meta, rotate-to-landscape overlay
  package.json  vite.config.ts  tsconfig.json
  README.md  GAME_DESIGN.md  ECONOMY.md  MONETIZATION.md  PLAYTEST.md  ANALYTICS.md  NEXT_STEPS.md
  src/
    main.ts                  Phaser.Game config, scene list
    core/
      GameState.ts           the single mutable state object (typed), created once, passed to systems
      EventBus.ts            typed pub/sub (see section 6)
      SaveSystem.ts          serialize/deserialize GameState, versioning, autosave triggers
      InputSystem.ts         keyboard + mouse + touch -> one InputState per frame
      Rng.ts                 seeded RNG (mulberry32) so a day's map is reproducible
      Tween.ts               tiny helpers: flash, shake, punchScale, floatText
    scenes/
      BootScene.ts           builds all textures (PixelFactory) and audio cues, then -> Title
      TitleScene.ts          title, Continue / New Camp, settings
      CampScene.ts           the camp world: fire, tent, stations, Mira, interact prompts
      WorldScene.ts          the expedition map: tilemap, player, enemies, nodes, lighting, weather
      HUDScene.ts            overlay: health, cold, time, weapon, resources, touch controls
      MenuScene.ts           camp panels: Upgrades, Weapons, Inventory, Journal, Map, Store, Achievements, Settings
      SummaryScene.ts        DAY N COMPLETE screen + "what can you upgrade"
      DevScene.ts            hidden: analytics export, cheat toggles
    entities/
      Player.ts              PlayerController: movement, dash, attack state machine
      EnemyBase.ts           shared enemy state machine, hurt/knockback/death, telegraph drawing
      enemies/
        FrostRat.ts  IceWolf.ts  FrozenWalker.ts  SnowSpitter.ts  AlphaBeast.ts
      BossWhiteMaw.ts        BossController: 3 patterns, 2 phases
      Projectile.ts          arrows, spit, icicles
      ResourceNode.ts        tree / wreck / bush / crystal, hit-to-harvest with shake
      Breakable.ts           crates, ice chunks (ADDED, section 4.5)
      Pickup.ts              dropped resource magnetised to player
      Cache.ts               chest with rarity glow
      NPCMira.ts             survivor: field (rescue) and camp (dialogue, assignments)
      Interactable.ts        base for anything with an E prompt
    systems/
      CombatSystem.ts        hitboxes, damage math, crits, hitstop, knockback, hit flash
      WeaponSystem.ts        equipped weapons, swing timing, combos, charged attacks, upgrade tree
      EnemyManager.ts        spawn tables per area/day/time, pack spawning, night variants, culling
      LootSystem.ts          rarity rolls, modifiers, drop tables, cache contents
      ResourceSystem.ts      run inventory vs camp storage, yield multipliers
      InventorySystem.ts     weapons, consumables, quantities, equip
      DayNightSystem.ts      day clock, phases, darkness level, night multipliers
      ColdSystem.ts          cold meter, rates, effects
      MapSystem.ts           areas, gates, unlock state, discovery, shortcut (ADDED)
      CampSystem.ts          camp level from upgrades, visual layout per level
      UpgradeSystem.ts       purchase, affordability, effect application
      StorySystem.ts         notes, journal, discovery flags, Mira lines, morning report (ADDED)
      NPCSystem.ts           Mira rescued flag, assignment
      OfflineSystem.ts       Mira offline gathering with cap
      DailyChallengeSystem.ts rotating local challenge, progress via events
      AchievementSystem.ts   unlock checks via events, cosmetic rewards
      StorePrototype.ts      simulated store + rewarded-ad prototype, dev purchase
      AnalyticsSystem.ts     local event log, export JSON
      AudioManager.ts        cue registry, Web Audio synth, volumes
      Lighting.ts            darkness RenderTexture with light holes
      Weather.ts             snow, wind streaks, fog, storm
      Juice.ts               screen shake, hitstop, flash, floating numbers (respects accessibility)
    ui/
      Panel.ts  Button.ts  Bar.ts  Toast.ts  Dialogue.ts  Tooltip.ts   pixel UI primitives
      TouchControls.ts       joystick + buttons, opacity setting
      MapOverview.ts         camp map panel (ADDED)
    data/
      resources.ts  weapons.ts  enemies.ts  upgrades.ts  perks.ts  areas.ts
      loot.ts  story.ts  challenges.ts  achievements.ts  store.ts  balance.ts
    art/
      PixelFactory.ts        turns pixel-map strings into textures + animations
      palette.ts             the named colour palette (section 8)
      sprites/               player.ts enemies.ts weapons.ts camp.ts tiles.ts fx.ts ui.ts
```

Rule for the build agent: systems are plain TypeScript classes that never touch Phaser display objects. Scenes and entities render and call systems. Systems talk to each other only through `GameState` and `EventBus`. This keeps the code testable and keeps each file small.

---

## 2. Scene flow

```
Boot -> Title -> Camp <-> World -> Summary -> Camp
                  |            (death)  ^
                  +-> Menu (overlay) ---+
HUD runs in parallel over Camp and World.
Dev is opened from Settings (tap version label 7 times) or the backtick key.
```

- **CampScene** and **WorldScene** are separate scenes with separate tilemaps. Camp is a small 30x20 tile map. The camp is also drawn at the west edge of the World map as a visible landmark, but its logic lives in CampScene.
- Leaving camp: walk to the east edge marker and press interact ("Head out. Day 3"). Fade to World at the camp gate.
- Returning: walk into the camp gate zone in World and press interact ("Return to camp"), or die. Both go to Summary, then Camp.
- Sleeping happens implicitly when the summary closes: new day, full heal, cold reset, world regenerated.

---

## 3. Core data: GameState and save schema

One typed object. Everything else reads and writes it. `SaveSystem.save()` writes it to `localStorage["lastcamp.save.v1"]` on: return to camp, death, any purchase, settings change, and every 30s at camp.

```ts
interface GameState {
  version: 1;
  createdAt: number; lastSeenAt: number;
  day: number;                              // 1-based
  camp: {
    upgrades: Record<UpgradeId, number>;    // level owned (0 if none)
    storage: Record<ResourceId, number>;    // banked resources
    level: 1|2|3|4|5;                       // derived, cached for rendering
    shortcutBuilt: boolean;                 // ADDED
  };
  player: {
    perks: Record<PerkId, number>;
    weapons: WeaponInstance[];              // owned, with rarity + modifiers + upgrade path
    equipped: [WeaponInstanceId, WeaponInstanceId | null];
    consumables: Record<ConsumableId, number>;
    cosmetics: { outfit: string; weaponSkin: string; fireColor: string; trail: string };
  };
  run: RunState | null;                     // null at camp; non-null mid-expedition (for crash recovery)
  map: { discoveredAreas: AreaId[]; unlockedGates: GateId[]; secretFound: boolean; cachesOpened: string[] };
  story: { notesFound: NoteId[]; miraRescued: boolean; miraAssignment: 'wood'|'food'|'scrap'|null; miraAssignedAt: number|null };
  bosses: { alphaDefeated: boolean; mawDefeated: boolean; mawAttempts: number };
  challenge: { id: ChallengeId; dayIssued: number; progress: number; claimed: boolean };
  achievements: Record<AchievementId, number|null>;   // unlock timestamp
  stats: { enemiesKilled: Record<EnemyId, number>; resourcesCollected: number; deaths: number; daysSurvived: number; campUpgradesBought: number };
  store: { owned: string[]; simulatedSpend: number; adsUsed: Record<AdRewardId, number> };  // adsUsed keyed by day
  settings: { music: number; sfx: number; shake: number; flashReduction: boolean; largeText: boolean; touchOpacity: number; showTouch: 'auto'|'on'|'off' };
}

interface RunState {
  seed: number; timeSec: number; phase: 'morning'|'midday'|'evening'|'nightfall'|'night';
  hp: number; cold: number;
  collected: Record<ResourceId, number>;    // this expedition only, not yet banked
  kills: number; damageTaken: number; rareFinds: number; newAreas: AreaId[]; notesFound: NoteId[];
  weaponsFound: string[]; wentOutAtNight: boolean; nightCollected: Record<ResourceId, number>; // ADDED
}
```

Migration: `SaveSystem.load()` checks `version`; unknown or corrupt data starts a new camp and keeps a backup copy under `lastcamp.save.backup`.

---

## 4. Gameplay systems in detail

### 4.1 Movement (Player.ts, InputSystem.ts)

- `InputSystem.read()` returns `{ move: {x,y} normalised, attackPressed, attackHeld, dashPressed, interactPressed, swapPressed, aim: {x,y} }` from WASD/arrows, mouse (aim = cursor direction), and touch (aim = joystick direction, or last facing). Attack and dash presses are **buffered for 120ms** so an input during a swing still fires.
- Speed 92 px/s. Acceleration to full speed in 4 frames, stop in 3 frames (Arcade drag), so it feels snappy not floaty.
- 8-direction facing, 4 animation rows (down, up, side + flip). Idle breathes; walk has 4 frames with a small bob; footstep puffs of snow every 2nd frame.
- **Dash**: 48px over 0.15s, invulnerable for the whole dash, 0.8s cooldown (Quick Step perk: 0.6s). Leaves 3 afterimages and a snow burst. Cannot dash through solid walls, can dash through enemies.
- **Perfect dodge (ADDED)**: if the player was inside an enemy hitbox that activated within 100ms of the dash start, trigger a 120ms slow-mo (timeScale 0.3), a white ring flash, refund the dash cooldown, and the next hit within 1s is a guaranteed crit. Cheap to build on top of the i-frame check, huge feel payoff, teaches dodging.
- Camera: follows with lerp 0.12, deadzone 40x24, clamps to world bounds, zoom 1. Slight look-ahead of 12px in facing direction.

### 4.2 Combat (CombatSystem.ts, WeaponSystem.ts)

Attack state machine per weapon: `windup -> active -> recovery`, with combo window during recovery. Hitboxes are short-lived Arcade zones created by WeaponSystem in front of the player, shaped per weapon (arc, thrust, circle). Each hitbox hits each enemy at most once.

Damage pipeline: `base * weaponUpgradeMult * (1 + SharpEdge) * critMult(2.0 if roll < critChance)` then apply modifiers (burning, lifesteal). Damage numbers float up in colour by type: white normal, gold crit, orange burn.

Feel package on every hit (Juice.ts, all respect settings):
- Hitstop 60ms (crit 90ms, kill 110ms) by setting scene and physics `timeScale` to 0.05 then restoring.
- Enemy white flash 80ms via `setTintFill`, plus a 3-frame squash.
- Knockback impulse per weapon, scaled down by enemy mass.
- Camera shake 2px/80ms, crit 4px/120ms, kill of walker or boss hit 6px.
- Weapon trail: 3-point additive polygon sprite fading over 100ms, coloured by weapon.
- Impact spark burst of 4 to 8 particles in weapon colour.
- Combo counter appears at 3+ hits without taking damage; small, top-centre, fades.

Charged attack: hold attack 0.55s (bar fills over the player), release for a heavier swing (x2.5 damage, x1.6 knockback, wider arc). Available on all melee weapons; on bow it fires a piercing arrow.

### 4.3 Weapons (data/weapons.ts)

| Weapon | How obtained | Dmg | Swing | Reach/shape | Knockback | Crit | Special |
|---|---|---|---|---|---|---|---|
| Rusted Axe | start | 12 / 12 / 18 (3-hit combo) | 0.45s | 24px arc 110° | 150 | 5% | Third combo hit stuns 0.3s |
| Hunter Knife | Abandoned Road cache (guaranteed) | 5 | 0.18s | 16px arc 70° | 40 | 30% | Combo of 4, crit sound distinct |
| Scrap Spear | Craft at Workbench (scrap 18) | 9 | 0.35s | 36px thrust, narrow | 130 | 8% | Hits all enemies in the line; back-step 6px on hit |
| Frost Bow | Secret area chest | 8 (arrow) | 0.5s draw | 170px projectile | 30 | 12% | 3 frost charges, one regenerates every 2s; hit slows enemy 35% for 1.5s |
| Survivor Hammer | Mira crafts after boss (needs Maw Fang) | 26 | 0.8s | 30px circle | 230 | 5% | Stun 1.0s; ground shock ring |

Upgrade tree per weapon (at Workbench): `Base -> Reinforced (scrap 15, +20% dmg) -> Branch A or B (scrap 30 + frost crystal 2)`. Branches are data, not code: each branch is a list of stat modifiers plus at most one flagged special.

- Axe: **Heavy** (+35% dmg, stun 0.5s on every hit) or **Scavenger** (nodes break in 1 hit, +30% wood).
- Knife: **Serrated** (bleed 3 dmg/s for 3s) or **Shadow** (crit 45%, crit x2.4).
- Spear: **Pike** (+12px reach, pierce projectiles) or **Guard** (blocks spit while thrusting, +knockback).
- Bow: **Deep Frost** (freeze 0.6s on 3rd consecutive hit) or **Rapid** (5 charges, faster regen).
- Hammer: **Quake** (bigger ring, +knockback) or **Hearth** (lifesteal 10%).

Rarity on found weapons (Common/Uncommon/Rare/Epic) adds 0/1/2/3 random modifiers from: Burning, Keen (+crit), Brutal (+knockback), Vampiric (lifesteal 6%), Warm (+cold resistance), Lucky (+resource drops). Rare and Epic have a glow sprite underneath and a distinct pickup sound.

### 4.4 Enemies (EnemyBase.ts, enemies/*.ts, data/enemies.ts)

Shared state machine: `idle -> alert -> chase -> windup(telegraph) -> attack -> recover -> chase`, plus `hurt` (short, with knockback, interrupts windup only for light enemies) and `dead` (death burst, drop roll, corpse fades). Telegraphs are always both a shape and a colour: a red flash on the sprite plus a ground indicator (line, circle, or exclamation) so the read never depends on colour alone.

| Enemy | HP | Dmg | Speed | Teaches | Behaviour | Drops |
|---|---|---|---|---|---|---|
| Frost Rat | 14 | 6 | 110 | Crowd control, combo | Packs of 3 to 5, 0.3s squeak windup then lunge 20px. Flee briefly at 30% HP | Food 30% |
| Ice Wolf | 40 | 14 | 75 walk, 260 charge | Dodge timing | Circles at 90px, 0.6s crouch (line indicator) then charge; 0.8s recovery is the punish window | Food 40%, Scrap 25% |
| Frozen Walker | 90 | 22 | 35 | Patience, positioning | Shambles, 0.9s overhead windup (circle indicator, 26px), slam. Never interrupted by hits | Scrap 60%, Frost Crystal 15% |
| Snow Spitter | 30 | 8 | 60 | Movement, ranged pressure | Keeps 100px distance, spits every 2s (projectile 120px/s, can be dashed through), retreats when approached | Frost Crystal 20%, Scrap 30% |
| Alpha Beast (miniboss) | 260 | 18 | 70 / 240 | Combine everything | Wolf charge + walker slam + howl (spawns 2 rats, 0.7s telegraph). Guards the Ruined Cabin | Guaranteed: Medical Supplies 2, Frost Crystal 3, unlocks Mira |

Day scaling (data/balance.ts): HP x(1 + 0.08 x (day-1)) capped x1.6; damage +5%/day capped x1.5; pack size +1 every 2 days capped +3; new combinations by day (day 1 rats only in forest, day 2 wolves join, day 3 walkers on the road, day 4 spitters at the lake). Night: damage x1.4, speed x1.15, and the **Night Stalker** wolf variant (white eyes, faster, 1 per night, drops a Rare weapon 25%).

### 4.5 Resource nodes and breakables (ResourceNode.ts, Breakable.ts)

- Nodes: Pine (wood 3 to 5, 3 hits), Wreck (scrap 2 to 4, 3 hits), Berry Bush (food 1 to 2, 1 hit), Crystal Spire (frost crystal 1, 4 hits, rare, glows cyan). Each hit shakes the node, spits 2 to 3 pickups of its colour, and the final hit bursts. Nodes reset every day; placement is seeded by `hash(day, areaId)` so the map feels familiar but not identical.
- Pickups magnetise to the player within 28px and pop into the HUD counter with a scale punch and a rising number.
- **Breakables (ADDED)**: crates and ice chunks scattered in all areas. One hit, small drop (1 resource or nothing, 8% consumable). They exist purely for the every-few-seconds feedback cadence and for hiding the secret entrance.
- Caches: 1 to 3 per area, glow by rarity, contain resources plus a chance at a weapon or consumable (data/loot.ts). Guaranteed caches: Hunter Knife (Road), Frost Bow (Secret), Story notes at fixed spots.

### 4.6 Day cycle (DayNightSystem.ts)

A day is **240 seconds** of expedition time (tunable in balance.ts).

| Phase | Time | Visuals | Effects |
|---|---|---|---|
| Morning | 0 to 80s | Bright, long cyan shadows | Base |
| Midday | 80 to 150s | Full saturation | Base |
| Evening | 150 to 200s | Purple tint ramps, fog thickens | Cold x1.3 |
| Nightfall | 200 to 240s | Darkness overlay ramps to 60%, HUD clock pulses amber, wind sound rises | Cold x1.6, enemies x1.2 damage, "Return soon" toast once |
| Night | 240s+ | Darkness 80%, player light radius only, snow heavier | Cold x2, enemies x1.4 damage and x1.15 speed, Night Stalker spawns, **Night Bounty** active |

**Night Bounty (ADDED)**: any resource collected after nightfall counts x1.5 in the summary, shown as a separate glowing line ("Night bounty +6 scrap"). This turns "just one more node" from a vague feeling into a real, visible bet the player makes on purpose. Night never kills by itself; cold and enemies do.

**Home compass (ADDED)**: from Nightfall onward a small campfire icon on the HUD edge points toward camp, so pressure never becomes confusion.

### 4.7 Cold (ColdSystem.ts)

Meter 0 to 100. Base +0.30/s outdoors, multiplied by the phase multiplier above, x1.5 in exposed areas (Frozen Lake, Boss Den), x1.5 during a storm (days 3+ have a 35% chance; announced in the morning report). Reduces: campfire zone -12/s, inside the Ruined Cabin -4/s, eating food -15, Warm Broth -50 (ADDED consumable, cooked at the Cooking Pot from 2 food). At 70+: frost vignette and a soft heartbeat. At 100: HP -2/s and speed -20% until warmed. Cold resistance from upgrades and perks multiplies the gain rate down, never above 60% total reduction so cold always matters.

### 4.8 Death and return (WorldScene -> SummaryScene)

- Death: freeze frame, desaturate, "You collapse in the snow", then Summary in a "recovered" variant. Lose 50% of `run.collected` (Storage Crate I 25%, II 10%). Keep everything permanent. Day advances. `stats.deaths++`.
- Voluntary return: interact at camp gate. Full `run.collected` banked. **Untouched bonus (ADDED)**: returning with `damageTaken === 0` adds +10% resources and a small badge; feeds the daily challenge and an achievement.
- Summary screen order: title (DAY N COMPLETE or DAY N SURVIVED), resource lines counting up one at a time with pickup sounds, night bounty line, enemies defeated, rare items, new areas, notes found, then a **"What can you upgrade?"** panel listing every upgrade that just became affordable (highlighted gold) and the single nearest one that is not yet affordable with its shortfall ("Cooking Pot: 3 more scrap"). Buttons: Rewarded Ad prototype "Double this haul", Continue.

### 4.9 Camp (CampScene.ts, CampSystem.ts)

Camp level is derived from the number of distinct camp upgrades owned: 0 to 1 = L1, 2 to 4 = L2, 5 to 7 = L3, 8 to 10 = L4, 11+ = L5. Each level swaps the camp layout (data-driven list of sprite placements per level), so buying an upgrade often changes the whole scene when you walk back in, and every upgrade also has its own specific sprite change.

| Level | Look |
|---|---|
| 1 | Tiny fire, torn tent, a log, a crate |
| 2 | Patched tent, workbench, storage crate, small palisade posts |
| 3 | Big fire with stones, weapon rack, cooking pot on tripod, drying rack |
| 4 | Fortified log walls, lanterns on posts, Mira's lean-to, snow cleared paths |
| 5 | Two cabins, watchtower, signal table with a flickering radio, string lights |

Interactables at camp: Fire (warm up, sleep to next day), Workbench (weapons and crafting), Storage (inventory), Notice Board (journal, map, challenge, achievements), Mira (dialogue, assignment, offline collect), Supply Drop crate (store prototype, appears as a parachute crate so it fits the world), Gate (head out).

**Morning report (ADDED)**: when a new day starts, one line above the fire: weather for the day, and one contextual hint drawn from state ("Wolves were howling from the road last night", "Mira says the cabin door was forced from inside"). One line, no dialogue tree, builds anticipation for the day and surfaces the mystery.

### 4.10 Upgrades and perks (data/upgrades.ts, data/perks.ts)

14 camp upgrades + 6 perks. Costs use W wood, S scrap, F food, C frost crystal, M medical supplies.

| # | Upgrade | Cost | Effect | Camp change |
|---|---|---|---|---|
| 1 | Better Fire I | W10 | Cold gain -20% | Fire grows, stone ring |
| 2 | Better Fire II | W25 C1 | Cold gain -35% total, campfire light radius +50% | Tall flames, embers |
| 3 | Stronger Shelter I | W15 S5 | +20 max HP | Tent patched |
| 4 | Stronger Shelter II | W30 S15 | +50 max HP total | Log walls |
| 5 | Workbench | W12 S10 | Unlocks weapon upgrades, spear craft, broth | Bench with tools |
| 6 | Storage Crate I | W10 S8 | Keep 75% on death | Crate |
| 7 | Storage Crate II | W25 S20 | Keep 90% on death | Stacked crates |
| 8 | Cooking Pot | S12 F5 | Food heals 25 not 15, unlocks Warm Broth | Pot on tripod |
| 9 | Scavenger Rack | W20 S10 | +15% resource yield | Drying rack |
| 10 | Medical Table | S20 M1 | Medical supplies heal full and reset cold | Table with bottles |
| 11 | Weapon Rack | W15 S15 | Second weapon slot (swap in the field) | Rack with weapons |
| 12 | Watchtower | W40 S20 | Map overview shows caches and enemy density; HUD shows exact seconds to nightfall | Tower |
| 13 | Ember Lantern | S15 C2, needs Mira | Player carries light at night (radius x2), cold gain -10% | Lanterns on posts |
| 14 | Signal Table | S30 C3, needs Mira + Maw defeated | "Escape progress 1/5" and the MVP's closing story beat | Radio table, flicker |

**Bridge shortcut (ADDED, MapSystem)**: at the Frozen Lake a broken footbridge can be repaired once for W20 from the field, opening a direct path back to camp from the lake and boss den. Cheap, permanent, physical proof that the player has tamed the map.

Perks (bought at the Notice Board, mixed costs, some repeatable): Hearty +10 HP (x3, F6 each), Scavenger +10% resources (S12), Quick Step dash cooldown 0.6s (S10 F4), Sharp Edge +5% damage (x3, S8 each), Lucky Find rare chance +8 points (C2), Thick Coat cold gain -15% (W10 F6).

### 4.11 Map (data/areas.ts, MapSystem.ts)

One tilemap, six areas laid out west to east with soft borders, plus one hidden pocket and one locked pass:

```
[Camp gate] -> Frozen Forest -> Abandoned Road -> Ruined Cabin
                     |                                  |
                     +----------> Frozen Lake <---------+
                                    |     \
                              Boss Den    (Cracked Ice -> Secret Hollow)
                                    |
                          Signal Tower Pass [LOCKED: "The way is blocked by a wall of blue ice. It hums."]
```

- Forest: pines, rats, day-2 wolves. First cache. Note 1 (a frozen ranger's log).
- Road: wrecked cars (scrap), wolves, walkers from day 3. Hunter Knife cache. Note 2 (radio log).
- Cabin: interior is a shelter (cold drops). Alpha Beast guards it. Mira inside. Note 3.
- Lake: exposed (cold x1.5), spitters, crystal spires, broken bridge. Note 4 on a frozen tent.
- Boss Den: north of the lake, gated by a snowbank that needs 3 hits with any weapon (makes entering a choice). The White Maw.
- Secret Hollow: a cracked-ice patch at the lake's east side, marked only by a visual (darker, glossier tiles and a faint cyan pulse). Breaking the ice chunk next to it opens a tunnel. Inside: Frost Bow cache, Note 5 (the strangest one), a cosmetic (Frost-white outfit).
- Signal Tower Pass: visible tower silhouette on the horizon parallax, locked gate with a message. Signal Table upgrade text refers to it.

Areas are rectangles in tile space with an `unlocks` list; entering one for the first time fires `area:discovered`, shows a banner ("FROZEN LAKE") and logs analytics. The **Map overview (ADDED)** at the Notice Board draws a hand-styled pixel map with undiscovered areas fogged and question marks on unopened caches (with Watchtower).

### 4.12 Boss: The White Maw (BossWhiteMaw.ts)

600 HP, arena 24x16 tiles, entry seals with ice until victory or death. Music switches to the boss cue.

| Pattern | Telegraph | Attack | Punish window |
|---|---|---|---|
| Charge | 0.8s rear-up + ground line indicator + roar cue | Charges the line at 300px/s, slams the arena wall, stunned 1.2s | The wall stun |
| Ice Slam | 1.0s raised paws + expanding ring outline (radius 40) | Ring hits at the outline; inside the centre is unsafe, outside is safe | 0.7s recovery |
| Blizzard Howl | 0.7s howl + 4 ground markers appear | Spawns 3 rats and after 1.2s icicles fall on the markers (hazard) | While rats are alive Maw paces slowly: free hits if you manage the rats |

Phase 2 at 50% HP: brief roar, telegraphs x0.8 duration, Charge becomes a double charge. No new HP. Reward: Maw Fang (hammer component), S40 C5 M2, permanent camp upgrade "Trophy" (cosmetic skull over the gate, +5% damage), Note 6 (the reveal tease). Analytics: `boss:attempted`, `boss:defeated`, attempts counter.

### 4.13 Story (data/story.ts, StorySystem.ts)

Six notes plus Mira's lines. Each note is 2 to 4 short sentences. Arc: ranger logs the first snowfall that never stopped, radio log mentions "the tower test", the cabin note describes people leaving toward the tower and not returning, the lake note finds the crystals growing where the ice is thinnest, the secret note is a page of instrument readings where the cold is strongest around the tower, and the Maw note (found in its den) is a collar tag: the beast was tagged by the tower crew. The Signal Table simply says the tower is answering. Nothing is explained. Journal at the Notice Board shows "Notes 3/6" which is itself a retention hook.

Mira: found bound in the cabin after the Alpha Beast. Three lines on rescue, one greeting per camp level, one line per assignment, one after the boss. All in data.

### 4.14 Offline, challenge, achievements, store, analytics

- **Offline**: Mira assignment yields 1 unit per 10 minutes of real time, cap 6 units (1 hour), collected on the next camp load with a toast. Timestamps in save.
- **Daily challenge**: rotating list of 8 (Defeat 10 enemies, Collect 20 wood, Defeat 3 wolves, Return untouched, Open a rare cache, Collect 5 food, Break 15 objects, Survive until nightfall). Issued per in-game day, progress via EventBus, reward a small bundle. Missing one has no penalty. Architecture leaves a `source: 'local' | 'remote'` field so a future server can inject challenges.
- **Achievements**: First Night, Scavenger (100 resources), Pack Hunter (10 wolves), Prepared (5 camp upgrades), Untouched, Curious (secret found), Nightwalker (return after night), The White Maw. Rewards are cosmetics: titles on the title screen, a camp banner, outfit tints, weapon skin tints.
- **Store prototype**: Supply Drop crate at camp. Tabs: Cosmetics (outfits, weapon skins, campfire colours, snow trails, attack effect tints), Resource Packs, Starter Pack (Warm Survivor Jacket cosmetic + S20 W20 + Ember campfire colour). Every item has a "DEV: simulate purchase" button; nothing else. Spend is tracked in save as `simulatedSpend`.
- **Rewarded ad prototype**: three clearly labelled buttons, never automatic: Summary "Double this haul" (once per day), Death "Get up (revive at 50% HP)" (once per day), Camp "Small supply bundle" (once per real day). A 3s fake "AD PLAYING" overlay with a skip after 1s, then the reward. Analytics logs every click.
- **Analytics**: `AnalyticsSystem.track(name, props)` appends `{t, day, name, props}` to `localStorage["lastcamp.analytics"]`, capped at 3000 events (oldest dropped). Session duration is derived from `session:start` and a heartbeat every 60s. DevScene shows counts and a "Copy JSON" and "Download JSON" button. Event names are the list in the brief plus `perfect_dodge`, `night_bounty`, `shortcut_built`, `challenge_completed`.

---

## 5. HUD and UI (HUDScene.ts, MenuScene.ts, ui/*)

Expedition HUD, top-left cluster: Health bar (red, with white damage-lag ghost), Cold bar (cyan, frost icon that shakes at 70+). Top-centre: day clock as a sun/moon arc with the phase name, seconds only with Watchtower. Top-right: five resource counters, appear only once the player owns any of that resource. Bottom-right (desktop): weapon icon with combo pips and charge bar. Home compass on the screen edge from Nightfall. Toasts bottom-centre. Floating damage numbers in world space.

Camp UI is a single MenuScene with tabs; each panel is a `Panel` with a list of `Button` rows showing name, cost chips (greyed if short), effect line, and an "owned" check. Newly affordable rows pulse gold. Large-text setting scales the UI font from 8px to 11px bitmap. All pixel UI is drawn from generated 9-slice textures.

Touch layout (only when touch is detected or forced in settings): joystick anchored bottom-left 22% of width, deadzone 12%, follows first touch in the left 45% of the screen. Attack button 56px bottom-right, Dash 40px above-left of it, Weapon swap 32px above Dash (only if two weapons), Interact appears as a 40px button above Attack only when an interactable is in range. Opacity from settings. Nothing in the top third of the screen.

---

## 6. EventBus contract

Typed map so a wrong event name is a compile error. Core events:

```
player:hit         {damage, source}          player:died          {}
player:dash        {perfect: boolean}        player:heal          {amount, source}
enemy:hit          {id, damage, crit, kill}  enemy:killed         {id, type, pos, night}
resource:collected {id, amount, night}       node:broken          {kind}   breakable:broken {}
cache:opened       {rarity, contents}        weapon:found         {instance}
area:discovered    {areaId}                  secret:found         {}
day:started        {day}  day:phase {phase}  day:ended            {reason:'return'|'death', run}
cold:threshold     {level: 70|100}
camp:upgrade       {id, level}  perk:bought  {id}  weapon:upgraded {id, branch}
npc:rescued        {id}  npc:assigned {job}  offline:collected   {job, amount}
boss:attempted     {id}  boss:defeated {id}
challenge:progress {id, progress, done}      achievement:unlocked {id}
store:opened       {}  store:purchased {itemId}  ad:clicked {rewardId}
juice:shake {intensity, ms}  juice:hitstop {ms}  juice:flash {}
audio:play {cue, opts}
```

InputSystem is polled each frame, not evented. Systems subscribe in their constructor and unsubscribe on scene shutdown to avoid leaks.

---

## 7. Balance and pacing targets (data/balance.ts)

Everything numeric lives in `balance.ts` so tuning never touches logic. Target pacing for a first-time player:

| Day | What should happen | Approx. haul (W/S/F) | Expected purchases |
|---|---|---|---|
| 1 | Forest only, rats, first cache, note 1, back before night | 14 / 6 / 4 | Better Fire I, then Shelter I or Workbench next day |
| 2 | Wolves appear, reach the Road, Hunter Knife | 18 / 14 / 5 | Workbench, Storage I |
| 3 | Walkers, possibly a storm, reach the Cabin door, Alpha Beast likely too hard yet | 20 / 18 / 6 | Cooking Pot, Spear craft, Reinforced weapon |
| 4 | Beat Alpha, rescue Mira, cabin as shelter, first night bounty | 22 / 20 / 6, C2 M2 | Shelter II, Scavenger Rack |
| 5 | Lake, spitters, bridge, secret hollow, Frost Bow | 24 / 22 / 6, C4 | Weapon Rack, Ember Lantern, a branch upgrade |
| 6 to 8 | Boss attempts, Signal Table, closing beat | | Watchtower, Signal Table |

Rules of thumb the build agent must hold: the first upgrade is affordable after day 1 no matter what; something new is always affordable after every returned day up to day 6; no enemy takes more than 8 hits with the weapon the player is expected to have on that day; time-to-kill a rat with the starting axe is 2 hits.

---

## 8. Visual direction, technically

- Palette (art/palette.ts), roughly 32 named colours. Cold set: `navy #0b1030`, `deep #16205a`, `blue #2a4bd7`, `ice #4fd3ff`, `cyan #8ff7ff`, `white #f4fbff`, `violet #7c3aed`, `magenta #c026d3`. Warm set: `ember #ff4d1c`, `orange #ff8c1a`, `gold #ffc93c`, `cream #fff1c2`, `wood #8b4a1f`. Rarity: common white, uncommon `#4ade80`, rare `#38bdf8`, epic `#c084fc`.
- Camp scene uses a warm ambient overlay (multiply `#ffb070` at 15%) and a big additive fire glow; World uses a cool ambient overlay that deepens with the phase. The transition between them is a 400ms colour fade, so "coming home" is literally a change of temperature on screen.
- Lighting.ts: one full-screen `RenderTexture` filled with the darkness colour at the current alpha; light sources erase soft radial gradients (campfire, lanterns, player at night, crystal spires, rare loot). Works in Canvas and WebGL, no Light2D pipeline dependency.
- Weather.ts: three particle emitters (near snow large and fast, far snow small and slow, wind streaks horizontal), a scrolling two-layer fog texture at 25% alpha in Evening+ and inside the lake, and a storm mode that doubles snow and adds screen-edge gusts.
- Enemy silhouettes are designed at readable sizes: rat 12x8, wolf 24x14, walker 18x28, spitter 16x16, alpha 40x28, Maw 64x48. Player 16x22. Enemies each have one signature colour on their body (rat pink eyes, wolf cyan eyes, walker violet cracks, spitter green sac) that also drives their hit particles.
- Parallax horizon at the top of the World map: a far ridge line and the Signal Tower silhouette with a slow red blink, always visible from the lake and the road.

---

## 9. Art pipeline: PixelFactory

No PNG files. Every sprite is a TypeScript object:

```ts
export const frostRat: PixelSprite = {
  key: 'rat', fps: 8,
  palette: { '.': null, 'g': 'grey', 'p': 'pink', 'w': 'white' },
  anims: {
    idle: [ ['..gggg......', '.gpggggg....', ...], ... ],
    run:  [ ... ], hurt: [ ... ], die: [ ... ]
  }
};
```

`PixelFactory.build(scene, sprite)` rasterises every frame into a canvas, adds it as a texture frame, and registers the animations. Tiles use small generators (snow with 3 noise variants, ice with glossy streaks, dirt road, pine, rock, water cracks). 9-slice UI panels and bars are generated the same way. Benefits: fully saturated colours chosen in code, crisp scaling, the agent can iterate on a sprite by editing text, and the build has no asset pipeline to break. Swapping to hand-drawn PNGs later means replacing one factory call per sprite.

---

## 10. Audio pipeline: synthesised cues

AudioManager owns one `AudioContext` (created on first user input to satisfy autoplay rules) and a cue registry. Each cue is a tiny function of oscillators, noise buffers and envelopes: footstep (filtered noise tick), axe hit (low sine thump + noise), knife (short high click), crit (two-note chirp), pickup (rising blip, pitch increases with consecutive pickups within 1s), rare loot (arpeggio + shimmer), enemy hurt/death per type, telegraph roar, wind (looping filtered noise with slow LFO, gain follows phase), campfire crackle (random noise pops, only at camp), upgrade (warm chord), night (low pad), boss music (a 4-bar looping bass + arpeggio pattern at 110 bpm). Music and SFX have separate gain nodes bound to settings. Because everything is generated, the audio is original by construction; a future pass can replace any cue with a licensed file under the same name.

---

## 11. Accessibility and settings

Music volume, SFX volume, screen shake 0 to 100%, flash reduction (replaces white tint flashes with outline pulses, disables slow-mo flash), large text, touch opacity, touch controls auto/on/off, and a "show telegraphs longer" toggle (+30% telegraph time, tuned for readability not difficulty). Every state (low health, cold, telegraph, rarity) has a shape or motion cue in addition to colour.

---

## 12. Mobile specifics

- Landscape enforced by an HTML overlay in portrait ("Rotate your phone").
- `Scale.FIT` at 480x270 keeps pixels integer-scaled on most phones; a 2x DPR canvas is used so pixel edges stay crisp.
- Touch input goes through Phaser's pointer events; the joystick handles multi-touch so attack and move work together.
- Performance guards: object pools for pickups, particles, damage numbers, hitboxes and projectiles; enemies beyond 400px from the player sleep; the darkness RenderTexture updates at 30fps; max 40 active enemies.
- The game persists `run` mid-expedition every 10s so a backgrounded tab resumes at the same spot.

---

## 13. Build phases and gates (the build agent follows these exactly)

Each phase ends with: `npm run dev` running, the in-app browser preview opened, a screenshot, console clean, and a one-paragraph report. No phase starts until the previous gate passes.

| Phase | Build | Gate (must be true) |
|---|---|---|
| 1 Foundation | Vite+Phaser+TS project, PixelFactory, palette, Boot/Title/Camp/World/HUD scenes, tilemap with all six areas as coloured regions, player movement, dash, camera, snow, InputSystem with keyboard | Player moves and dashes crisply at 60fps, camp and world both load, transition works |
| 2 Combat | Rusted Axe with combo + charge, CombatSystem, Juice, Frost Rat with pack AI, telegraphs, hit feedback, death burst, perfect dodge | Killing 5 rats feels good in a blind test: hitstop, shake, flash, knockback all visible |
| 3 Loop | Resource nodes, breakables, pickups, ResourceSystem, InventorySystem, day clock (no night effects yet), return at gate, SummaryScene, SaveSystem, death | Explore, collect, return, see summary, reload page and still have it |
| 4 Camp | UpgradeSystem with all 14 upgrades and 6 perks, MenuScene panels, CampSystem levels 1 to 5 with visible changes, warm/cold colour transition, campfire glow | Buying Better Fire visibly changes the camp; summary highlights affordability |
| 5 World | Remaining enemies, wolves through Alpha Beast, all weapons and upgrade tree, LootSystem with rarity, DayNight full effects, Lighting, ColdSystem, Weather with storms, Night Stalker, night bounty, home compass, bridge shortcut | Day 3 feels tense; each weapon feels different; night is scary but survivable |
| 6 Story | Mira (rescue, camp, dialogue), notes and journal, morning report, secret hollow, Frost Bow, White Maw with three patterns and two phases, Signal Tower Pass lock, map overview | Boss beatable in 2 to 4 attempts by the designer; secret findable without hints |
| 7 Meta | Daily challenge, offline, achievements with cosmetics, store prototype, ad prototype, AnalyticsSystem, DevScene export | All events appear in the export after one full day |
| 8 Ship | TouchControls, settings and accessibility, pooling and performance pass, polish pass on every "feel" item in section 4.2, all seven markdown deliverables | Plays cleanly at 375x667 emulated touch; 60fps with 30 enemies; docs complete |

Recommended build prompt for the Opus session, verbatim: "Read `ARCHITECTURE.md` fully. Build Phase N only. Follow the file layout, data shapes and numbers in the document; put tunables in `balance.ts`. Run the dev server in the in-app browser, verify the phase gate, screenshot it, and stop with a short report." Then repeat for N+1.

A `CLAUDE.md` in the project root will restate: read ARCHITECTURE.md first, never add a system that is not in it without asking, systems never touch display objects, keep files under 350 lines, no external assets, no em dashes in player-facing text.

---

## 14. Additions I made beyond the brief (strike any you dislike)

1. **Perfect dodge** with slow-mo, cooldown refund and guaranteed crit. Cheapest big feel win in the design.
2. **Night Bounty** x1.5 on resources gathered after nightfall, shown as its own summary line. Makes the push-your-luck decision explicit.
3. **Home compass** from nightfall so pressure never becomes confusion.
4. **Untouched bonus** on a no-damage return, tied to a challenge and an achievement (mastery hook).
5. **Breakables** (crates, ice chunks) for the every-few-seconds feedback cadence and to hide the secret entrance.
6. **Morning report** at the fire: weather plus one contextual line, giving each day a hook before you leave.
7. **Bridge shortcut** repairable for wood at the lake: a physical, permanent mark of progress on the map.
8. **Map overview** at the notice board with fog and question marks (Watchtower reveals caches).
9. **Warm Broth** consumable from the Cooking Pot so the cold meter has a player-made answer, not only food.
10. **Night Stalker** wolf variant as the rare night enemy with a rare weapon chance.
11. **Trophy** cosmetic camp upgrade from the boss so the camp records the win.

None of these add a new resource, a new scene, or a new currency.

---

## 15. Decisions I need you to approve

1. **Code-generated pixel art and audio, zero external files** (sections 9 and 10). This is what makes the project buildable by an agent end to end and keeps it crisp and saturated. Alternative is sourcing CC0 packs, which risks a mixed look. Recommendation: approve.
2. **Landscape only, 480x270 base** with joystick left and buttons right. Portrait would need a different HUD and combat camera. Recommendation: approve landscape.
3. **240-second days** and the 6 to 8 day pacing table. Tunable later in one file.
4. **Frost Bow charges** instead of arrows as a resource, to avoid a sixth currency. Recommendation: approve.
5. **The eleven additions** in section 14.
6. **Project location** `C:\Local\Projects\Claude Code\last-camp`, and whether to `git init` at Phase 1.

Reply with approvals or edits and the Opus build session starts at Phase 1.
