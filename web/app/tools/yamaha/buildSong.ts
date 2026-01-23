import type { NoteEvent, TimeSignature } from '../lib/midi.js';
import type { StylePart } from './parseStyle.js';

type BuildSongOptions = {
  bars: number;
  inputTicksPerBeat: number;
  outputTicksPerBeat: number;
  tempo: number;
  timeSignature: TimeSignature;
  part: StylePart;
};

export function buildSongFromStylePart(options: BuildSongOptions): {
  notes: NoteEvent[];
  totalTicks: number;
} {
  const { bars, inputTicksPerBeat, outputTicksPerBeat, timeSignature, part } = options;
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

  let baseTick = 0;
  while (baseTick < totalTicks) {
    for (const note of part.notes) {
      const startTick = baseTick + Math.round(note.startTick * scale);
      if (startTick >= totalTicks) {
        continue;
      }
      const duration = Math.min(Math.round(note.duration * scale), totalTicks - startTick);
      if (duration <= 0) {
        continue;
      }
      notes.push({
        channel: note.channel,
        pitch: note.pitch,
        velocity: note.velocity,
        startTick,
        duration,
      });
    }
    baseTick += partLengthTicks;
  }

  return { notes, totalTicks };
}
