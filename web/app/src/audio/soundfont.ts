import * as Soundfont from 'soundfont-player';
import type { Player } from 'soundfont-player';
import type { RenderedSong } from '../core/render.js';
import type { ProgramChange } from '../core/yamaha/parseStyle.js';
import { programToInstrument } from './gm.js';

export type SoundfontOptions = {
  soundfont?: 'MusyngKite' | 'FluidR3_GM' | string;
  format?: 'mp3' | 'ogg';
  gain?: number;
};

export type PlaybackHandle = {
  stop: () => void;
};

export class SoundfontSynth {
  private instrumentCache = new Map<string, Promise<Player>>();
  private channelInstruments = new Map<number, Player>();
  private readonly context: AudioContext;
  private readonly options: SoundfontOptions;

  constructor(context: AudioContext, options: SoundfontOptions = {}) {
    this.context = context;
    this.options = options;
  }

  async prepare(programsByChannel: Map<number, ProgramChange>): Promise<void> {
    const channels = new Set<number>(programsByChannel.keys());
    channels.add(9);
    channels.add(0);

    const promises: Promise<void>[] = [];
    for (const channel of channels) {
      const program = programsByChannel.get(channel)?.program ?? 0;
      const name = channel === 9 ? 'percussion' : programToInstrument(program);
      promises.push(
        this.loadInstrument(name).then((instrument) => {
          this.channelInstruments.set(channel, instrument);
        })
      );
    }
    await Promise.all(promises);
  }

  play(rendered: RenderedSong, startDelay = 0.08): PlaybackHandle {
    const secondsPerBeat = rendered.tempo / 1_000_000;
    const baseGain = this.options.gain ?? 0.9;
    const startAt = this.context.currentTime + startDelay;

    for (const note of rendered.notes) {
      const instrument = this.channelInstruments.get(note.channel) ?? this.channelInstruments.get(0);
      if (!instrument) {
        continue;
      }
      const when = startAt + (note.startTick / rendered.ticksPerBeat) * secondsPerBeat;
      const duration = (note.duration / rendered.ticksPerBeat) * secondsPerBeat;
      if (duration <= 0) {
        continue;
      }
      (instrument as unknown as { play: (note: number, when: number, options?: Record<string, unknown>) => void }).play(
        note.pitch,
        when,
        {
          duration,
          gain: (note.velocity / 127) * baseGain,
        }
      );
    }

    return {
      stop: () => {
        for (const instrument of this.channelInstruments.values()) {
          instrument.stop();
        }
      },
    };
  }

  private loadInstrument(name: string): Promise<Player> {
    const soundfont = this.options.soundfont ?? 'MusyngKite';
    const format = this.options.format ?? 'mp3';
    const key = `${soundfont}:${format}:${name}`;
    const cached = this.instrumentCache.get(key);
    if (cached) {
      return cached;
    }
    const promise = Soundfont.instrument(this.context, name as never, {
      soundfont,
      format,
      gain: this.options.gain ?? 0.9,
    }) as Promise<Player>;
    this.instrumentCache.set(key, promise);
    return promise;
  }
}
