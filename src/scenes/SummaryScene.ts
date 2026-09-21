import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { bus } from '../core/EventBus';
import { state } from '../core/GameState';
import { SaveSystem } from '../core/SaveSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { RESOURCES, RESOURCE_IDS, totalResources, type ResourceId } from '../data/resources';
import { UPGRADE_LIST } from '../data/upgrades';
import { PERK_LIST, PERKS } from '../data/perks';
import { AREAS, type AreaId } from '../data/areas';
import { FONT, textWidth } from '../art/PixelFont';
import { hex, PAL } from '../art/palette';
import { Button } from '../ui/Button';
import { FX } from '../art/sprites/fx';
import { RESOURCE_ICON } from '../art/sprites/icons';
import { StorePrototype } from '../systems/StorePrototype';
import { dailyChallenge } from '../systems/DailyChallengeSystem';

export interface SummaryData {
  reason: 'return' | 'death';
  day: number;
  banked: Record<ResourceId, number>;
  bonusNight: Record<ResourceId, number>;
  lost: Record<ResourceId, number>;
  untouched: boolean;
  keepFraction: number;
  kills: number;
  rareFinds: number;
  newAreas: AreaId[];
  notes: number;
  breakables: number;
}

/**
 * DAY N COMPLETE. The most important screen in the game after the camp: it has to make
 * the last fifteen minutes feel like they moved the player forward, and then point at
 * the next thing they can afford.
 */
export class SummaryScene extends Phaser.Scene {
  private summary!: SummaryData;
  private lineY = 0;
  private delay = 0;

  constructor() {
    super('Summary');
  }

  init(data: SummaryData): void {
    this.summary = data;
  }

  create(): void {
    const { width, height } = BAL.view;
    const died = this.summary.reason === 'death';

    this.add.rectangle(0, 0, width, height, hex(PAL.navy)).setOrigin(0).setAlpha(0.97);
    this.add
      .image(width / 2, 30, FX.glowHuge)
      .setTint(hex(died ? PAL.blood : PAL.orange))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.18)
      .setScale(1.2);

    const title = died ? `DAY ${this.summary.day} SURVIVED` : `DAY ${this.summary.day} COMPLETE`;
    this.add
      .bitmapText(width / 2, 16, FONT, title)
      .setOrigin(0.5, 0)
      .setScale(2)
      .setTint(hex(died ? PAL.blood : PAL.gold));

    if (died) {
      this.add
        .bitmapText(width / 2, 36, FONT, 'You collapsed in the snow. Mira found you.')
        .setOrigin(0.5, 0)
        .setTint(hex(PAL.grey));
    } else if (this.summary.untouched) {
      this.add
        .bitmapText(width / 2, 36, FONT, 'Not a scratch. +10% on everything you carried.')
        .setOrigin(0.5, 0)
        .setTint(hex(PAL.green));
    }

    this.lineY = 54;
    this.delay = 260;
    this.buildResourceLines();
    this.buildEventLines();
    this.buildNextUp();

    const cont = new Button(
      this,
      Math.round(width / 2 - 44),
      height - 24,
      { width: 88, height: 18, text: 'CONTINUE', fill: PAL.rust, fillHover: PAL.ember, border: PAL.gold, textColor: PAL.cream },
      () => this.leave(),
    );
    cont.setDepth(50);

    // The rewarded-ad prototype. It never plays on its own and never blocks the game.
    const adUsedKey = `double-${this.summary.day}`;
    if (!died && state.store.adsUsed[adUsedKey] === undefined && totalResources(this.summary.banked) > 0) {
      new Button(
        this,
        Math.round(width / 2 - 154),
        height - 24,
        { width: 100, height: 18, text: 'DOUBLE THIS HAUL', fill: PAL.violetDark, fillHover: PAL.violet, border: PAL.magenta, textColor: PAL.white },
        () => this.watchAd(adUsedKey),
      ).setDepth(50);
      this.add
        .bitmapText(Math.round(width / 2 - 154), height - 33, FONT, 'prototype: watch an ad')
        .setTint(hex(PAL.uiMuted));
    }

    if (died && StorePrototype.adAvailable('revive', this.summary.day)) {
      new Button(
        this,
        Math.round(width / 2 - 154),
        height - 24,
        {
          width: 100,
          height: 18,
          text: 'GET UP',
          fill: PAL.violetDark,
          fillHover: PAL.violet,
          border: PAL.magenta,
          textColor: PAL.white,
        },
        () => this.watchRevive(),
      ).setDepth(50);
      this.add
        .bitmapText(Math.round(width / 2 - 154), height - 33, FONT, 'prototype: watch an ad')
        .setTint(hex(PAL.uiMuted));
    }

    // The challenge reward lands with the rest of the haul.
    if (dailyChallenge.done) {
      this.add
        .bitmapText(30, height - 40, FONT, `Challenge done: ${dailyChallenge.describe()}`)
        .setTint(hex(PAL.green));
    }

    this.input.keyboard?.once('keydown-ENTER', () => this.leave());
    this.input.keyboard?.once('keydown-SPACE', () => this.leave());
  }

  // --- lines -------------------------------------------------------------

  private buildResourceLines(): void {
    const left = 30;
    let any = false;

    for (const id of RESOURCE_IDS) {
      const amount = this.summary.banked[id] ?? 0;
      if (amount <= 0) continue;
      any = true;
      const def = RESOURCES[id];
      const night = this.summary.bonusNight[id] ?? 0;
      this.countUpLine(
        left,
        def.name,
        amount,
        def.color,
        night > 0 ? `night bounty +${night}` : null,
        RESOURCE_ICON[id],
      );
    }

    if (!any) {
      this.staticLine(left, 'You came back with nothing.', '', PAL.grey);
    }

    const lostTotal = totalResources(this.summary.lost);
    if (lostTotal > 0) {
      this.staticLine(
        left,
        `Lost in the snow: ${lostTotal}`,
        `kept ${Math.round(this.summary.keepFraction * 100)}%`,
        PAL.blood,
      );
    }
  }

  private buildEventLines(): void {
    const left = 30;
    if (this.summary.kills > 0) this.staticLine(left, 'Enemies defeated', String(this.summary.kills), PAL.white);
    if (this.summary.breakables > 0) {
      this.staticLine(left, 'Things broken open', String(this.summary.breakables), PAL.grey);
    }
    if (this.summary.rareFinds > 0) {
      this.staticLine(left, 'Rare finds', String(this.summary.rareFinds), PAL.rarityRare);
    }
    if (this.summary.notes > 0) {
      this.staticLine(left, 'Notes found', `${state.story.notesFound.length} of 6`, PAL.cyan);
    }
    for (const areaId of this.summary.newAreas) {
      const area = AREAS[areaId];
      if (!area?.announce) continue;
      this.staticLine(left, 'New ground', area.name, PAL.gold);
    }
  }

  private countUpLine(
    x: number,
    label: string,
    value: number,
    color: string,
    note: string | null,
    iconKey?: string,
  ): void {
    const y = this.lineY;
    this.lineY += 11;
    const delay = this.delay;
    this.delay += 130;

    const icon = this.add
      .image(x - 13, y - 1, iconKey ?? 'fx-dot2')
      .setOrigin(0)
      .setAlpha(0);
    const name = this.add.bitmapText(x, y, FONT, label).setTint(hex(PAL.white)).setAlpha(0);
    const amount = this.add
      .bitmapText(x + 168, y, FONT, '0')
      .setOrigin(1, 0)
      .setTint(hex(color))
      .setAlpha(0);
    const noteLabel = note
      ? this.add.bitmapText(x + 178, y, FONT, note).setTint(hex(PAL.cyan)).setAlpha(0)
      : null;

    this.time.delayedCall(delay, () => {
      for (const o of [icon, name, amount, noteLabel]) o?.setAlpha(1);
      bus.emit('audio:play', { cue: 'pickup', volume: 0.5 });
      // Count up rather than appear: the number climbing is the reward.
      const counter = { v: 0 };
      this.tweens.add({
        targets: counter,
        v: value,
        duration: Math.min(520, 90 + value * 22),
        ease: 'Quad.easeOut',
        onUpdate: () => amount.setText(String(Math.round(counter.v))),
        onComplete: () => {
          amount.setText(String(value));
          this.tweens.add({ targets: amount, scale: 1.3, duration: 80, yoyo: true });
        },
      });
    });
  }

  private staticLine(x: number, label: string, value: string, color: string): void {
    const y = this.lineY;
    this.lineY += 11;
    const delay = this.delay;
    this.delay += 90;

    const name = this.add.bitmapText(x, y, FONT, label).setTint(hex(PAL.grey)).setAlpha(0);
    const amount = this.add
      .bitmapText(x + 168, y, FONT, value)
      .setOrigin(1, 0)
      .setTint(hex(color))
      .setAlpha(0);
    this.time.delayedCall(delay, () => {
      name.setAlpha(1);
      amount.setAlpha(1);
    });
  }

  /**
   * The part that makes the player want another day: what they can buy right now,
   * and the one thing they are closest to.
   */
  private buildNextUp(): void {
    const x = 250;
    const { height } = BAL.view;

    this.add
      .rectangle(x - 10, 50, 200, height - 86, hex(PAL.deep))
      .setOrigin(0)
      .setAlpha(0.35);
    this.add
      .bitmapText(x, 56, FONT, 'WHAT CAN YOU UPGRADE?')
      .setTint(hex(PAL.gold));

    const affordable: Array<{ name: string; cost: string }> = [];
    let nearest: { name: string; missing: string } | null = null;
    let nearestGap = Infinity;

    const owned = (id: string) => (state.camp.upgrades[id as never] ?? 0) > 0;

    for (const up of UPGRADE_LIST) {
      if (up.awarded || owned(up.id)) continue;
      if (up.requires?.upgrade && !owned(up.requires.upgrade)) continue;
      if (up.requires?.mira && !state.story.miraRescued) continue;
      if (up.requires?.boss && !state.bosses.mawDefeated) continue;

      if (ResourceSystem.canAfford(up.cost)) {
        affordable.push({ name: up.name, cost: costLabel(up.cost) });
      } else {
        const gap = totalGap(up.cost);
        if (gap < nearestGap) {
          nearestGap = gap;
          nearest = { name: up.name, missing: ResourceSystem.shortfall(up.cost) ?? '' };
        }
      }
    }

    for (const perk of PERK_LIST) {
      const level = state.player.perks[perk.id] ?? 0;
      if (level >= perk.maxLevel) continue;
      if (ResourceSystem.canAfford(perk.cost)) {
        affordable.push({ name: PERKS[perk.id].name, cost: costLabel(perk.cost) });
      }
    }

    let y = 70;
    if (affordable.length === 0) {
      this.add.bitmapText(x, y, FONT, 'Nothing yet. Keep going.').setTint(hex(PAL.grey));
      y += 14;
    }

    for (const item of affordable.slice(0, 7)) {
      const row = this.add.bitmapText(x, y, FONT, item.name).setTint(hex(PAL.gold));
      this.add
        .bitmapText(x + 186, y, FONT, item.cost)
        .setOrigin(1, 0)
        .setTint(hex(PAL.cream));
      // Newly affordable rows pulse, so the eye goes straight to them.
      this.tweens.add({ targets: row, alpha: 0.55, duration: 700, yoyo: true, repeat: -1 });
      y += 11;
    }

    if (nearest) {
      y += 6;
      this.add.bitmapText(x, y, FONT, 'Closest').setTint(hex(PAL.uiMuted));
      this.add.bitmapText(x + 50, y, FONT, nearest.name).setTint(hex(PAL.white));
      this.add.bitmapText(x, y + 11, FONT, nearest.missing).setTint(hex(PAL.cyan));
    }

    void textWidth;
  }

  // --- actions -----------------------------------------------------------

  private watchAd(key: string): void {
    const { width, height } = BAL.view;
    const overlay = this.add.rectangle(0, 0, width, height, hex(PAL.black)).setOrigin(0).setDepth(100);
    const label = this.add
      .bitmapText(width / 2, height / 2 - 8, FONT, 'AD PLAYING (PROTOTYPE)')
      .setOrigin(0.5)
      .setScale(1.5)
      .setTint(hex(PAL.white))
      .setDepth(101);
    const skip = this.add
      .bitmapText(width / 2, height / 2 + 14, FONT, 'nothing is actually playing')
      .setOrigin(0.5)
      .setTint(hex(PAL.uiMuted))
      .setDepth(101);

    bus.emit('ad:clicked', { rewardId: 'doubleHaul' });
    state.store.adsUsed[key] = this.summary.day;

    this.time.delayedCall(2200, () => {
      for (const id of RESOURCE_IDS) {
        const amount = this.summary.banked[id] ?? 0;
        if (amount > 0) state.camp.storage[id] += amount;
      }
      SaveSystem.save();
      overlay.destroy();
      label.destroy();
      skip.destroy();
      bus.emit('juice:toast', { text: 'Haul doubled.', color: '#ffcf1f' });
      this.scene.restart({ ...this.summary, bonusNight: this.summary.bonusNight });
    });
  }

  /**
   * Stand back up instead of losing the day. The player has to choose it, it is once
   * per day, and nothing ever plays on its own.
   */
  private watchRevive(): void {
    const { width, height } = BAL.view;
    const overlay = this.add.rectangle(0, 0, width, height, hex(PAL.black)).setOrigin(0).setDepth(100);
    const label = this.add
      .bitmapText(width / 2, height / 2 - 8, FONT, 'AD PLAYING (PROTOTYPE)')
      .setOrigin(0.5)
      .setScale(1.5)
      .setTint(hex(PAL.white))
      .setDepth(101);

    StorePrototype.markAdUsed('revive', this.summary.day);

    this.time.delayedCall(2200, () => {
      overlay.destroy();
      label.destroy();
      // Put the haul back and send the player out again on the same day.
      for (const id of RESOURCE_IDS) {
        const lost = this.summary.lost[id] ?? 0;
        if (lost > 0) state.camp.storage[id] += lost;
      }
      state.run = null;
      SaveSystem.save();
      bus.emit('juice:toast', { text: 'You get up. The day is not over.', color: '#c56bff' });
      this.scene.start('Camp');
    });
  }

  private leave(): void {
    dailyChallenge.claimIfDone();
    state.day += 1;
    state.stats.daysSurvived += 1;
    state.stats.bestDay = Math.max(state.stats.bestDay, state.day);
    state.run = null;
    SaveSystem.save();
    this.scene.start('Camp');
  }
}

function costLabel(cost: Partial<Record<ResourceId, number>>): string {
  return Object.entries(cost)
    .map(([id, n]) => `${n}${RESOURCES[id as ResourceId].short[0]}`)
    .join(' ');
}

function totalGap(cost: Partial<Record<ResourceId, number>>): number {
  let gap = 0;
  for (const [id, need] of Object.entries(cost)) {
    gap += Math.max(0, (need ?? 0) - (state.camp.storage[id as ResourceId] ?? 0));
  }
  return gap;
}
