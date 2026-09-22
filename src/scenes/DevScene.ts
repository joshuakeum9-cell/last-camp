import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { FONT, wrap } from '../art/PixelFont';
import { hex, PAL } from '../art/palette';
import { Button } from '../ui/Button';
import { SaveSystem } from '../core/SaveSystem';
import { state } from '../core/GameState';
import { analytics } from '../systems/AnalyticsSystem';
import { StorePrototype } from '../systems/StorePrototype';
import { dailyChallenge } from '../systems/DailyChallengeSystem';
import { achievements } from '../systems/AchievementSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';

/**
 * Hidden developer screen. Backtick, or the version label on the title. It exists to
 * answer the PLAYTEST.md questions with numbers instead of memory.
 */
export class DevScene extends Phaser.Scene {
  constructor() {
    super('Dev');
  }

  create(): void {
    const { width, height } = BAL.view;
    this.add.rectangle(0, 0, width, height, hex(PAL.black)).setOrigin(0).setAlpha(0.95);

    this.add.bitmapText(8, 6, FONT, 'DEVELOPER').setTint(hex(PAL.green)).setScale(1.5);
    this.add
      .bitmapText(8, 20, FONT, 'Local only. Nothing here is ever sent anywhere.')
      .setTint(hex(PAL.uiMuted));

    this.buildState();
    this.buildAnalytics();
    this.buildButtons();

    this.input.keyboard?.on('keydown-ESC', () => this.scene.stop('Dev'));
  }

  private buildState(): void {
    const lines = [
      `day ${state.day}   camp level ${state.camp.level}   buildings ${UpgradeSystem.ownedCount()}`,
      `deaths ${state.stats.deaths}   kills ${Object.values(state.stats.enemiesKilled).reduce((a, b) => a + b, 0)}`,
      `resources gathered ${state.stats.resourcesCollected}`,
      `areas ${state.map.discoveredAreas.length}/8   notes ${state.story.notesFound.length}/6`,
      `mira ${state.story.miraRescued ? 'rescued' : 'no'}   secret ${state.map.secretFound ? 'found' : 'no'}`,
      `alpha ${state.bosses.alphaDefeated ? 'dead' : 'alive'}   maw ${state.bosses.mawDefeated ? 'dead' : 'alive'} (${state.bosses.mawAttempts} attempts)   stag ${state.bosses.stagDefeated ? 'dead' : 'alive'} (${state.bosses.stagAttempts} attempts)`,
      `achievements ${achievements.unlockedCount}/10   ${dailyChallenge.describe()}`,
      `simulated spend $${StorePrototype.simulatedSpend.toFixed(2)}   session ${analytics.sessionSeconds}s`,
    ];
    this.add
      .bitmapText(8, 34, FONT, wrap(lines.join('\n'), 74))
      .setTint(hex(PAL.cyan));
  }

  private buildAnalytics(): void {
    const { width } = BAL.view;
    const top = this.add
      .bitmapText(width - 8, 34, FONT, `${analytics.count} events logged`)
      .setOrigin(1, 0)
      .setTint(hex(PAL.gold));

    const rows = analytics
      .summary()
      .slice(0, 12)
      .map((e) => `${String(e.count).padStart(4)}  ${e.name}`)
      .join('\n');

    this.add
      .bitmapText(width - 8, 46, FONT, rows || 'nothing yet')
      .setOrigin(1, 0)
      .setTint(hex(PAL.grey));
    void top;
  }

  private buildButtons(): void {
    const { height } = BAL.view;
    const y = height - 20;

    new Button(
      this,
      8,
      y,
      { width: 96, height: 14, text: 'COPY ANALYTICS' },
      () => this.copy(analytics.exportJson(), 'analytics'),
    );

    new Button(
      this,
      108,
      y,
      { width: 80, height: 14, text: 'SAVE JSON' },
      () => this.copy(SaveSystem.exportJson(), 'save'),
    );

    new Button(
      this,
      192,
      y,
      { width: 74, height: 14, text: 'GRANT 50', fill: PAL.deep },
      () => {
        for (const id of Object.keys(state.camp.storage) as Array<keyof typeof state.camp.storage>) {
          state.camp.storage[id] += 50;
        }
        SaveSystem.save();
        this.scene.restart();
      },
    );

    new Button(
      this,
      270,
      y,
      { width: 84, height: 14, text: 'CLEAR EVENTS', fill: PAL.deep },
      () => {
        analytics.clear();
        this.scene.restart();
      },
    );

    new Button(
      this,
      this.scale.width ? BAL.view.width - 60 : 400,
      y,
      { width: 52, height: 14, text: 'CLOSE', fill: PAL.rust, border: PAL.gold, textColor: PAL.cream },
      () => this.scene.stop('Dev'),
    );
  }

  private copy(text: string, what: string): void {
    const done = () => {
      this.add
        .bitmapText(8, BAL.view.height - 32, FONT, `${what} copied to the clipboard`)
        .setTint(hex(PAL.green));
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done, () => console.log(text));
    } else {
      console.log(text);
      done();
    }
  }
}
