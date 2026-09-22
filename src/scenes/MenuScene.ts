import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { state } from '../core/GameState';
import { SaveSystem } from '../core/SaveSystem';
import { bus } from '../core/EventBus';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { WeaponSystem } from '../systems/WeaponSystem';
import { CampSystem } from '../systems/CampSystem';
import { UPGRADES } from '../data/upgrades';
import { PERKS, PERK_LIST } from '../data/perks';
import { RESOURCES, RESOURCE_IDS, CONSUMABLES, type ResourceId } from '../data/resources';
import { BRANCHES, REINFORCE_COST, WEAPONS, type WeaponId, CHARGED_MOVE } from '../data/weapons';
import { RowList, type RowSpec } from '../ui/Panel';
import { makeFrame } from '../ui/Frame';
import { FocusNav, type Focusable } from '../ui/Focus';
import { Button } from '../ui/Button';
import { FONT } from '../art/PixelFont';
import { hex, PAL } from '../art/palette';
import { StorePrototype } from '../systems/StorePrototype';
import { OfflineSystem } from '../systems/OfflineSystem';
import { dailyChallenge } from '../systems/DailyChallengeSystem';
import { ACHIEVEMENT_LIST, TITLES } from '../data/achievements';
import { RESOURCE_ICON } from '../art/sprites/icons';
import { ENEMIES, ENEMY_IDS } from '../data/enemies';
import { WINTER_MODS, WINTER_MOD_IDS, WINTER_UNLOCK_DAY, winterLootMult, winterUnlocked } from '../data/winter';
import { ENEMY_SPRITE_KEY } from '../art/sprites/enemies';
import { CAMP_KEYS, campfireSprite } from '../art/sprites/camp';
import { WEAPON_ICON_KEY } from '../art/sprites/weapons';

/** Which picture stands for each camp upgrade in the list. */
const UPGRADE_ICON: Record<string, string> = {
  fire1: campfireSprite.key,
  fire2: campfireSprite.key,
  shelter1: CAMP_KEYS.tentPatched,
  shelter2: CAMP_KEYS.cabin,
  workbench: CAMP_KEYS.workbench,
  storage1: CAMP_KEYS.crateStack,
  storage2: CAMP_KEYS.crateStack,
  cookpot: CAMP_KEYS.cookingPot,
  scavrack: CAMP_KEYS.dryingRack,
  medtable: CAMP_KEYS.medicalTable,
  weaponrack: CAMP_KEYS.weaponRack,
  watchtower: CAMP_KEYS.watchtower,
  lantern: CAMP_KEYS.lanternPost,
  signaltable: CAMP_KEYS.signalTable,
  trophy: CAMP_KEYS.trophy,
};
const BOSS_SPRITE_KEY: Record<string, string> = { maw: 'boss-maw', stag: 'boss-stag', ranger: 'boss-ranger' };

type Tab = 'camp' | 'survivor' | 'weapons' | 'inventory' | 'goals' | 'beasts' | 'store';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'camp', label: 'CAMP' },
  { id: 'survivor', label: 'SURVIVOR' },
  { id: 'weapons', label: 'WEAPONS' },
  { id: 'inventory', label: 'SUPPLIES' },
  { id: 'goals', label: 'GOALS' },
  { id: 'beasts', label: 'BEASTS' },
  { id: 'store', label: 'DROP' },
];

/**
 * The camp menu. One screen, four tabs, and every row states its cost and its effect
 * in plain words. It opens over the camp so the player can see what their money buys.
 */
export class MenuScene extends Phaser.Scene {
  private tab: Tab = 'camp';
  private list!: RowList;
  private tabButtons: Button[] = [];
  private nav?: FocusNav;
  private resourceLabels = new Map<ResourceId, Phaser.GameObjects.BitmapText>();
  private subtitle!: Phaser.GameObjects.BitmapText;
  private titleLabel!: Phaser.GameObjects.BitmapText;
  private openTab: Tab = 'camp';

  constructor() {
    super('Menu');
  }

  init(data: { tab?: Tab }): void {
    this.openTab = data?.tab ?? 'camp';
  }

  create(): void {
    const { width, height } = BAL.view;
    this.tab = this.openTab;

    this.add.rectangle(0, 0, width, height, hex(PAL.black)).setOrigin(0).setAlpha(0.88);
    makeFrame(this, 10, 8, width - 20, height - 16, { edge: PAL.gold, alpha: 0.97 });

    this.add.bitmapText(18, 14, FONT, 'THE LAST CAMP').setScale(1.5).setTint(hex(PAL.gold));
    this.subtitle = this.add
      .bitmapText(18, 28, FONT, CampSystem.description())
      .setTint(hex(PAL.grey));
    // The worn title sits opposite the camp's description, in gold, so a reward
    // earned hours ago is still on screen.
    this.titleLabel = this.add
      .bitmapText(width - 18, 28, FONT, wornTitle())
      .setOrigin(1, 0)
      .setTint(hex(PAL.gold));

    this.buildResourceBar();
    this.buildTabs();

    this.list = new RowList(this, 18, 58, width - 36, height - 82);
    this.refresh();
    this.bindNav();

    new Button(
      this,
      width - 60,
      height - 22,
      { width: 46, height: 14, text: 'CLOSE', fill: PAL.rust, border: PAL.gold, textColor: PAL.cream },
      () => this.close(),
    );

    new Button(
      this,
      width - 118,
      height - 22,
      { width: 52, height: 14, text: 'OPTIONS', fill: PAL.deep, border: PAL.uiDim, textColor: PAL.uiDim },
      () => {
        this.scene.stop();
        this.scene.launch('Settings', { returnTo: 'Camp' });
        this.scene.bringToTop('Settings');
      },
    );

    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.input.keyboard?.on('keydown-TAB', () => this.cycleTab());
  }

  private buildResourceBar(): void {
    const { width } = BAL.view;
    let x = width - 22;
    for (const id of [...RESOURCE_IDS].reverse()) {
      const label = this.add
        .bitmapText(x, 15, FONT, '0')
        .setOrigin(1, 0)
        .setTint(hex(RESOURCES[id].color));
      this.resourceLabels.set(id, label);
      this.add.image(x + 14, 12, RESOURCE_ICON[id]).setOrigin(1, 0);
      x -= 46;
    }
  }

  private buildTabs(): void {
    let x = 14;
    for (const t of TABS) {
      const btn = new Button(
        this,
        x,
        40,
        {
          width: 60,
          height: 14,
          text: t.label,
          fill: this.tab === t.id ? PAL.blueDark : PAL.deep,
          border: this.tab === t.id ? PAL.cyan : PAL.uiDim,
          textColor: this.tab === t.id ? PAL.white : PAL.grey,
        },
        () => {
          this.tab = t.id;
          this.scene.restart({ tab: t.id });
        },
      );
      this.tabButtons.push(btn);
      x += 65;
    }
  }

  /**
   * Up and down walk the rows, Enter presses one, left and right (or the bumpers)
   * change tab, Escape or B closes. Rows are wrapped as focusables over the list.
   */
  private bindNav(): void {
    const items: Focusable[] = [];
    for (let i = 0; i < this.list.count; i++) {
      items.push({
        setFocused: (on) => {
          if (on) this.list.focusRow(i);
        },
        activate: () => {
          this.list.activateRow(i);
        },
      });
    }
    this.nav = new FocusNav(this, items, {
      onLeft: () => this.cycleTab(-1),
      onRight: () => this.cycleTab(1),
      onBack: () => this.close(),
      wrap: true,
    });
  }

  update(): void {
    this.nav?.update();
  }

  private cycleTab(dir = 1): void {
    const i = TABS.findIndex((t) => t.id === this.tab);
    const next = TABS[(i + dir + TABS.length) % TABS.length];
    this.tab = next.id;
    this.scene.restart({ tab: next.id });
  }

  // --- content -----------------------------------------------------------

  private refresh(): void {
    for (const [id, label] of this.resourceLabels) {
      label.setText(String(state.camp.storage[id] ?? 0));
    }
    this.subtitle.setText(CampSystem.description());
    this.titleLabel.setText(wornTitle());

    switch (this.tab) {
      case 'camp':
        this.list.setRows(this.campRows());
        break;
      case 'survivor':
        this.list.setRows(this.survivorRows());
        break;
      case 'weapons':
        this.list.setRows(this.weaponRows());
        break;
      case 'inventory':
        this.list.setRows(this.inventoryRows());
        break;
      case 'beasts':
        this.list.setRows(this.bestiaryRows());
        break;
      case 'goals':
        this.list.setRows(this.goalRows());
        break;
      case 'store':
        StorePrototype.open();
        this.list.setRows(this.storeRows());
        break;
    }
  }

  private campRows(): RowSpec[] {
    return UpgradeSystem.visible().map((status) => {
      const def = UPGRADES[status.id];
      return {
        title: def.name,
        effect: status.owned ? def.campChange : def.effect,
        cost: costLabel(def.cost),
        costItems: def.cost,
        icon: { key: UPGRADE_ICON[def.id] ?? CAMP_KEYS.crateStack },
        blockedBy: status.owned ? null : status.blockedBy,
        state: status.owned ? 'owned' : status.reason === 'affordable' ? 'affordable' : 'blocked',
        onClick:
          status.reason === 'affordable'
            ? () => {
                if (UpgradeSystem.buy(status.id)) {
                  bus.emit('juice:toast', { text: `${def.name} built.`, color: '#ffcf1f' });
                  SaveSystem.save();
                  this.refresh();
                }
              }
            : undefined,
      } satisfies RowSpec;
    });
  }

  private survivorRows(): RowSpec[] {
    const rows: RowSpec[] = [...this.titleRows()];
    rows.push(...this.perkRows());
    return rows;
  }

  /**
   * Titles earned from achievements. One is worn at a time; clicking swaps to it,
   * and clicking the one already worn takes it off.
   */
  private titleRows(): RowSpec[] {
    const earned = Object.keys(TITLES).filter((t) => t !== 'none' && state.store.owned.includes(t));
    if (earned.length === 0) {
      return [
        {
          title: 'No titles yet',
          effect: 'Achievements give titles. The one you wear shows under the camp name.',
          cost: '',
          state: 'blocked',
        },
      ];
    }

    return earned.map((value) => {
      const worn = state.player.cosmetics.title === value;
      return {
        title: `Title: ${TITLES[value]}`,
        effect: worn ? 'Worn. Click to take it off.' : 'Wear this one.',
        cost: '',
        ownedLabel: 'WORN',
        state: worn ? 'owned' : 'affordable',
        onClick: () => {
          state.player.cosmetics.title = worn ? 'none' : value;
          SaveSystem.save();
          this.refresh();
        },
      } satisfies RowSpec;
    });
  }

  private perkRows(): RowSpec[] {
    return PERK_LIST.map((perk) => {
      const level = UpgradeSystem.perkLevel(perk.id);
      const maxed = level >= perk.maxLevel;
      const can = UpgradeSystem.canBuyPerk(perk.id);
      return {
        title: perk.maxLevel > 1 ? `${perk.name}  ${level}/${perk.maxLevel}` : perk.name,
        effect: perk.desc,
        cost: maxed ? '' : costLabel(perk.cost),
        costItems: maxed ? undefined : perk.cost,
        blockedBy: maxed || can ? null : ResourceSystem.shortfall(perk.cost),
        state: maxed ? 'owned' : can ? 'affordable' : 'blocked',
        onClick: can
          ? () => {
              if (UpgradeSystem.buyPerk(perk.id)) {
                bus.emit('juice:toast', { text: `${PERKS[perk.id].name}.`, color: '#3ff07f' });
                SaveSystem.save();
                this.refresh();
              }
            }
          : undefined,
      } satisfies RowSpec;
    });
  }

  private weaponRows(): RowSpec[] {
    const hasBench = ResourceSystem.campEffects().unlocks.has('workbench');
    if (!hasBench) {
      return [
        {
          title: 'No workbench',
          effect: 'Build the Workbench at camp to work on your weapons.',
          cost: '',
          state: 'blocked',
        },
      ];
    }

    const rows: RowSpec[] = [];
    for (const instance of state.player.weapons) {
      const resolved = WeaponSystem.resolve(instance);
      const equipped = state.player.equipped.includes(instance.uid);

      const stats = `${resolved.damage[0]} dmg / ${resolved.reach} reach. `;
      const move = CHARGED_MOVE[instance.base];
      rows.push({
        title: move ? `${resolved.name}   hold: ${move.name}` : resolved.name,
        effect: stats + resolved.def.desc,
        cost: '',
        ownedLabel: 'CARRIED',
        icon: { key: WEAPON_ICON_KEY[instance.base] ?? WEAPON_ICON_KEY.axe },
        state: equipped ? 'owned' : 'affordable',
        onClick: equipped
          ? undefined
          : () => {
              // Goes into whichever slot is active, so the hotbar shows the change.
              state.player.equipped[state.player.activeSlot ?? 0] = instance.uid;
              SaveSystem.save();
              this.refresh();
            },
      });

      if (instance.tier === 0) {
        const can = ResourceSystem.canAfford(REINFORCE_COST);
        rows.push({
          title: `  Reinforce ${resolved.def.name}`,
          effect: 'Stronger in every way. Opens the two paths beyond it.',
          cost: costLabel(REINFORCE_COST),
          costItems: REINFORCE_COST,
          blockedBy: can ? null : ResourceSystem.shortfall(REINFORCE_COST),
          state: can ? 'affordable' : 'blocked',
          onClick: can
            ? () => {
                if (!ResourceSystem.spend(REINFORCE_COST)) return;
                instance.tier = 1;
                bus.emit('weapon:upgraded', { instanceId: instance.uid, branch: 'reinforced' });
                bus.emit('audio:play', { cue: 'upgrade' });
                SaveSystem.save();
                this.refresh();
              }
            : undefined,
        });
      } else if (instance.tier === 1) {
        for (const branch of BRANCHES[instance.base as WeaponId]) {
          const can = ResourceSystem.canAfford(branch.cost);
          rows.push({
            title: `  ${branch.name}`,
            effect: branch.desc,
            cost: costLabel(branch.cost),
            costItems: branch.cost,
            blockedBy: can ? null : ResourceSystem.shortfall(branch.cost),
            state: can ? 'affordable' : 'blocked',
            onClick: can
              ? () => {
                  if (!ResourceSystem.spend(branch.cost)) return;
                  instance.tier = 2;
                  instance.branch = branch.id;
                  bus.emit('weapon:upgraded', { instanceId: instance.uid, branch: branch.id });
                  bus.emit('audio:play', { cue: 'upgrade' });
                  SaveSystem.save();
                  this.refresh();
                }
              : undefined,
          });
        }
      }
    }

    // Crafting the spear is the one weapon you make rather than find.
    const hasSpear = state.player.weapons.some((w) => w.base === 'spear');
    if (!hasSpear) {
      const cost = WEAPONS.spear.craftCost ?? {};
      const can = ResourceSystem.canAfford(cost);
      rows.push({
        title: `Craft ${WEAPONS.spear.name}`,
        effect: WEAPONS.spear.desc,
        cost: costLabel(cost),
        costItems: cost,
        blockedBy: can ? null : ResourceSystem.shortfall(cost),
        state: can ? 'affordable' : 'blocked',
        onClick: can
          ? () => {
              if (!ResourceSystem.spend(cost)) return;
              state.player.weapons.push({
                uid: `w-spear-${Date.now().toString(36)}`,
                base: 'spear',
                rarity: 'common',
                mods: [],
                tier: 0,
                branch: null,
              });
              bus.emit('audio:play', { cue: 'upgrade' });
              bus.emit('juice:toast', { text: 'Scrap Spear made.', color: '#ffcf1f' });
              SaveSystem.save();
              this.refresh();
            }
          : undefined,
      });
    }

    return rows;
  }

  private inventoryRows(): RowSpec[] {
    const rows: RowSpec[] = RESOURCE_IDS.map((id) => ({
      title: `${RESOURCES[id].name}  x${state.camp.storage[id] ?? 0}`,
      effect: RESOURCES[id].use,
      cost: '',
      state: (state.camp.storage[id] ?? 0) > 0 ? 'owned' : 'blocked',
    }));

    const effects = ResourceSystem.campEffects();
    if (effects.unlocks.has('broth')) {
      const cost = { food: 2 };
      const can = ResourceSystem.canAfford(cost);
      rows.push({
        title: 'Cook Warm Broth',
        effect: CONSUMABLES.broth.desc,
        cost: costLabel(cost),
        costItems: cost,
        blockedBy: can ? null : ResourceSystem.shortfall(cost),
        state: can ? 'affordable' : 'blocked',
        onClick: can
          ? () => {
              if (!ResourceSystem.spend(cost)) return;
              state.player.consumables.broth = (state.player.consumables.broth ?? 0) + 1;
              bus.emit('audio:play', { cue: 'upgrade' });
              SaveSystem.save();
              this.refresh();
            }
          : undefined,
      });
    }

    for (const [id, def] of Object.entries(CONSUMABLES)) {
      const count = state.player.consumables[id as keyof typeof state.player.consumables] ?? 0;
      if (count <= 0) continue;
      rows.push({
        title: `${def.name}  x${count}`,
        effect: def.desc,
        cost: '',
        state: 'owned',
      });
    }

    return rows;
  }

  /** Today's challenge, Mira's work, and the achievement list. */
  /**
   * Everything that has come for the player, with the one thing it exists to teach.
   * Unmet things are a row of question marks, so the list itself says how much of
   * the valley is still unknown.
   */
  private bestiaryRows(): RowSpec[] {
    const rows: RowSpec[] = [];
    const seen = state.stats.enemiesSeen;
    const kills = state.stats.enemiesKilled;

    for (const id of ENEMY_IDS) {
      const def = ENEMIES[id];
      const met = seen.includes(id) || (kills[id] ?? 0) > 0;
      const killed = kills[id] ?? 0;
      const drops = def.drops.map((d) => RESOURCES[d.id].short.toLowerCase()).filter((v, i, a) => a.indexOf(v) === i);
      const dropLine = drops.length ? `  Drops ${drops.join(', ')}.` : '';
      rows.push({
        title: met ? def.name : '???',
        effect: met ? def.teaches + dropLine : 'Not met yet.',
        cost: killed > 0 ? `${killed} killed` : met ? 'Seen' : '',
        icon: met ? { key: ENEMY_SPRITE_KEY[id] } : undefined,
        state: met ? 'affordable' : 'blocked',
      });
    }

    const bosses: Array<{ id: string; name: string; teaches: string; dead: boolean }> = [
      {
        id: 'maw',
        name: 'The White Maw',
        teaches: 'Charges end in walls, and walls end in openings.',
        dead: state.bosses.mawDefeated,
      },
      {
        id: 'stag',
        name: 'The Hollow Stag',
        teaches: 'Sidestep the charge, dash the ring, keep moving under the ice.',
        dead: state.bosses.stagDefeated,
      },
      {
        id: 'ranger',
        name: 'The One Who Stayed',
        teaches: 'Only after dark. Step out of the fan, dash off the mark, kill what he calls.',
        dead: state.bosses.rangerDefeated,
      },
    ];
    for (const b of bosses) {
      const met = seen.includes(b.id) || b.dead;
      rows.push({
        title: met ? b.name : '???',
        effect: met ? b.teaches : 'Something big. Not met yet.',
        cost: b.dead ? 'Dead' : met ? 'Seen' : '',
        icon: met ? { key: BOSS_SPRITE_KEY[b.id] } : undefined,
        state: met ? 'affordable' : 'blocked',
      });
    }
    return rows;
  }

  private goalRows(): RowSpec[] {
    const rows: RowSpec[] = [];

    rows.push({
      title: 'Today',
      effect: dailyChallenge.describe(),
      cost: '',
      state: dailyChallenge.done ? 'owned' : 'blocked',
    });

    if (state.story.miraRescued) {
      rows.push({
        title: "Mira's work",
        effect: OfflineSystem.describe(),
        cost: '',
        blockedBy: 'Capped at an hour. It is a bonus, not a substitute.',
        state: 'blocked',
      });

      const pending = OfflineSystem.pending();
      if (pending) {
        rows.push({
          title: `Collect ${pending.amount} ${pending.job}`,
          effect: 'Take what she has brought in while you were away.',
          cost: '',
          state: 'affordable',
          onClick: () => {
            OfflineSystem.collect();
            SaveSystem.save();
            this.refresh();
          },
        });
      }

      const follows = state.story.miraFollows;
      rows.push({
        title: follows ? 'Mira comes with you' : '  Bring Mira along',
        effect: follows
          ? 'She follows, picks up what falls, and carries a lantern. Click to leave her at camp.'
          : 'She follows you out, picks up what falls near her, and carries a lantern.',
        cost: '',
        ownedLabel: 'WITH YOU',
        icon: { key: 'npc-mira' },
        state: follows ? 'owned' : 'affordable',
        onClick: () => {
          state.story.miraFollows = !follows;
          if (!follows) OfflineSystem.assign(null);
          if (!follows) state.story.miraFollows = true;
          bus.emit('audio:play', { cue: 'swap' });
          SaveSystem.save();
          this.refresh();
        },
      });

      for (const job of ['wood', 'food', 'scrap'] as const) {
        if (OfflineSystem.job === job) continue;
        rows.push({
          title: `  Put Mira on ${job}`,
          effect: `She will gather ${job} while the game is closed.`,
          cost: '',
          state: 'affordable',
          onClick: () => {
            OfflineSystem.assign(job);
            SaveSystem.save();
            this.refresh();
          },
        });
      }
    }

    // Deeper Winter. Off by default, and nothing here is needed to see the end.
    if (winterUnlocked()) {
      const bonus = Math.round((winterLootMult() - 1) * 100);
      rows.push({
        title: bonus > 0 ? `Deeper Winter  +${bonus}% loot` : 'Deeper Winter',
        effect: 'Make the valley meaner for a better haul. Switch any of these on.',
        cost: '',
        state: 'blocked',
      });
      for (const id of WINTER_MOD_IDS) {
        const def = WINTER_MODS[id];
        const on = !!state.winter[id];
        rows.push({
          title: `  ${def.name}`,
          effect: `${def.desc}  +${Math.round(def.bonus * 100)}% loot.`,
          cost: '',
          ownedLabel: 'ON',
          state: on ? 'owned' : 'affordable',
          onClick: () => {
            state.winter[id] = !on;
            bus.emit('audio:play', { cue: on ? 'empty' : 'upgrade' });
            SaveSystem.save();
            this.refresh();
          },
        });
      }
    } else {
      rows.push({
        title: 'Deeper Winter',
        effect: `Opens on day ${WINTER_UNLOCK_DAY}: modifiers that pay more for a harder valley.`,
        cost: '',
        state: 'blocked',
      });
    }

    // The record. Numbers people come back to check, the way Stardew keeps them.
    const kills = Object.values(state.stats.enemiesKilled).reduce((a, b) => a + b, 0);
    const record: Array<[string, string]> = [
      ['Days survived', String(state.stats.daysSurvived)],
      ['Best day reached', String(state.stats.bestDay)],
      ['Things killed', String(kills)],
      ['Resources gathered', String(state.stats.resourcesCollected)],
      ['Deaths', String(state.stats.deaths)],
      ['Days in a row', `${state.meta.streak} (best ${state.meta.bestStreak})`],
      ['Winters', String((state.meta.winters ?? 0) + 1)],
    ];
    const line = (from: number, to: number) => record.slice(from, to).map(([k, v]) => `${k}: ${v}`).join('    ');
    rows.push({ title: 'The record', effect: line(0, 3), cost: '', state: 'blocked' });
    rows.push({ title: '', effect: line(3, 5), cost: '', state: 'blocked' });
    rows.push({ title: '', effect: line(5, 7), cost: '', state: 'blocked' });

    for (const a of ACHIEVEMENT_LIST) {
      const got = state.achievements[a.id] != null;
      rows.push({
        title: a.name,
        effect: got ? a.reward.label : a.desc,
        cost: '',
        state: got ? 'owned' : 'blocked',
      });
    }

    return rows;
  }

  /**
   * The simulated store. Nothing here charges anything: the only button grants the
   * item outright so the flow can be tested.
   */
  private storeRows(): RowSpec[] {
    const rows: RowSpec[] = [
      {
        title: 'This store is a prototype',
        effect: 'No payment code exists in this project. Nothing here is needed to finish the game.',
        cost: '',
        state: 'blocked',
      },
    ];

    for (const item of StorePrototype.items()) {
      const owned = StorePrototype.owns(item);
      const unlockedFree =
        !!item.value && state.store.owned.includes(item.value) && !owned;
      rows.push({
        title: item.name,
        effect: item.desc,
        cost: owned ? '' : unlockedFree ? 'earned' : item.price,
        blockedBy: unlockedFree ? 'Unlocked by an achievement. Free to wear.' : null,
        state: owned ? 'owned' : 'affordable',
        onClick: () => {
          if (unlockedFree) StorePrototype.equipOwnedCosmetic(item);
          else StorePrototype.simulatePurchase(item);
          SaveSystem.save();
          this.refresh();
        },
      });
    }

    rows.push({
      title: `Simulated spend so far: $${StorePrototype.simulatedSpend.toFixed(2)}`,
      effect: 'Recorded for playtesting only.',
      cost: '',
      state: 'blocked',
    });

    return rows;
  }

  private close(): void {
    SaveSystem.save();
    this.scene.stop();
    this.scene.resume('Camp');
    const camp = this.scene.get('Camp') as Phaser.Scene & { rebuildCamp?: () => void };
    camp.rebuildCamp?.();
  }
}

function costLabel(cost: Partial<Record<ResourceId, number>>): string {
  const parts = Object.entries(cost).map(
    ([id, n]) => `${n} ${RESOURCES[id as ResourceId].short.toLowerCase()}`,
  );
  return parts.join('  ');
}

/** The title the survivor is wearing, or nothing at all. */
function wornTitle(): string {
  const title = state.player.cosmetics.title;
  return title && title !== 'none' && TITLES[title] ? TITLES[title] : '';
}
