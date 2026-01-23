import { buildMidiFile } from './midi.js';
import type { NoteEvent, ProgramChangeEvent, TimeSignature } from './midi.js';
import { buildChordTimeline, parseChordChart, ticksPerBarFromTimeSignature } from './song.js';
import type { ChordSegment } from './song.js';
import { buildSongFromStylePart } from './yamaha/buildSong.js';
import { normalizeStylePartName, parseStyleFromBuffer } from './yamaha/parseStyle.js';
import type { ProgramChange } from './yamaha/parseStyle.js';

export type RenderOptions = {
  part: string;
  bars?: number;
  chordChart?: string;
  chordTimeline?: ChordSegment[];
  tempo?: number;
  outputTicksPerBeat?: number;
};

export type RenderedSong = {
  notes: NoteEvent[];
  totalTicks: number;
  ticksPerBeat: number;
  tempo: number;
  timeSignature: TimeSignature;
  programsByChannel: Map<number, ProgramChange>;
};

function tempoToMicroseconds(tempo?: number, fallback?: number): number {
  if (!tempo || Number.isNaN(tempo) || tempo <= 0) {
    return fallback ?? 500000;
  }
  return Math.round(60_000_000 / tempo);
}

export function renderStyleToNotes(styleData: Uint8Array, options: RenderOptions): RenderedSong {
  const parsed = parseStyleFromBuffer(styleData);
  const partId = normalizeStylePartName(options.part);
  const part = parsed.parts.find((item) => item.id === partId);
  if (!part) {
    const available = parsed.parts.map((item) => item.marker).join(', ');
    throw new Error(`Style part "${options.part}" not found. Available markers: ${available}`);
  }

  const timeSignature: TimeSignature = parsed.timeSignature ?? { numerator: 4, denominator: 4 };
  const outputTicksPerBeat = options.outputTicksPerBeat ?? 960;
  const tempo = tempoToMicroseconds(options.tempo, parsed.tempo);

  let chordTimeline = options.chordTimeline;
  let bars = options.bars ?? 0;

  if (!chordTimeline) {
    const chart = parseChordChart(options.chordChart ?? 'C7');
    bars = bars || chart.bars.length || 1;
    const ticksPerBar = ticksPerBarFromTimeSignature(timeSignature, outputTicksPerBeat);
    chordTimeline = buildChordTimeline({
      chart,
      totalBars: bars,
      ticksPerBar,
    });
  }

  if (!bars) {
    const ticksPerBar = ticksPerBarFromTimeSignature(timeSignature, outputTicksPerBeat);
    bars = Math.max(1, Math.round((chordTimeline[chordTimeline.length - 1]?.endTick ?? ticksPerBar) / ticksPerBar));
  }

  const { notes, totalTicks } = buildSongFromStylePart({
    bars,
    inputTicksPerBeat: parsed.ticksPerBeat,
    outputTicksPerBeat,
    tempo,
    timeSignature,
    part,
    chordTimeline,
    channelMap: parsed.channelMap,
    sourceChordByChannel: parsed.sourceChordByChannel,
    sourceChordTypeByChannel: parsed.sourceChordTypeByChannel,
    ctb2ByChannel: parsed.ctb2ByChannel,
  });

  const programsByChannel = new Map<number, ProgramChange>();
  for (const [srcChannel, change] of part.programsByChannel.entries()) {
    const destChannel = parsed.channelMap.get(srcChannel) ?? srcChannel;
    programsByChannel.set(destChannel, change);
  }

  return {
    notes,
    totalTicks,
    ticksPerBeat: outputTicksPerBeat,
    tempo,
    timeSignature,
    programsByChannel,
  };
}

export function renderStyleToMidi(styleData: Uint8Array, options: RenderOptions): Uint8Array {
  const rendered = renderStyleToNotes(styleData, options);
  const programChanges: ProgramChangeEvent[] = [];
  for (const [channel, change] of rendered.programsByChannel.entries()) {
    programChanges.push({
      tick: 0,
      channel,
      program: change.program,
      bankMsb: change.bankMsb,
      bankLsb: change.bankLsb,
    });
  }

  return buildMidiFile({
    ticksPerBeat: rendered.ticksPerBeat,
    tempo: rendered.tempo,
    timeSignature: rendered.timeSignature,
    notes: rendered.notes,
    formatType: 1,
    trackName: 'JJazzLab style render',
    endTick: rendered.totalTicks + 1,
    programChanges,
  });
}
