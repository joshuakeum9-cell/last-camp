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
import { BRANCHES, REINFORCE_COST, WEAPONS, type WeaponId } from '../data/weapons';
import { RowList, type RowSpec } from '../ui/Panel';
import { Button } from '../ui/Button';
import { FONT } from '../art/PixelFont';
import { hex, PAL } from '../art/palette';
import { StorePrototype } from '../systems/StorePrototype';
import { OfflineSystem } from '../systems/OfflineSystem';
import { dailyChallenge } from '../systems/DailyChallengeSystem';
import { ACHIEVEMENT_LIST } from '../data/achievements';

type Tab = 'camp' | 'survivor' | 'weapons' | 'inventory' | 'goals' | 'store';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'camp', label: 'CAMP' },
  { id: 'survivor', label: 'SURVIVOR' },
  { id: 'weapons', label: 'WEAPONS' },
  { id: 'inventory', label: 'SUPPLIES' },
  { id: 'goals', label: 'GOALS' },
  { id: 'store', label: 'SUPPLY DROP' },
];

/**
 * The camp menu. One screen, four tabs, and every row states its cost and its effect
 * in plain words. It opens over the camp so the player can see what their money buys.
 */
export class MenuScene extends Phaser.Scene {
  private tab: Tab = 'camp';
  private list!: RowList;
  private tabButtons: Button[] = [];
  private resourceLabels = new Map<ResourceId, Phaser.GameObjects.BitmapText>();
  private subtitle!: Phaser.GameObjects.BitmapText;
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
    this.add
      .rectangle(10, 8, width - 20, height - 16, hex(PAL.navy))
      .setOrigin(0)
      .setStrokeStyle(1, hex(PAL.blueDark));

    this.add.bitmapText(18, 14, FONT, 'THE LAST CAMP').setScale(1.5).setTint(hex(PAL.gold));
    this.subtitle = this.add
      .bitmapText(18, 28, FONT, CampSystem.description())
      .setTint(hex(PAL.grey));

    this.buildResourceBar();
    this.buildTabs();

    this.list = new RowList(this, 18, 58, width - 36, height - 82);
    this.refresh();

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
    let x = width - 20;
    for (const id of [...RESOURCE_IDS].reverse()) {
      const label = this.add
        .bitmapText(x, 14, FONT, '0')
        .setOrigin(1, 0)
        .setTint(hex(RESOURCES[id].color));
      this.resourceLabels.set(id, label);
      this.add.rectangle(x + 4, 15, 5, 5, hex(RESOURCES[id].color)).setOrigin(0);
      x -= 42;
    }
  }

  private buildTabs(): void {
    let x = 18;
    for (const t of TABS) {
      const btn = new Button(
        this,
        x,
        40,
        {
          width: 68,
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
      x += 72;
    }
  }

  private cycleTab(): void {
    const i = TABS.findIndex((t) => t.id === this.tab);
    this.scene.restart({ tab: TABS[(i + 1) % TABS.length].id });
  }

  // --- content -----------------------------------------------------------

  private refresh(): void {
    for (const [id, label] of this.resourceLabels) {
      label.setText(String(state.camp.storage[id] ?? 0));
    }
    this.subtitle.setText(CampSystem.description());

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
    return PERK_LIST.map((perk) => {
      const level = UpgradeSystem.perkLevel(perk.id);
      const maxed = level >= perk.maxLevel;
      const can = UpgradeSystem.canBuyPerk(perk.id);
      return {
        title: perk.maxLevel > 1 ? `${perk.name}  ${level}/${perk.maxLevel}` : perk.name,
        effect: perk.desc,
        cost: maxed ? '' : costLabel(perk.cost),
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

      rows.push({
        title: `${resolved.name}${equipped ? '  (carried)' : ''}`,
        effect: resolved.def.desc,
        cost: '',
        state: equipped ? 'owned' : 'affordable',
        onClick: equipped
          ? undefined
          : () => {
              state.player.equipped[0] = instance.uid;
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
