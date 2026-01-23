import type { NoteEvent, TimeSignature } from '../midi.js';
import { chordTonesForSymbol, chordTonesForTypeName, normalizePitchClass } from '../harmony.js';
import type { ChordSegment } from '../song.js';
import type { StylePart } from './parseStyle.js';
import type { Ctb2Settings } from './parseCasm.js';

export type { ChordSegment } from '../song.js';

export type NoteMapping = {
  sourceChannel: number;
  destChannel: number;
  sourcePitch: number;
  destPitch: number;
  sourceRelPitch: number;
  destRelPitch: number;
  sourceDegree: DegreeName;
  destDegree: DegreeName;
  mapping: 'chord' | 'melody' | 'root';
  startTick: number;
  duration: number;
  segment: { startTick: number; endTick: number; symbol: string };
  sourceRoot: number;
  targetRoot: number;
  ctb2?: {
    ntr: number;
    ntt: number;
    bassOn: boolean;
    chordRootUpper: number;
    noteLow: number;
    noteHigh: number;
    rtr: number;
  };
};

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

type DegreeNatural =
  | 'ROOT'
  | 'THIRD'
  | 'FOURTH'
  | 'FIFTH'
  | 'SIXTH'
  | 'SEVENTH'
  | 'NINTH'
  | 'ELEVENTH'
  | 'THIRTEENTH';

type DegreeName =
  | 'ROOT'
  | 'NINTH_FLAT'
  | 'NINTH'
  | 'NINTH_SHARP'
  | 'THIRD_FLAT'
  | 'THIRD'
  | 'FOURTH_OR_ELEVENTH'
  | 'ELEVENTH_SHARP'
  | 'FIFTH_FLAT'
  | 'FIFTH'
  | 'FIFTH_SHARP'
  | 'THIRTEENTH_FLAT'
  | 'SIXTH_OR_THIRTEENTH'
  | 'SEVENTH_FLAT'
  | 'SEVENTH';

const DEGREE_DEFS: Record<DegreeName, { pitch: number; natural: DegreeNatural; accidental: number }> = {
  ROOT: { pitch: 0, natural: 'ROOT', accidental: 0 },
  NINTH_FLAT: { pitch: 1, natural: 'NINTH', accidental: -1 },
  NINTH: { pitch: 2, natural: 'NINTH', accidental: 0 },
  NINTH_SHARP: { pitch: 3, natural: 'NINTH', accidental: 1 },
  THIRD_FLAT: { pitch: 3, natural: 'THIRD', accidental: -1 },
  THIRD: { pitch: 4, natural: 'THIRD', accidental: 0 },
  FOURTH_OR_ELEVENTH: { pitch: 5, natural: 'FOURTH', accidental: 0 },
  ELEVENTH_SHARP: { pitch: 6, natural: 'ELEVENTH', accidental: 1 },
  FIFTH_FLAT: { pitch: 6, natural: 'FIFTH', accidental: -1 },
  FIFTH: { pitch: 7, natural: 'FIFTH', accidental: 0 },
  FIFTH_SHARP: { pitch: 8, natural: 'FIFTH', accidental: 1 },
  THIRTEENTH_FLAT: { pitch: 8, natural: 'THIRTEENTH', accidental: -1 },
  SIXTH_OR_THIRTEENTH: { pitch: 9, natural: 'SIXTH', accidental: 0 },
  SEVENTH_FLAT: { pitch: 10, natural: 'SEVENTH', accidental: -1 },
  SEVENTH: { pitch: 11, natural: 'SEVENTH', accidental: 0 },
};

type ChordFamily = 'major' | 'minor' | 'seventh' | 'diminished' | 'sus' | 'other';

type ChordProfile = {
  family: ChordFamily;
  isMajor: boolean;
  extension: string;
  degreesByNatural: Map<DegreeNatural, DegreeName>;
  degreesByPitch: Map<number, DegreeName>;
};

function degreeMostProbable(relPitch: number, isMajor: boolean): DegreeName {
  switch (normalizePitchClass(relPitch)) {
    case 0:
      return 'ROOT';
    case 1:
      return 'NINTH_FLAT';
    case 2:
      return 'NINTH';
    case 3:
      return isMajor ? 'NINTH_SHARP' : 'THIRD_FLAT';
    case 4:
      return 'THIRD';
    case 5:
      return 'FOURTH_OR_ELEVENTH';
    case 6:
      return 'ELEVENTH_SHARP';
    case 7:
      return 'FIFTH';
    case 8:
      return 'THIRTEENTH_FLAT';
    case 9:
      return 'SIXTH_OR_THIRTEENTH';
    case 10:
      return 'SEVENTH_FLAT';
    case 11:
      return 'SEVENTH';
    default:
      return 'ROOT';
  }
}

function buildChordProfile(quality: string): ChordProfile {
  const normalized = quality.trim().toLowerCase();
  const isMinor = /^(min|m)(?!aj)/.test(normalized);
  const hasSus = normalized.includes('sus');
  const hasDim = normalized.includes('dim');
  const hasMaj = normalized.includes('maj');
  const hasSeventh = normalized.includes('7');
  const isMajor = hasMaj || (!isMinor && !hasDim && !hasSus);

  let family: ChordFamily = 'major';
  if (hasSus) {
    family = 'sus';
  } else if (hasDim) {
    family = 'diminished';
  } else if (isMinor) {
    family = 'minor';
  } else if (hasSeventh) {
    family = 'seventh';
  }

  const degreesByNatural = new Map<DegreeNatural, DegreeName>();
  const degreesByPitch = new Map<number, DegreeName>();
  const addDegree = (natural: DegreeNatural, degree: DegreeName) => {
    degreesByNatural.set(natural, degree);
    if (!degreesByPitch.has(DEGREE_DEFS[degree].pitch)) {
      degreesByPitch.set(DEGREE_DEFS[degree].pitch, degree);
    }
  };

  addDegree('ROOT', 'ROOT');

  if (hasSus) {
    addDegree('FOURTH', 'FOURTH_OR_ELEVENTH');
  } else if (isMinor) {
    addDegree('THIRD', 'THIRD_FLAT');
  } else {
    addDegree('THIRD', 'THIRD');
  }

  let fifthDegree: DegreeName = 'FIFTH';
  if (normalized.includes('b5') || normalized.startsWith('dim')) {
    fifthDegree = 'FIFTH_FLAT';
  } else if (
    normalized.includes('#5') ||
    normalized.includes('aug') ||
    normalized.includes('+') ||
    normalized.includes('b13')
  ) {
    fifthDegree = 'FIFTH_SHARP';
  }
  addDegree('FIFTH', fifthDegree);

  const hasDim7 = normalized.includes('dim7');
  const hasMaj7 = normalized.includes('maj7') || normalized.includes('m7m') || normalized.includes('minmaj7');
  if (hasDim7) {
    addDegree('SIXTH', 'SIXTH_OR_THIRTEENTH');
  } else if (hasMaj7) {
    addDegree('SEVENTH', 'SEVENTH');
  } else if (hasSeventh) {
    addDegree('SEVENTH', 'SEVENTH_FLAT');
  }

  if (normalized.includes('6') || normalized.includes('13')) {
    addDegree('SIXTH', 'SIXTH_OR_THIRTEENTH');
  }

  if (normalized.includes('b9')) {
    addDegree('NINTH', 'NINTH_FLAT');
  } else if (normalized.includes('#9')) {
    addDegree('NINTH', 'NINTH_SHARP');
  } else if (normalized.includes('9')) {
    addDegree('NINTH', 'NINTH');
  }

  if (normalized.includes('#11')) {
    addDegree('ELEVENTH', 'ELEVENTH_SHARP');
  } else if (normalized.includes('11') || hasSus) {
    addDegree('ELEVENTH', 'FOURTH_OR_ELEVENTH');
  }

  if (normalized.includes('b13') && !normalized.includes('#5')) {
    addDegree('THIRTEENTH', 'THIRTEENTH_FLAT');
  } else if (normalized.includes('13')) {
    addDegree('THIRTEENTH', 'SIXTH_OR_THIRTEENTH');
  }

  return {
    family,
    isMajor,
    extension: normalized,
    degreesByNatural,
    degreesByPitch,
  };
}

function fitDegree(profile: ChordProfile, degree: DegreeName): DegreeName | null {
  const natural = DEGREE_DEFS[degree].natural;
  const direct = profile.degreesByNatural.get(natural);
  if (direct) {
    if (natural === 'SEVENTH' && profile.extension.includes('6')) {
      return 'SIXTH_OR_THIRTEENTH';
    }
    return direct;
  }
  const byPitch = profile.degreesByPitch.get(DEGREE_DEFS[degree].pitch);
  if (byPitch) {
    return byPitch;
  }
  if (profile.extension.includes('6') && natural === 'SEVENTH') {
    return 'SIXTH_OR_THIRTEENTH';
  }
  if (profile.degreesByNatural.has('SEVENTH') && natural === 'SIXTH') {
    return profile.degreesByNatural.get('SEVENTH') ?? null;
  }
  return null;
}

function fitDegreeAdvanced(profile: ChordProfile, degree: DegreeName): DegreeName {
  const direct = fitDegree(profile, degree);
  if (direct) {
    return direct;
  }
  switch (degree) {
    case 'NINTH_FLAT':
    case 'NINTH':
    case 'NINTH_SHARP':
      if (profile.extension.includes('m7b5') || profile.extension.includes('m9b5')) {
        return 'NINTH_FLAT';
      }
      return 'NINTH';
    case 'THIRD_FLAT':
    case 'THIRD':
      return 'FOURTH_OR_ELEVENTH';
    case 'FOURTH_OR_ELEVENTH':
      if (profile.family === 'minor' || profile.family === 'diminished') {
        return 'FOURTH_OR_ELEVENTH';
      }
      if (profile.degreesByPitch.has(6)) {
        return 'ELEVENTH_SHARP';
      }
      return 'FOURTH_OR_ELEVENTH';
    case 'ELEVENTH_SHARP':
      if (profile.family === 'sus') {
        return 'FOURTH_OR_ELEVENTH';
      }
      return profile.degreesByNatural.get('FIFTH') ?? 'FIFTH';
    case 'THIRTEENTH_FLAT':
      return profile.degreesByNatural.get('FIFTH') ?? 'FIFTH';
    case 'SIXTH_OR_THIRTEENTH':
      if (profile.extension.includes('m7b5') || profile.extension.includes('m9b5')) {
        return 'THIRTEENTH_FLAT';
      }
      if (profile.degreesByPitch.has(8)) {
        return profile.degreesByPitch.get(8) ?? 'SIXTH_OR_THIRTEENTH';
      }
      return 'SIXTH_OR_THIRTEENTH';
    case 'SEVENTH_FLAT':
      if (profile.family === 'major' && profile.degreesByNatural.has('SIXTH')) {
        return 'SEVENTH';
      }
      if (profile.extension.includes('dim7')) {
        return 'SIXTH_OR_THIRTEENTH';
      }
      return 'SEVENTH_FLAT';
    case 'SEVENTH':
      if (profile.family === 'sus') {
        return 'SEVENTH_FLAT';
      }
      if (profile.family === 'minor' && !profile.degreesByNatural.has('SIXTH')) {
        return 'SEVENTH_FLAT';
      }
      if (profile.family === 'diminished') {
        return profile.degreesByNatural.has('SIXTH') ? 'SIXTH_OR_THIRTEENTH' : 'SEVENTH_FLAT';
      }
      return 'SEVENTH';
    default:
      return degree;
  }
}

function extractChordQuality(symbol: string): string {
  const match = symbol.match(/^([A-Ga-g])([#b]?)([^/]*)/);
  return match?.[3] ?? '';
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
  onNote?: (info: NoteMapping) => void;
};

type SourceChordData = {
  pitches: number[];
  relPcs: number[];
  uniqueRelPcs: number[];
  sourceRoot: number;
  sourceTones: number[];
  profile: ChordProfile;
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
    onNote,
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
          symbol: 'C7',
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
    const sourceChordName = sourceChordTypeByChannel.get(channel) ?? '';
    const sourceTones = chordTonesForTypeName(sourceChordName) ?? defaultTones;
    const profile = buildChordProfile(sourceChordName);
    sourceChordData.set(channel, {
      pitches,
      relPcs,
      uniqueRelPcs,
      sourceRoot,
      sourceTones,
      profile,
    });
  }

  const getChordSegment = (tick: number) => {
    for (const segment of segments) {
      if (tick >= segment.startTick && tick < segment.endTick) {
        return segment;
      }
    }
    return (
      segments[segments.length - 1] ?? {
        root: 0,
        tones: [0, 4, 7, 10],
        symbol: 'C7',
        startTick: 0,
        endTick: totalTicks,
      }
    );
  };

  const chordModeCache = new Map<string, Map<number, number>>();
  const destProfileCache = new Map<string, ChordProfile>();
  const getDestProfile = (segment: ChordSegment): ChordProfile => {
    const key = segment.symbol ?? `${segment.root}:${segment.tones.join(',')}`;
    const cached = destProfileCache.get(key);
    if (cached) {
      return cached;
    }
    const quality = extractChordQuality(segment.symbol ?? '');
    const profile = buildChordProfile(quality);
    destProfileCache.set(key, profile);
    return profile;
  };
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
    const destProfile = getDestProfile(segment);
    const sourceDegrees = data.uniqueRelPcs.map((pc) =>
      degreeMostProbable(normalizePitchClass(pc - data.sourceRoot), data.profile.isMajor)
    );
    const destRelPitches = sourceDegrees.map((degree) =>
      normalizePitchClass(segment.root + DEGREE_DEFS[fitDegreeAdvanced(destProfile, degree)].pitch)
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

        let pitch = note.pitch;
        const data = sourceChordData.get(note.channel);
        const sourceProfile = data?.profile ?? buildChordProfile('');
        const srcRelPitch = normalizePitchClass(note.pitch - sourceRoot);
        const srcDegree = degreeMostProbable(srcRelPitch, sourceProfile.isMajor);
        const destProfile = getDestProfile(segment);
        let destDegree: DegreeName = srcDegree;
        let mapping: 'chord' | 'melody' | 'root' = 'root';

        if (!isDrums(destChannel)) {
          const isChordMode = ctb2 !== undefined && (ctb2.ntr === 1 || ctb2.ntr === 2);
          const isMelodyMode = ctb2 !== undefined && ctb2.ntr === 0 && ctb2.ntt !== 0;

          if (isChordMode) {
            mapping = 'chord';
            destDegree = fitDegreeAdvanced(destProfile, srcDegree);
            const chordMapping = getChordModeMapping(note.channel, segment);
            const mapped = chordMapping?.get(note.pitch);
            if (mapped !== undefined) {
              pitch = mapped;
            }
          } else if (isMelodyMode) {
            mapping = 'melody';
            destDegree = fitDegreeAdvanced(destProfile, srcDegree);
            const destRelPitch = normalizePitchClass(targetRoot + DEGREE_DEFS[destDegree].pitch);
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

        const destRelPitch = normalizePitchClass(pitch - targetRoot);
        if (mapping === 'root') {
          destDegree = degreeMostProbable(destRelPitch, destProfile.isMajor);
        }

        notes.push({
          channel: destChannel,
          pitch,
          velocity: note.velocity,
          startTick: segmentStart,
          duration,
        });
        if (onNote) {
          onNote({
            sourceChannel: note.channel,
            destChannel,
            sourcePitch: note.pitch,
            destPitch: pitch,
            sourceRelPitch: srcRelPitch,
            destRelPitch,
            sourceDegree: srcDegree,
            destDegree,
            mapping,
            startTick: segmentStart,
            duration,
            segment: {
              startTick: segment.startTick,
              endTick: segment.endTick,
              symbol: segment.symbol,
            },
            sourceRoot,
            targetRoot,
            ctb2: ctb2
              ? {
                  ntr: ctb2.ntr,
                  ntt: ctb2.ntt,
                  bassOn: ctb2.bassOn,
                  chordRootUpper: ctb2.chordRootUpper,
                  noteLow: ctb2.noteLow,
                  noteHigh: ctb2.noteHigh,
                  rtr: ctb2.rtr,
                }
              : undefined,
          });
        }
        segmentStart = stop;
      }
    }
    baseTick += partLengthTicks;
  }

  return { notes, totalTicks };
}
