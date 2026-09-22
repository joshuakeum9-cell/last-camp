import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { bus } from '../core/EventBus';
import { state } from '../core/GameState';
import { SaveSystem } from '../core/SaveSystem';
import { Button } from '../ui/Button';
import { Label } from '../ui/Label';
import { FONT } from '../art/PixelFont';
import { hex, PAL } from '../art/palette';
import { SCENERY_KEYS } from '../art/sprites/scenery';
import { FX } from '../art/sprites/fx';
import { Weather } from '../systems/Weather';
import { NOTE_LIST } from '../data/story';

type Ending = 'shutdown' | 'kept';

interface Beat {
  lines: string[];
  /** Tints the tower light while this beat is on screen. */
  glow?: string;
}

/** Everything before the choice. One beat per press, so the player sets the pace. */
const CLIMB: Beat[] = [
  {
    lines: [
      'The stair is on the outside of the tower.',
      'Two hundred steps, and the wind takes every one of them personally.',
    ],
  },
  {
    lines: [
      'Halfway up, the cold stops.',
      'Not eases. Stops. The air here is the temperature of a room.',
    ],
    glow: PAL.gold,
  },
  {
    lines: [
      'At the top there is a door, and the door is not locked.',
      'Nobody up here ever expected to need a lock.',
    ],
  },
  {
    lines: [
      'Inside: eleven coats on eleven hooks. A kettle, long cold.',
      'And in the middle of the floor, the thing the tower was built around.',
    ],
    glow: PAL.cyan,
  },
  {
    lines: [
      'It is not a machine so much as an absence with wires run to it.',
      'It is taking the warmth out of the valley and holding it, very carefully, here.',
    ],
    glow: PAL.ice,
  },
  {
    lines: [
      'There is a switch. Somebody has written on the wall beside it, in pencil:',
      'IF YOU ARE READING THIS YOU ALREADY KNOW WHAT IT COSTS.',
    ],
    glow: PAL.ember,
  },
];

const EPILOGUE: Record<Ending, string[]> = {
  shutdown: [
    'The hum stops. The silence afterwards is enormous.',
    'By the time you are down the stairs the snow has turned to rain.',
    'It takes the valley three days to remember how to be a valley.',
    'The road comes back first. Then the lake. Then, slowly, the rest of it.',
    'Mira keeps the camp standing anyway. Somebody should be here, she says,',
    'in case anyone else comes down the road looking for a fire.',
  ],
  kept: [
    'You leave it running. You are not sure you decide to; you just do not touch it.',
    'The valley stays a valley of snow, and the camp stays warm inside it.',
    'The cold keeps coming inward. The fire keeps pushing it back. That is the arrangement.',
    'Mira never asks what you found up there, which is how you know she guessed.',
    'Some nights the tower light blinks twice, like it is checking you are still down here.',
    'You keep the fire high, and you do not go back up.',
  ],
};

/**
 * The end of the story. Reached by climbing the tower once the radio has answered,
 * which needs the signal table built and all three of the valley's bosses dead.
 *
 * The choice is not a puzzle and there is no wrong answer: one ends the winter and
 * gives up the camp's reason to exist, the other keeps the camp and gives up
 * everyone else. The save records which, and the camp remembers it afterwards.
 */
export class EndingScene extends Phaser.Scene {
  private step = 0;
  private phase: 'climb' | 'choice' | 'epilogue' | 'end' = 'climb';
  private chosen: Ending = 'shutdown';
  private weather!: Weather;
  private tower!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Image;
  private body: Label[] = [];
  private hint!: Phaser.GameObjects.BitmapText;
  private buttons: Button[] = [];

  constructor() {
    super('Ending');
  }

  create(): void {
    const { width, height } = BAL.view;
    this.step = 0;
    this.phase = 'climb';
    this.body = [];
    this.buttons = [];

    this.add.rectangle(0, 0, width, height, hex(PAL.black)).setOrigin(0);
    this.add
      .rectangle(0, height - 90, width, 90, hex(PAL.navy))
      .setOrigin(0)
      .setAlpha(0.5);

    this.glow = this.add
      .image(Math.round(width / 2), 78, FX.glowLarge)
      .setTint(hex(PAL.blueDark))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.35)
      .setScale(1.6);
    this.tweens.add({
      targets: this.glow,
      alpha: 0.6,
      scale: 1.9,
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.tower = this.add
      .image(Math.round(width / 2), 128, SCENERY_KEYS.tower)
      .setOrigin(0.5, 1)
      .setScale(8)
      .setTint(hex(PAL.navy));

    const blink = this.add.rectangle(Math.round(width / 2), 56, 4, 4, hex(PAL.blood));
    this.tweens.add({ targets: blink, alpha: 0, duration: 380, yoyo: true, repeat: -1, repeatDelay: 1500 });

    this.weather = new Weather(this, 400);

    this.hint = this.add
      .bitmapText(Math.round(width / 2), height - 12, FONT, 'E or click to go on')
      .setOrigin(0.5, 0)
      .setTint(hex(PAL.uiMuted));

    this.showBeat(CLIMB[0]);

    this.input.on('pointerdown', () => this.advance());
    this.input.keyboard?.on('keydown-E', () => this.advance());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());

    bus.emit('audio:music', { cue: null });
    this.cameras.main.fadeIn(900, 0, 0, 0);
    this.events.once('shutdown', () => this.weather.destroy());
  }

  private clearBody(): void {
    for (const l of this.body) l.destroy();
    this.body = [];
  }

  private showBeat(beat: Beat): void {
    const { width, height } = BAL.view;
    this.clearBody();
    if (beat.glow) this.glow.setTint(hex(beat.glow));

    beat.lines.forEach((line, i) => {
      const label = new Label(this, Math.round(width / 2), height - 76 + i * 12, line, {
        color: PAL.cream,
        originX: 0.5,
        align: 'center',
      }).setAlpha(0);
      this.body.push(label);
      this.tweens.add({ targets: label.target, alpha: 1, duration: 420, delay: i * 240 });
    });
  }

  private advance(): void {
    if (this.phase === 'choice') return;

    if (this.phase === 'climb') {
      this.step++;
      if (this.step < CLIMB.length) {
        this.showBeat(CLIMB[this.step]);
        return;
      }
      this.offerChoice();
      return;
    }

    if (this.phase === 'epilogue') {
      this.step++;
      const lines = EPILOGUE[this.chosen];
      if (this.step * 2 < lines.length) {
        this.showBeat({ lines: lines.slice(this.step * 2, this.step * 2 + 2) });
        return;
      }
      this.showEnd();
    }
  }

  private offerChoice(): void {
    this.phase = 'choice';
    const { width, height } = BAL.view;
    this.clearBody();
    this.hint.setText('');

    const prompt = new Label(this, Math.round(width / 2), height - 82, 'The switch is right there.', {
      color: PAL.white,
      originX: 0.5,
      align: 'center',
    });
    this.body.push(prompt);

    const bw = 180;
    this.buttons.push(
      new Button(
        this,
        Math.round(width / 2 - bw - 6),
        height - 62,
        {
          width: bw,
          height: 20,
          text: 'SHUT IT DOWN',
          fill: PAL.deep,
          fillHover: PAL.blueDark,
          border: PAL.cyan,
          textColor: PAL.white,
        },
        () => this.choose('shutdown'),
      ),
      new Button(
        this,
        Math.round(width / 2 + 6),
        height - 62,
        {
          width: bw,
          height: 20,
          text: 'LEAVE IT RUNNING',
          fill: PAL.deep,
          fillHover: PAL.rust,
          border: PAL.gold,
          textColor: PAL.cream,
        },
        () => this.choose('kept'),
      ),
    );

    const notes = [
      'Shut it down: the winter ends, and the camp loses its reason.',
      'Leave it running: the camp stays warm, and only the camp.',
    ];
    notes.forEach((line, i) => {
      this.body.push(
        new Label(this, Math.round(width / 2), height - 36 + i * 11, line, {
          color: PAL.uiMuted,
          originX: 0.5,
          align: 'center',
        }),
      );
    });
  }

  private choose(ending: Ending): void {
    this.chosen = ending;
    this.phase = 'epilogue';
    this.step = 0;

    state.story.ending = ending;
    state.story.finishedOnDay = state.day;
    SaveSystem.save();
    bus.emit('story:ended', { ending });

    for (const b of this.buttons) b.destroy();
    this.buttons = [];
    this.hint.setText('E or click to go on');

    this.glow.setTint(hex(ending === 'shutdown' ? PAL.gold : PAL.ice));
    this.tower.setTint(hex(ending === 'shutdown' ? PAL.deep : PAL.navy));
    this.cameras.main.flash(600, ending === 'shutdown' ? 255 : 120, ending === 'shutdown' ? 220 : 180, 160);
    bus.emit('audio:play', { cue: ending === 'shutdown' ? 'upgrade' : 'portal' });

    this.showBeat({ lines: EPILOGUE[ending].slice(0, 2) });
  }

  private showEnd(): void {
    this.phase = 'end';
    const { width, height } = BAL.view;
    this.clearBody();
    this.hint.setText('');

    this.add
      .bitmapText(Math.round(width / 2), 150, FONT, 'THE WINTER ENDED')
      .setOrigin(0.5, 0)
      .setScale(2)
      .setTint(hex(this.chosen === 'shutdown' ? PAL.gold : PAL.cyan))
      .setText(this.chosen === 'shutdown' ? 'THE WINTER ENDED' : 'THE CAMP HELD');

    const stats = [
      `Days survived: ${state.day}`,
      `Notes found: ${state.story.notesFound.length} of ${NOTE_LIST.length}`,
      `Areas found: ${state.map.discoveredAreas.length} of 8`,
      `Deaths: ${state.stats.deaths}`,
    ];
    stats.forEach((line, i) => {
      this.body.push(
        new Label(this, Math.round(width / 2), height - 92 + i * 11, line, {
          color: PAL.cream,
          originX: 0.5,
          align: 'center',
        }),
      );
    });

    const bw = 140;
    this.buttons.push(
      new Button(
        this,
        Math.round(width / 2 - bw / 2),
        height - 40,
        {
          width: bw,
          height: 20,
          text: 'BACK TO THE FIRE',
          fill: PAL.rust,
          fillHover: PAL.ember,
          border: PAL.gold,
          textColor: PAL.cream,
        },
        () => {
          this.cameras.main.fadeOut(600, 0, 0, 0);
          this.time.delayedCall(650, () => this.scene.start('Camp'));
        },
      ),
    );
  }

  update(_time: number, delta: number): void {
    this.weather.update(delta, 0.2);
  }
}
