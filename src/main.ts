import Phaser from 'phaser';
import { BAL } from './data/balance';
import { PAL } from './art/palette';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { CampScene } from './scenes/CampScene';
import { WorldScene } from './scenes/WorldScene';
import { HUDScene } from './scenes/HUDScene';
import { DevScene } from './scenes/DevScene';
import { SaveSystem } from './core/SaveSystem';

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
  scene: [BootScene, TitleScene, CampScene, WorldScene, HUDScene, DevScene],
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
      let t = performance.now();
      for (let i = 0; i < frames; i++) {
        t += dt;
        game.loop.step(t);
      }
      return game.loop.frame;
    },
    skipFades() {
      for (const s of game.scene.scenes) {
        s.cameras?.main?.resetFX();
      }
    },
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
