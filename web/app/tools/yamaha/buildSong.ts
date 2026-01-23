import type { NoteEvent, TimeSignature } from '../lib/midi.js';
import type { StylePart } from './parseStyle.js';
import type { Ctb2Settings } from './parseCasm.js';

export type ChordSegment = {
  startTick: number;
  endTick: number;
  root: number;
  tones: number[];
};

function chordTonesForQuality(quality: string): number[] {
  const normalized = quality.trim().toLowerCase();
  if (normalized.startsWith('maj7') || normalized.startsWith('m7m') || normalized.includes('maj7')) {
    return [0, 4, 7, 11];
  }
  if (normalized.startsWith('min7') || normalized.startsWith('m7')) {
    return [0, 3, 7, 10];
  }
  if (normalized.startsWith('min') || normalized.startsWith('m')) {
    return [0, 3, 7];
  }
  if (normalized.startsWith('dim7')) {
    return [0, 3, 6, 9];
  }
  if (normalized.startsWith('dim')) {
    return [0, 3, 6];
  }
  if (normalized.startsWith('aug') || normalized.startsWith('+')) {
    return [0, 4, 8];
  }
  if (normalized.startsWith('sus4') || normalized.startsWith('sus')) {
    return [0, 5, 7];
  }
  if (normalized.startsWith('7') || normalized.includes('7')) {
    return [0, 4, 7, 10];
  }
  return [0, 4, 7];
}

function chordTonesForSymbol(symbol: string): number[] {
  const match = symbol.match(/^([A-Ga-g])([#b]?)(.*)$/);
  const quality = match?.[3] ?? '';
  return chordTonesForQuality(quality);
}

function chordTonesForTypeName(name: string | null | undefined): number[] | null {
  if (!name) {
    return null;
  }
  return chordTonesForQuality(name);
}

function normalizePitchClass(value: number): number {
  return ((value % 12) + 12) % 12;
}

function pitchClassDistance(a: number, b: number): number {
  const diff = Math.abs(normalizePitchClass(a - b));
  return Math.min(diff, 12 - diff);
}

function getLowerPitch(referencePitch: number, relPitch: number, acceptEquals: boolean): number {
  const refPc = normalizePitchClass(referencePitch);
  let pitch = Math.floor(referencePitch / 12) * 12 + relPitch;
  if ((relPitch === refPc && !acceptEquals) || relPitch > refPc) {
    pitch = (Math.floor(referencePitch / 12) - 1) * 12 + relPitch;
  }
  if (pitch < 0) {
    pitch += 12;
  }
  return pitch;
}

function getUpperPitch(referencePitch: number, relPitch: number, inclusive: boolean): number {
  const refPc = normalizePitchClass(referencePitch);
  let pitch = Math.floor(referencePitch / 12) * 12 + relPitch;
  if ((relPitch === refPc && !inclusive) || relPitch < refPc) {
    pitch = (Math.floor(referencePitch / 12) + 1) * 12 + relPitch;
  }
  if (pitch > 127) {
    pitch -= 12;
  }
  return pitch;
}

function getClosestPitch(referencePitch: number, relPitch: number): number {
  const up = getUpperPitch(referencePitch, relPitch, true);
  const low = getLowerPitch(referencePitch, relPitch, true);
  if (up - referencePitch > referencePitch - low) {
    return low;
  }
  return up;
}

function permute(values: number[]): number[][] {
  if (values.length <= 1) {
    return [values.slice()];
  }
  const result: number[][] = [];
  for (let i = 0; i < values.length; i += 1) {
    const rest = values.slice(0, i).concat(values.slice(i + 1));
    for (const tail of permute(rest)) {
      result.push([values[i], ...tail]);
    }
  }
  return result;
}

function uniquePermutations(values: number[]): number[][] {
  const permutations = permute(values);
  if (permutations.length <= 1) {
    return permutations;
  }
  const seen = new Set<string>();
  const unique: number[][] = [];
  for (const permutation of permutations) {
    const key = permutation.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(permutation);
    }
  }
  return unique;
}

function computeSkipOctaves(pitches: number[]): number[] {
  const result: number[] = [];
  let lastPitch = -1;
  for (const pitch of pitches) {
    if (result.length === 0) {
      result.push(0);
    } else {
      const pitchDelta = pitch - lastPitch;
      result.push(Math.floor(pitchDelta / 12));
    }
    lastPitch = pitch;
  }
  return result;
}

function computeParallelChord(
  sourcePitches: number[],
  sourceRelPcs: number[],
  uniqueRelPcs: number[],
  relPitches: number[],
  startBelow: boolean
): number[] {
  if (sourcePitches.length === 0) {
    return [];
  }
  if (relPitches.length !== uniqueRelPcs.length) {
    return [];
  }
  const skipOctaves = computeSkipOctaves(sourcePitches);
  const destPitches: number[] = [];
  const mapSave = new Map<number, number>();

  let destIndex = 0;
  const firstDestRel = relPitches[destIndex++];
  const firstPitch = startBelow
    ? getLowerPitch(sourcePitches[0], firstDestRel, true)
    : getUpperPitch(sourcePitches[0], firstDestRel, true);
  destPitches.push(firstPitch);
  mapSave.set(sourceRelPcs[0], firstDestRel);

  let lastPitch = firstPitch;
  for (let i = 1; i < sourcePitches.length; i += 1) {
    const srcRel = sourceRelPcs[i];
    let destRel = mapSave.get(srcRel);
    if (destRel === undefined) {
      destRel = relPitches[destIndex] ?? relPitches[relPitches.length - 1];
      destIndex += 1;
      mapSave.set(srcRel, destRel);
    }
    for (let j = 0; j <= skipOctaves[i]; j += 1) {
      lastPitch = getUpperPitch(lastPitch, destRel, false);
    }
    destPitches.push(lastPitch);
  }
  return destPitches;
}

function computeChordScore(sourcePitches: number[], destPitches: number[]): number {
  if (sourcePitches.length === 0 || sourcePitches.length !== destPitches.length) {
    return Number.POSITIVE_INFINITY;
  }
  let distance = 0;
  for (let i = 0; i < sourcePitches.length; i += 1) {
    distance += Math.abs(sourcePitches[i] - destPitches[i]);
  }
  const topDelta = Math.abs(sourcePitches[sourcePitches.length - 1] - destPitches[destPitches.length - 1]);
  const lowDelta = Math.abs(sourcePitches[0] - destPitches[0]);
  return distance + 3 * topDelta + lowDelta;
}

function findClosestIndex(value: number, candidates: number[]): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < candidates.length; i += 1) {
    const distance = pitchClassDistance(value, candidates[i]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function mapSourceDegreeToDestTone(sourceDegree: number, sourceTones: number[], destTones: number[]): number {
  if (destTones.length === 0) {
    return 0;
  }
  if (sourceTones.length === 0) {
    return destTones[0];
  }
  let srcIndex = sourceTones.indexOf(sourceDegree);
  if (srcIndex === -1) {
    srcIndex = findClosestIndex(sourceDegree, sourceTones);
  }
  if (destTones.length >= sourceTones.length) {
    return destTones[Math.min(srcIndex, destTones.length - 1)];
  }
  const srcTone = sourceTones[srcIndex];
  return destTones[findClosestIndex(srcTone, destTones)];
}

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
  sourceChordTypeByChannel: Map<number, string>;
  ctb2ByChannel: Map<number, Ctb2Settings>;
};

type SourceChordData = {
  pitches: number[];
  relPcs: number[];
  uniqueRelPcs: number[];
  sourceRoot: number;
  sourceTones: number[];
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
    sourceChordTypeByChannel,
    ctb2ByChannel,
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
          tones: [0, 4, 7, 10],
        },
      ];

  const isDrums = (channel: number) => channel === 8 || channel === 9;
  const defaultTones = chordTonesForSymbol('C7');

  const sourceChordData = new Map<number, SourceChordData>();
  const channelPitches = new Map<number, Set<number>>();
  for (const note of part.notes) {
    if (isDrums(note.channel)) {
      continue;
    }
    const bucket = channelPitches.get(note.channel) ?? new Set<number>();
    bucket.add(note.pitch);
    channelPitches.set(note.channel, bucket);
  }

  for (const [channel, bucket] of channelPitches.entries()) {
    const pitches = Array.from(bucket).sort((a, b) => a - b);
    const relPcs = pitches.map((pitch) => normalizePitchClass(pitch));
    const uniqueRelPcs: number[] = [];
    const seen = new Set<number>();
    for (const pc of relPcs) {
      if (!seen.has(pc)) {
        seen.add(pc);
        uniqueRelPcs.push(pc);
      }
    }
    const sourceRoot = normalizePitchClass(sourceChordByChannel.get(channel) ?? 0);
    const sourceTones = chordTonesForTypeName(sourceChordTypeByChannel.get(channel)) ?? defaultTones;
    sourceChordData.set(channel, {
      pitches,
      relPcs,
      uniqueRelPcs,
      sourceRoot,
      sourceTones,
    });
  }

  const getChordSegment = (tick: number) => {
    for (const segment of segments) {
      if (tick >= segment.startTick && tick < segment.endTick) {
        return segment;
      }
    }
    return segments[segments.length - 1] ?? { root: 0, tones: [0, 4, 7, 10], startTick: 0, endTick: totalTicks };
  };

  const chordModeCache = new Map<string, Map<number, number>>();
  const getChordModeMapping = (channel: number, segment: ChordSegment): Map<number, number> | null => {
    const key = `${channel}:${segment.startTick}:${segment.root}:${segment.tones.join(',')}`;
    const cached = chordModeCache.get(key);
    if (cached) {
      return cached;
    }
    const data = sourceChordData.get(channel);
    if (!data || data.pitches.length === 0 || data.uniqueRelPcs.length === 0) {
      return null;
    }
    const tones = segment.tones.length ? segment.tones : defaultTones;
    const sourceDegrees = data.uniqueRelPcs.map((pc) => normalizePitchClass(pc - data.sourceRoot));
    const destRelPitches = sourceDegrees.map((degree) =>
      normalizePitchClass(segment.root + mapSourceDegreeToDestTone(degree, data.sourceTones, tones))
    );
    const permutations = destRelPitches.length > 1 ? uniquePermutations(destRelPitches) : [destRelPitches];
    let bestChord: number[] | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const permutation of permutations) {
      const above = computeParallelChord(data.pitches, data.relPcs, data.uniqueRelPcs, permutation, false);
      const scoreAbove = computeChordScore(data.pitches, above);
      if (scoreAbove < bestScore) {
        bestScore = scoreAbove;
        bestChord = above;
      }

      const below = computeParallelChord(data.pitches, data.relPcs, data.uniqueRelPcs, permutation, true);
      const scoreBelow = computeChordScore(data.pitches, below);
      if (scoreBelow < bestScore) {
        bestScore = scoreBelow;
        bestChord = below;
      }
    }

    if (!bestChord || bestChord.length === 0) {
      return null;
    }

    const mapping = new Map<number, number>();
    for (let i = 0; i < data.pitches.length && i < bestChord.length; i += 1) {
      mapping.set(data.pitches[i], bestChord[i]);
    }
    chordModeCache.set(key, mapping);
    return mapping;
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
        const segment = getChordSegment(segmentStart);
        const ctb2 = ctb2ByChannel.get(note.channel);
        const targetRoot = normalizePitchClass(segment.root);
        const sourceRoot = normalizePitchClass(sourceChordByChannel.get(note.channel) ?? 0);
        const tones = segment.tones.length ? segment.tones : defaultTones;

        let pitch = note.pitch;
        if (!isDrums(destChannel)) {
          const isChordMode =
            ctb2 !== undefined &&
            (ctb2.ntr === 1 || ctb2.ntr === 2 || (ctb2.ntr === 0 && ctb2.ntt === 2));

          if (isChordMode) {
            const mapping = getChordModeMapping(note.channel, segment);
            const mapped = mapping?.get(note.pitch);
            if (mapped !== undefined) {
              pitch = mapped;
            }
          } else if (ctb2 && ctb2.ntr === 0 && ctb2.ntt !== 0) {
            const sourceTones = chordTonesForTypeName(sourceChordTypeByChannel.get(note.channel)) ?? defaultTones;
            const srcRelPitch = normalizePitchClass(note.pitch - sourceRoot);
            const destTone = mapSourceDegreeToDestTone(srcRelPitch, sourceTones, tones);
            const destRelPitch = normalizePitchClass(targetRoot + destTone);
            const rootDelta = normalizePitchClass(targetRoot - sourceRoot);
            const basePitch = note.pitch + rootDelta;
            pitch = getClosestPitch(basePitch, destRelPitch);
          } else {
            pitch = note.pitch + (targetRoot - sourceRoot);
          }

          if (!isChordMode && ctb2?.ntr === 0 && targetRoot > normalizePitchClass(ctb2.chordRootUpper)) {
            pitch -= 12;
          }
        }

        if (ctb2) {
          while (pitch > ctb2.noteHigh) {
            pitch -= 12;
          }
          while (pitch < ctb2.noteLow) {
            pitch += 12;
          }
          pitch = Math.max(0, Math.min(127, pitch));
        }
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
