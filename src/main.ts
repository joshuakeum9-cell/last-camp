import Phaser from 'phaser';
import { BAL } from './data/balance';
import { PAL } from './art/palette';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { CampScene } from './scenes/CampScene';
import { WorldScene } from './scenes/WorldScene';
import { HUDScene } from './scenes/HUDScene';
import { SummaryScene } from './scenes/SummaryScene';
import { MenuScene } from './scenes/MenuScene';
import { PauseScene } from './scenes/PauseScene';
import { ControlsScene } from './scenes/ControlsScene';
import { EndingScene } from './scenes/EndingScene';
import { SettingsScene } from './scenes/SettingsScene';
import { DevScene } from './scenes/DevScene';
import { SaveSystem } from './core/SaveSystem';
import { state } from './core/GameState';
// Importing these starts them listening. They are singletons on purpose: one analytics
// log, one audio context, one achievement watcher for the whole session.
import { analytics } from './systems/AnalyticsSystem';
import { audio } from './systems/AudioManager';
import { achievements } from './systems/AchievementSystem';
import { dailyChallenge } from './systems/DailyChallengeSystem';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: PAL.black,
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: BAL.view.width,
    height: BAL.view.height,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  input: {
    activePointers: 3,
  },
  render: {
    powerPreference: 'high-performance',
  },
  scene: [
    BootScene,
    TitleScene,
    CampScene,
    WorldScene,
    SummaryScene,
    MenuScene,
    SettingsScene,
    PauseScene,
    ControlsScene,
    EndingScene,
    HUDScene,
    DevScene,
  ],
};

try {
  const game = new Phaser.Game(config);

  /**
   * Debug hooks, used by the developer screen and when driving the game from a console
   * during playtesting. `step` matters because browsers throttle animation frames in an
   * unfocused window, which otherwise freezes the game mid-transition.
   */
  (window as unknown as { lc: unknown }).lc = {
    game,
    goto(key: string) {
      for (const s of game.scene.scenes) {
        if (s.scene.key !== 'HUD' && s.sys.settings.status === Phaser.Scenes.RUNNING) {
          game.scene.stop(s.scene.key);
        }
      }
      game.scene.start(key);
    },
    /** Force N frames, so a stuck fade or tween completes without window focus. */
    step(frames = 60, dt = 16.7) {
      // Continue from wherever the clock already is, so synthetic frames never run
      // behind real ones and hand the scene clocks a negative delta.
      let t = Math.max(performance.now(), game.loop.time);
      for (let i = 0; i < frames; i++) {
        t += dt;
        game.loop.step(t);
      }
      return game.loop.frame;
    },
    /** Stop the browser's own frame loop, so `step` is the only thing advancing time. */
    pause() {
      game.loop.stop();
    },
    resume() {
      game.loop.start(game.step.bind(game));
    },
    skipFades() {
      for (const s of game.scene.scenes) {
        s.cameras?.main?.resetFX();
      }
    },
    /** Playtesting only: stock the camp so a later day can be reached quickly. */
    grant(amount = 50) {
      for (const id of Object.keys(state.camp.storage) as Array<keyof typeof state.camp.storage>) {
        state.camp.storage[id] += amount;
      }
      SaveSystem.save();
      return state.camp.storage;
    },
    state: () => state,
    analytics: () => analytics,
    audio: () => audio,
    achievements: () => achievements,
    challenge: () => dailyChallenge,
  };

  // Keep the camp safe if the tab is closed mid-session.
  window.addEventListener('beforeunload', () => SaveSystem.save());
  window.addEventListener('visibilitychange', () => {
    if (document.hidden) SaveSystem.save();
  });

  // The developer screen, for analytics export and quick testing.
  window.addEventListener('keydown', (e) => {
    if (e.key !== '`') return;
    const dev = game.scene.getScene('Dev');
    if (!dev) return;
    if (game.scene.isActive('Dev')) {
      game.scene.stop('Dev');
    } else {
      game.scene.start('Dev');
    }
  });
} catch (err) {
  const panel = document.getElementById('boot-error');
  if (panel) {
    panel.style.display = 'block';
    panel.textContent = `Last Camp failed to start.\n\n${String(err)}\n\n${
      err instanceof Error ? err.stack ?? '' : ''
    }`;
  }
  throw err;
}
