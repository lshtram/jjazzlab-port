import type { NoteEvent, TimeSignature } from '../lib/midi.js';
import type { StylePart } from './parseStyle.js';

export type ChordSegment = {
  startTick: number;
  endTick: number;
  root: number;
};

type BuildSongOptions = {
  bars: number;
  inputTicksPerBeat: number;
  outputTicksPerBeat: number;
  tempo: number;
  timeSignature: TimeSignature;
  part: StylePart;
  chordTimeline: ChordSegment[];
  channelMap: Map<number, number>;
  sourceChordByChannel: Map<number, number>;
};

export function buildSongFromStylePart(options: BuildSongOptions): {
  notes: NoteEvent[];
  totalTicks: number;
} {
  const {
    bars,
    inputTicksPerBeat,
    outputTicksPerBeat,
    timeSignature,
    part,
    chordTimeline,
    channelMap,
    sourceChordByChannel,
  } = options;
  const beatsPerBar = (timeSignature.numerator * 4) / timeSignature.denominator;
  const totalBeats = bars * beatsPerBar;
  const totalTicks = Math.round(totalBeats * outputTicksPerBeat);
  const scale = outputTicksPerBeat / inputTicksPerBeat;
  const partLengthTicks =
    part.lengthTicks > 0 ? Math.round(part.lengthTicks * scale) : Math.round(beatsPerBar * outputTicksPerBeat);
  const notes: NoteEvent[] = [];
  if (partLengthTicks <= 0) {
    return { notes, totalTicks };
  }

  const segments = chordTimeline.length
    ? chordTimeline
    : [
        {
          startTick: 0,
          endTick: totalTicks,
          root: 0,
        },
      ];

  const isDrums = (channel: number) => channel === 8 || channel === 9;

  const getChordRoot = (tick: number) => {
    for (const segment of segments) {
      if (tick >= segment.startTick && tick < segment.endTick) {
        return segment.root;
      }
    }
    return segments[segments.length - 1]?.root ?? 0;
  };

  let baseTick = 0;
  while (baseTick < totalTicks) {
    for (const note of part.notes) {
      const noteStart = baseTick + Math.round(note.startTick * scale);
      const noteEnd = Math.min(noteStart + Math.round(note.duration * scale), totalTicks);
      if (noteStart >= totalTicks || noteEnd <= noteStart) {
        continue;
      }

      const boundaries: number[] = [];
      for (const segment of segments) {
        if (segment.startTick > noteStart && segment.startTick < noteEnd) {
          boundaries.push(segment.startTick);
        }
      }

      let segmentStart = noteStart;
      const segmentStops = [...boundaries, noteEnd];
      for (const stop of segmentStops) {
        const duration = stop - segmentStart;
        if (duration <= 0) {
          segmentStart = stop;
          continue;
        }

        const destChannel = channelMap.get(note.channel) ?? note.channel;
        const sourceRoot = sourceChordByChannel.get(note.channel) ?? 0;
        const targetRoot = getChordRoot(segmentStart);
        const transpose = isDrums(destChannel) ? 0 : targetRoot - sourceRoot;
        let pitch = note.pitch + transpose;
        pitch = Math.max(0, Math.min(127, pitch));

        notes.push({
          channel: destChannel,
          pitch,
          velocity: note.velocity,
          startTick: segmentStart,
          duration,
        });
        segmentStart = stop;
      }
    }
    baseTick += partLengthTicks;
  }

  return { notes, totalTicks };
}
