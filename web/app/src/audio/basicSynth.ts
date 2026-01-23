import type { RenderedSong } from '../core/render.js';
import type { ProgramChange } from '../core/yamaha/parseStyle.js';
import { programToInstrument } from './gm.js';
import type { PlaybackHandle } from './soundfont.js';

type InstrumentCategory =
  | 'keys'
  | 'organ'
  | 'guitar'
  | 'bass'
  | 'strings'
  | 'brass'
  | 'reed'
  | 'lead'
  | 'pad'
  | 'perc'
  | 'fx'
  | 'other';

type ChannelVoice = {
  category: InstrumentCategory;
  wave: OscillatorType;
  filterHz?: number;
  detuneCents?: number;
};

const CATEGORY_WAVES: Record<InstrumentCategory, ChannelVoice> = {
  keys: { category: 'keys', wave: 'triangle', filterHz: 3000 },
  organ: { category: 'organ', wave: 'square', filterHz: 3500 },
  guitar: { category: 'guitar', wave: 'sawtooth', filterHz: 2500 },
  bass: { category: 'bass', wave: 'square', filterHz: 800 },
  strings: { category: 'strings', wave: 'sine', filterHz: 4500, detuneCents: 6 },
  brass: { category: 'brass', wave: 'sawtooth', filterHz: 2200 },
  reed: { category: 'reed', wave: 'triangle', filterHz: 2600 },
  lead: { category: 'lead', wave: 'sawtooth', filterHz: 3200 },
  pad: { category: 'pad', wave: 'sine', filterHz: 1800, detuneCents: 8 },
  perc: { category: 'perc', wave: 'triangle', filterHz: 2000 },
  fx: { category: 'fx', wave: 'sawtooth', filterHz: 4000 },
  other: { category: 'other', wave: 'triangle', filterHz: 3000 },
};

function instrumentCategory(name: string): InstrumentCategory {
  if (name.includes('piano') || name.includes('clavinet') || name.includes('harpsichord')) return 'keys';
  if (name.includes('organ')) return 'organ';
  if (name.includes('guitar')) return 'guitar';
  if (name.includes('bass')) return 'bass';
  if (
    name.includes('violin') ||
    name.includes('cello') ||
    name.includes('viola') ||
    name.includes('string') ||
    name.includes('harp')
  ) {
    return 'strings';
  }
  if (name.includes('trumpet') || name.includes('trombone') || name.includes('horn') || name.includes('brass')) {
    return 'brass';
  }
  if (
    name.includes('sax') ||
    name.includes('clarinet') ||
    name.includes('oboe') ||
    name.includes('flute') ||
    name.includes('bassoon')
  ) {
    return 'reed';
  }
  if (name.startsWith('lead_')) return 'lead';
  if (name.startsWith('pad_')) return 'pad';
  if (name.startsWith('fx_')) return 'fx';
  if (name.includes('drum') || name.includes('timpani') || name.includes('cymbal')) return 'perc';
  return 'other';
}

function midiToHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export class BasicSynth {
  private readonly context: AudioContext;
  private channelVoices = new Map<number, ChannelVoice>();
  private noiseBuffer: AudioBuffer;

  constructor(context: AudioContext) {
    this.context = context;
    this.noiseBuffer = this.createNoiseBuffer();
  }

  async prepare(programsByChannel: Map<number, ProgramChange>): Promise<void> {
    this.channelVoices.clear();
    for (const [channel, program] of programsByChannel.entries()) {
      const name = programToInstrument(program.program);
      const category = instrumentCategory(name);
      this.channelVoices.set(channel, CATEGORY_WAVES[category]);
    }
    if (!this.channelVoices.has(0)) {
      this.channelVoices.set(0, CATEGORY_WAVES.keys);
    }
  }

  play(rendered: RenderedSong, startDelay = 0.08): PlaybackHandle {
    const secondsPerBeat = rendered.tempo / 1_000_000;
    const startAt = this.context.currentTime + startDelay;
    const activeStops: Array<() => void> = [];

    for (const note of rendered.notes) {
      const when = startAt + (note.startTick / rendered.ticksPerBeat) * secondsPerBeat;
      const duration = (note.duration / rendered.ticksPerBeat) * secondsPerBeat;
      if (duration <= 0) {
        continue;
      }

      if (note.channel === 9) {
        const stop = this.playDrum(note.pitch, when, duration, note.velocity);
        activeStops.push(stop);
        continue;
      }

      const voice = this.channelVoices.get(note.channel) ?? CATEGORY_WAVES.other;
      const stop = this.playTone(note.pitch, when, duration, note.velocity, voice);
      activeStops.push(stop);
    }

    return {
      stop: () => {
        for (const stop of activeStops) {
          stop();
        }
      },
    };
  }

  private playTone(
    pitch: number,
    when: number,
    duration: number,
    velocity: number,
    voice: ChannelVoice
  ): () => void {
    const osc = this.context.createOscillator();
    osc.type = voice.wave;
    osc.frequency.setValueAtTime(midiToHz(pitch), when);
    if (voice.detuneCents) {
      osc.detune.setValueAtTime(voice.detuneCents, when);
    }

    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(voice.filterHz ?? 3000, when);

    const gain = this.context.createGain();
    const base = Math.max(0.05, Math.min(1, velocity / 127));
    const attack = 0.01;
    const release = 0.2;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(base, when + attack);
    gain.gain.linearRampToValueAtTime(base * 0.75, when + attack + 0.1);
    gain.gain.setValueAtTime(base * 0.7, when + duration);
    gain.gain.linearRampToValueAtTime(0.0001, when + duration + release);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.context.destination);

    osc.start(when);
    osc.stop(when + duration + release + 0.05);

    return () => {
      try {
        osc.stop();
      } catch {
        // Ignore double-stop errors.
      }
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  private playDrum(pitch: number, when: number, duration: number, velocity: number): () => void {
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    const baseFreq = 120 + pitch * 6;
    filter.frequency.setValueAtTime(baseFreq, when);
    filter.Q.setValueAtTime(1, when);

    const gain = this.context.createGain();
    const level = Math.max(0.05, Math.min(1, velocity / 127));
    const attack = 0.002;
    const release = Math.max(0.05, Math.min(0.35, duration));
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(level, when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + release);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.context.destination);

    source.start(when);
    source.stop(when + release + 0.05);

    return () => {
      try {
        source.stop();
      } catch {
        // Ignore double-stop errors.
      }
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  private createNoiseBuffer(): AudioBuffer {
    const buffer = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}
