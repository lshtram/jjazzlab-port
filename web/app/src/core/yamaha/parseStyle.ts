import { parseMidiData, getTempoFromTrack, getTimeSignatureFromTrack } from '../midi.js';
import type { NoteEvent } from '../midi.js';
import { parseCasmFromBuffer } from './parseCasm.js';
import type { CasmByPart, CasmInfo, Ctb2Settings } from './parseCasm.js';

export type ProgramChange = {
  program: number;
  bankMsb?: number;
  bankLsb?: number;
};

export type StylePart = {
  id: string;
  marker: string;
  startTick: number;
  lengthTicks: number;
  notes: NoteEvent[];
  programsByChannel: Map<number, ProgramChange>;
};

export type ParsedStyle = {
  ticksPerBeat: number;
  tempo: number;
  timeSignature: { numerator: number; denominator: number } | null;
  parts: StylePart[];
  casmByPart: CasmByPart;
  defaultCasmInfo: CasmInfo;
  sffType: 'SFF1' | 'SFF2' | null;
  megaVoiceChannels: Set<number>;
};

type MidiEvent = Record<string, unknown> & {
  deltaTime: number;
  type?: string;
  meta?: boolean;
  text?: string;
  channel?: number;
  noteNumber?: number;
  velocity?: number;
  programNumber?: number;
  controllerType?: number;
  value?: number;
};

function parseMegaVoiceChannels(track: MidiEvent[]): Set<number> {
  const result = new Set<number>();
  const bankMsbByChannel = new Map<number, number>();
  let insideSInt = false;

  for (const event of track) {
    if (event.meta && event.type === 'marker' && typeof event.text === 'string') {
      insideSInt = event.text === 'SInt';
      continue;
    }

    if (!insideSInt) {
      continue;
    }

    const channel = typeof event.channel === 'number' ? event.channel : null;
    if (channel === null) {
      continue;
    }

    if (event.type === 'controller') {
      if (event.controllerType === 0 && typeof event.value === 'number') {
        bankMsbByChannel.set(channel, event.value);
      }
      continue;
    }

    if (event.type === 'programChange') {
      const msb = bankMsbByChannel.get(channel) ?? 0;
      if (msb === 8) {
        result.add(channel);
      }
    }
  }

  return result;
}

export function normalizeStylePartName(name: string): string {
  return name.trim().replace(/\s+/g, '_').toLowerCase();
}

export function parseStyleFromBuffer(buffer: Uint8Array): ParsedStyle {
  const midi = parseMidiData(buffer);
  const ticksPerBeat = midi.header.ticksPerBeat ?? 480;
  const track = midi.tracks[0] ?? [];
  const tempo = getTempoFromTrack(track) ?? 500000;
  const timeSignature = getTimeSignatureFromTrack(track);
  const megaVoiceChannels = parseMegaVoiceChannels(track as MidiEvent[]);
  let sffType: 'SFF1' | 'SFF2' | null = null;
  for (const event of track as MidiEvent[]) {
    if (event.meta && event.type === 'marker' && typeof event.text === 'string') {
      if (event.text === 'SFF1' || event.text === 'SFF2') {
        sffType = event.text as 'SFF1' | 'SFF2';
        break;
      }
    }
  }

  const casmByPart = parseCasmFromBuffer(buffer, sffType) ?? new Map<string, CasmInfo>();
  const defaultCasmInfo =
    casmByPart.values().next().value ??
    ({
      channelMap: new Map<number, number>(),
      sourceChordByChannel: new Map<number, number>(),
      sourceChordTypeByChannel: new Map<number, string>(),
      ctb2ByChannel: new Map<number, Ctb2Settings>(),
      mutedNotesByChannel: new Map<number, Set<number>>(),
      mutedChordsByChannel: new Map<number, Set<string>>(),
      cnttByChannel: new Map<number, { ntt: number; bassOn: boolean }>(),
    } as CasmInfo);

  const parts: StylePart[] = [];
  let currentPart: StylePart | null = null;
  let partStartTick = 0;
  let tick = 0;

  const activeNotes = new Map<string, { startTick: number; velocity: number }>();
  const currentPrograms = new Map<number, ProgramChange>();
  const currentBankMsb = new Map<number, number>();
  const currentBankLsb = new Map<number, number>();

  const finalizePart = (endTick: number) => {
    if (!currentPart) {
      return;
    }
    const length = endTick - partStartTick;
    currentPart.lengthTicks = Math.max(0, length);
  };

  const startPart = (marker: string, startTick: number) => {
    const id = normalizeStylePartName(marker);
    currentPart = {
      id,
      marker,
      startTick,
      lengthTicks: 0,
      notes: [],
      programsByChannel: new Map(currentPrograms),
    };
    partStartTick = startTick;
    parts.push(currentPart);
  };

  for (const event of track as MidiEvent[]) {
    tick += event.deltaTime ?? 0;

    if (event.meta && event.type === 'marker' && typeof event.text === 'string') {
      finalizePart(tick);
      startPart(event.text, tick);
      continue;
    }

    if (event.type === 'controller') {
      const channel = typeof event.channel === 'number' ? event.channel : null;
      const controllerType = typeof event.controllerType === 'number' ? event.controllerType : null;
      const value = typeof event.value === 'number' ? event.value : null;
      if (channel !== null && controllerType !== null && value !== null) {
        if (controllerType === 0) {
          currentBankMsb.set(channel, value);
        } else if (controllerType === 32) {
          currentBankLsb.set(channel, value);
        }
      }
      continue;
    }

    if (event.type === 'programChange') {
      const channel = typeof event.channel === 'number' ? event.channel : null;
      const program = typeof event.programNumber === 'number' ? event.programNumber : null;
      if (channel !== null && program !== null) {
        const change: ProgramChange = {
          program,
          bankMsb: currentBankMsb.get(channel),
          bankLsb: currentBankLsb.get(channel),
        };
        currentPrograms.set(channel, change);
        const part = currentPart as StylePart | null;
        if (part) {
          part.programsByChannel.set(channel, change);
        }
      }
      continue;
    }

    if (event.type !== 'noteOn' && event.type !== 'noteOff') {
      continue;
    }

    const part = currentPart as StylePart | null;
    if (!part) {
      continue;
    }

    const channel = typeof event.channel === 'number' ? event.channel : null;
    const pitch = typeof event.noteNumber === 'number' ? event.noteNumber : null;
    const velocity = typeof event.velocity === 'number' ? event.velocity : null;
    if (channel === null || pitch === null || velocity === null) {
      continue;
    }

    const key = `${channel}:${pitch}`;
    const isNoteOn = event.type === 'noteOn' && velocity > 0;
    const isNoteOff = event.type === 'noteOff' || (event.type === 'noteOn' && velocity === 0);

    if (isNoteOn) {
      activeNotes.set(key, { startTick: tick, velocity });
      continue;
    }

    if (isNoteOff) {
      const start = activeNotes.get(key);
      if (!start) {
        continue;
      }
      activeNotes.delete(key);
      if (start.startTick < partStartTick) {
        continue;
      }
      const duration = tick - start.startTick;
      if (duration <= 0) {
        continue;
      }
      part.notes.push({
        channel,
        pitch,
        velocity: start.velocity,
        startTick: start.startTick - partStartTick,
        duration,
      });
    }
  }

  finalizePart(tick);

  return {
    ticksPerBeat,
    tempo,
    timeSignature,
    parts,
    casmByPart,
    defaultCasmInfo,
    sffType,
    megaVoiceChannels,
  };
}
