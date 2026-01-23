import { parseMidiData, getTempoFromTrack, getTimeSignatureFromTrack, NoteEvent } from '../lib/midi.js';
import { parseCasmFromBuffer } from './parseCasm.js';

export type StylePart = {
  id: string;
  marker: string;
  startTick: number;
  lengthTicks: number;
  notes: NoteEvent[];
};

export type ParsedStyle = {
  ticksPerBeat: number;
  tempo: number;
  timeSignature: { numerator: number; denominator: number } | null;
  parts: StylePart[];
  channelMap: Map<number, number>;
  sourceChordByChannel: Map<number, number>;
};

type MidiEvent = Record<string, unknown> & {
  deltaTime: number;
  type?: string;
  meta?: boolean;
  text?: string;
  channel?: number;
  noteNumber?: number;
  velocity?: number;
};

export function normalizeStylePartName(name: string): string {
  return name.trim().replace(/\s+/g, '_').toLowerCase();
}

export function parseStyleFromBuffer(buffer: Buffer): ParsedStyle {
  const midi = parseMidiData(buffer);
  const ticksPerBeat = midi.header.ticksPerBeat ?? 480;
  const track = midi.tracks[0] ?? [];
  const tempo = getTempoFromTrack(track) ?? 500000;
  const timeSignature = getTimeSignatureFromTrack(track);
  const casmInfo = parseCasmFromBuffer(buffer);
  const channelMap = casmInfo?.channelMap ?? new Map<number, number>();
  const sourceChordByChannel = casmInfo?.sourceChordByChannel ?? new Map<number, number>();

  const parts: StylePart[] = [];
  let currentPart: StylePart | null = null;
  let partStartTick = 0;
  let tick = 0;

  const activeNotes = new Map<string, { startTick: number; velocity: number }>();

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

    if (event.type !== 'noteOn' && event.type !== 'noteOff') {
      continue;
    }

    if (!currentPart) {
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
      currentPart.notes.push({
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
    channelMap,
    sourceChordByChannel,
  };
}
