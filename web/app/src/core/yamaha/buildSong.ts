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

function computeChordScore(
  sourcePitches: number[],
  destPitches: number[],
  destInfo?: ChordTypeInfo,
  destRoot?: number
): number {
  if (sourcePitches.length === 0 || sourcePitches.length !== destPitches.length) {
    return Number.POSITIVE_INFINITY;
  }
  let distance = 0;
  for (let i = 0; i < sourcePitches.length; i += 1) {
    distance += Math.abs(sourcePitches[i] - destPitches[i]);
  }
  const topDelta = Math.abs(sourcePitches[sourcePitches.length - 1] - destPitches[destPitches.length - 1]);
  const lowDelta = Math.abs(sourcePitches[0] - destPitches[0]);
  let score = distance + 3 * topDelta + lowDelta;

  if (destPitches.length > 2) {
    const size = destPitches.length;
    const maxPitch = destPitches[destPitches.length - 1];
    const minPitch = destPitches[0];
    if (destInfo?.isThirteenth && maxPitch - minPitch < 11) {
      score += 4 * size;
    }
    if (destPitches[destPitches.length - 2] === maxPitch - 1) {
      score += 3 * size;
    }
    if (maxPitch - minPitch === 13) {
      score += 4 * size;
    }
    if (destPitches[1] - minPitch >= 9 && destRoot !== undefined && normalizePitchClass(minPitch) !== destRoot) {
      score += 2 * size;
    }
  }

  return score;
}

function fixOverlappedNotes(notes: NoteEvent[]): NoteEvent[] {
  const result: Array<NoteEvent | null> = notes.slice();
  const groups = new Map<string, Array<{ index: number; note: NoteEvent }>>();
  for (let i = 0; i < notes.length; i += 1) {
    const note = notes[i];
    const key = `${note.channel}:${note.pitch}`;
    const bucket = groups.get(key) ?? [];
    bucket.push({ index: i, note });
    groups.set(key, bucket);
  }

  for (const group of groups.values()) {
    group.sort((a, b) => {
      if (a.note.startTick !== b.note.startTick) {
        return a.note.startTick - b.note.startTick;
      }
      return a.index - b.index;
    });
    const noteOnBuffer: Array<{ index: number; note: NoteEvent }> = [];
    for (const current of group) {
      if (result[current.index] === null) {
        continue;
      }
      const currentNote = result[current.index] as NoteEvent;
      const currentStart = currentNote.startTick;
      const currentEnd = currentStart + currentNote.duration;
      let removed = false;

      let bufferIndex = 0;
      while (bufferIndex < noteOnBuffer.length) {
        const active = noteOnBuffer[bufferIndex];
        const activeNote = result[active.index] as NoteEvent;
        const activeStart = activeNote.startTick;
        const activeEnd = activeStart + activeNote.duration;

        if (activeEnd <= currentStart) {
          noteOnBuffer.splice(bufferIndex, 1);
          continue;
        }
        if (activeEnd >= currentEnd) {
          result[current.index] = null;
          removed = true;
          break;
        }
        if (currentStart === activeStart) {
          if (currentNote.duration <= activeNote.duration) {
            result[current.index] = null;
            removed = true;
            break;
          }
          result[active.index] = null;
          noteOnBuffer.splice(bufferIndex, 1);
          continue;
        }
        const newDuration = currentStart - activeStart;
        if (newDuration <= 0) {
          result[active.index] = null;
          noteOnBuffer.splice(bufferIndex, 1);
          continue;
        }
        result[active.index] = { ...activeNote, duration: newDuration };
        noteOnBuffer.splice(bufferIndex, 1);
      }

      if (!removed) {
        noteOnBuffer.push(current);
      }
    }
  }

  return result.filter((note): note is NoteEvent => note !== null);
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

type DegreeIndex =
  | 'ROOT'
  | 'THIRD_OR_FOURTH'
  | 'FIFTH'
  | 'SIXTH_OR_SEVENTH'
  | 'EXTENSION1'
  | 'EXTENSION2'
  | 'EXTENSION3';

const DEGREE_ORDER: DegreeName[] = [
  'ROOT',
  'NINTH_FLAT',
  'NINTH',
  'NINTH_SHARP',
  'THIRD_FLAT',
  'THIRD',
  'FOURTH_OR_ELEVENTH',
  'ELEVENTH_SHARP',
  'FIFTH_FLAT',
  'FIFTH',
  'FIFTH_SHARP',
  'THIRTEENTH_FLAT',
  'SIXTH_OR_THIRTEENTH',
  'SEVENTH_FLAT',
  'SEVENTH',
];

const DEGREE_ORDER_INDEX = new Map<DegreeName, number>(DEGREE_ORDER.map((degree, index) => [degree, index]));

const DEGREE_INDEX_ORDER: DegreeIndex[] = [
  'ROOT',
  'THIRD_OR_FOURTH',
  'FIFTH',
  'SIXTH_OR_SEVENTH',
  'EXTENSION1',
  'EXTENSION2',
  'EXTENSION3',
];

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
  const isRootOnly = normalized === '1+8';
  const isPowerChord = normalized === '1+5';
  const isSpecial2 = normalized === '1+2+5' || normalized === '2' || normalized.includes('sus2');
  const isMinor = /^(min|m)(?!aj)/.test(normalized);
  const hasSus = normalized.includes('sus');
  const hasDim = normalized.includes('dim');
  const hasMaj = normalized.includes('maj');
  const hasSeventh = normalized.includes('7');
  const isMajor = !isRootOnly && !isPowerChord && !isSpecial2 && (hasMaj || (!isMinor && !hasDim && !hasSus));

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

  if (isRootOnly || isPowerChord || isSpecial2) {
    if (isPowerChord || isSpecial2) {
      addDegree('FIFTH', 'FIFTH');
    }
    if (isSpecial2) {
      addDegree('NINTH', 'NINTH');
    }
    return {
      family: isSpecial2 ? 'sus' : 'other',
      isMajor: false,
      extension: normalized,
      degreesByNatural,
      degreesByPitch,
    };
  }

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

type ChordTypeInfo = {
  profile: ChordProfile;
  normalized: string;
  degrees: DegreeName[];
  isSpecial2: boolean;
  baseHasSix: boolean;
  isThirteenth: boolean;
  mostImportantDegreeIndexes: DegreeIndex[];
};

function sortDegreesByOrder(degrees: DegreeName[]): DegreeName[] {
  return degrees.slice().sort((a, b) => (DEGREE_ORDER_INDEX.get(a) ?? 0) - (DEGREE_ORDER_INDEX.get(b) ?? 0));
}

function relativePitchDelta(sourceRel: number, destRel: number): number {
  let delta = destRel - sourceRel;
  if (delta > 6) {
    delta -= 12;
  } else if (delta < -5) {
    delta += 12;
  }
  return delta;
}

function buildChordDegrees(
  profile: ChordProfile,
  normalized: string,
  options: { isRootOnly: boolean; isPowerChord: boolean; isSpecial2: boolean }
): DegreeName[] {
  const degrees: DegreeName[] = ['ROOT'];
  if (options.isRootOnly) {
    return degrees;
  }
  if (options.isPowerChord || options.isSpecial2) {
    const fifth = profile.degreesByNatural.get('FIFTH') ?? 'FIFTH';
    degrees.push(fifth);
    if (options.isSpecial2) {
      const ninth = profile.degreesByNatural.get('NINTH') ?? 'NINTH';
      degrees.push(ninth);
    }
    return degrees;
  }

  const third = profile.degreesByNatural.get('THIRD');
  const fourth = profile.degreesByNatural.get('FOURTH');
  if (third) {
    degrees.push(third);
  } else if (fourth) {
    degrees.push(fourth);
  }

  const fifth = profile.degreesByNatural.get('FIFTH');
  if (fifth) {
    degrees.push(fifth);
  }

  const hasSeventh = profile.degreesByNatural.has('SEVENTH');
  const hasSixth = profile.degreesByNatural.has('SIXTH');
  const hasThirteenth = profile.degreesByNatural.has('THIRTEENTH');
  const isSixthChord = hasSixth && !hasSeventh && !hasThirteenth;
  if (isSixthChord) {
    degrees.push(profile.degreesByNatural.get('SIXTH') ?? 'SIXTH_OR_THIRTEENTH');
  }
  if (hasSeventh) {
    degrees.push(profile.degreesByNatural.get('SEVENTH') ?? 'SEVENTH');
  }

  const ninth = profile.degreesByNatural.get('NINTH');
  if (ninth) {
    degrees.push(ninth);
  }

  const hasExplicit11 = normalized.includes('11') || normalized.includes('#11');
  if (hasExplicit11) {
    const eleventh = profile.degreesByNatural.get('ELEVENTH');
    if (eleventh) {
      degrees.push(eleventh);
    }
  }

  const hasThirteenthExtension = hasThirteenth || (hasSixth && hasSeventh) || normalized.includes('13');
  if (hasThirteenthExtension) {
    const thirteenth = profile.degreesByNatural.get('THIRTEENTH') ?? profile.degreesByNatural.get('SIXTH');
    if (thirteenth) {
      degrees.push(thirteenth);
    }
  }

  return degrees;
}

function getDegreeByIndex(info: ChordTypeInfo, index: DegreeIndex): DegreeName | null {
  if (info.isSpecial2) {
    switch (index) {
      case 'ROOT':
        return info.degrees[0] ?? null;
      case 'FIFTH':
        return info.degrees[1] ?? null;
      case 'EXTENSION1':
        return info.degrees[2] ?? null;
      default:
        return null;
    }
  }
  const ordinal = DEGREE_INDEX_ORDER.indexOf(index);
  if (ordinal === -1) {
    return null;
  }
  return info.degrees[ordinal] ?? null;
}

function fitDegreeAdvancedIndex(info: ChordTypeInfo, index: DegreeIndex): DegreeName {
  const direct = getDegreeByIndex(info, index);
  if (direct) {
    return direct;
  }
  switch (index) {
    case 'THIRD_OR_FOURTH':
      return fitDegreeAdvanced(info.profile, 'FOURTH_OR_ELEVENTH');
    case 'SIXTH_OR_SEVENTH':
      return fitDegreeAdvanced(info.profile, 'SEVENTH');
    case 'EXTENSION1':
      return fitDegreeAdvanced(info.profile, 'NINTH');
    case 'EXTENSION2':
    case 'EXTENSION3':
      return fitDegreeAdvanced(info.profile, 'SIXTH_OR_THIRTEENTH');
    case 'FIFTH':
      return info.profile.degreesByNatural.get('FIFTH') ?? 'FIFTH';
    case 'ROOT':
    default:
      return 'ROOT';
  }
}

function computeMostImportantDegreeIndexes(info: ChordTypeInfo): DegreeIndex[] {
  const result: DegreeIndex[] = [];
  if (!info.isSpecial2) {
    result.push('THIRD_OR_FOURTH');
  }
  const fifth = getDegreeByIndex(info, 'FIFTH');
  if (fifth && fifth !== 'FIFTH') {
    result.push('FIFTH');
  }
  if (getDegreeByIndex(info, 'SIXTH_OR_SEVENTH')) {
    result.push('SIXTH_OR_SEVENTH');
  }
  if (getDegreeByIndex(info, 'EXTENSION1')) {
    result.push('EXTENSION1');
  }
  if (info.baseHasSix) {
    result.push('ROOT');
    if (fifth === 'FIFTH') {
      result.push('FIFTH');
    }
  } else {
    if (fifth === 'FIFTH') {
      result.push('FIFTH');
    }
    result.push('ROOT');
  }
  if (getDegreeByIndex(info, 'EXTENSION2')) {
    result.push('EXTENSION2');
  }
  if (getDegreeByIndex(info, 'EXTENSION3')) {
    result.push('EXTENSION3');
  }
  return result;
}

function buildChordTypeInfo(quality: string, profile?: ChordProfile): ChordTypeInfo {
  const normalized = quality.trim().toLowerCase();
  const isRootOnly = normalized === '1+8';
  const isPowerChord = normalized === '1+5';
  const isSpecial2 = normalized === '1+2+5' || normalized === '2' || normalized.includes('sus2');
  const baseHasSix = normalized.includes('6') && !normalized.includes('13');
  const isThirteenth = normalized.includes('13');
  const resolvedProfile = profile ?? buildChordProfile(quality);
  const degrees = buildChordDegrees(resolvedProfile, normalized, {
    isRootOnly,
    isPowerChord,
    isSpecial2,
  });
  const info: ChordTypeInfo = {
    profile: resolvedProfile,
    normalized,
    degrees,
    isSpecial2,
    baseHasSix,
    isThirteenth,
    mostImportantDegreeIndexes: [],
  };
  info.mostImportantDegreeIndexes = computeMostImportantDegreeIndexes(info);
  return info;
}

function isSameChordType(a?: ChordTypeInfo, b?: ChordTypeInfo): boolean {
  if (!a || !b) {
    return false;
  }
  if (a.degrees.length !== b.degrees.length) {
    return false;
  }
  for (let i = 0; i < a.degrees.length; i += 1) {
    if (a.degrees[i] !== b.degrees[i]) {
      return false;
    }
  }
  return true;
}

function fitDegree(profile: ChordProfile, degree: DegreeName): DegreeName | null {
  const natural = DEGREE_DEFS[degree].natural;
  const direct = profile.degreesByNatural.get(natural);
  if (direct) {
    if (natural === 'SEVENTH' && profile.extension.includes('6')) {
      return 'SIXTH_OR_THIRTEENTH';
    }
    if (profile.degreesByNatural.has('SEVENTH') && natural === 'SIXTH') {
      return profile.degreesByNatural.get('SEVENTH') ?? direct;
    }
    return direct;
  }
  const byPitch = profile.degreesByPitch.get(DEGREE_DEFS[degree].pitch);
  if (byPitch) {
    return byPitch;
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

function fitDegreeMelodyMode(profile: ChordProfile, degree: DegreeName): DegreeName {
  const direct = fitDegree(profile, degree);
  if (direct) {
    return direct;
  }
  const natural = DEGREE_DEFS[degree].natural;
  if (natural === 'NINTH' || natural === 'SEVENTH' || degree === 'SIXTH_OR_THIRTEENTH') {
    return fitDegreeAdvanced(profile, degree);
  }
  return degree;
}

function getDestDegreesChordMode(
  srcInfo: ChordTypeInfo,
  destInfo: ChordTypeInfo,
  srcDegrees: DegreeName[],
  sourceRoot: number,
  destRoot: number,
  useDestRootForMatching: boolean
): Map<DegreeName, DegreeName> {
  const result = new Map<DegreeName, DegreeName>();
  const remainingSrc = sortDegreesByOrder(srcDegrees);
  const nbSrcDegrees = remainingSrc.length;
  const nbDestDegrees = destInfo.degrees.length;

  if (nbSrcDegrees <= 2) {
    for (const srcDegree of remainingSrc) {
      result.set(srcDegree, fitDegreeAdvanced(destInfo.profile, srcDegree));
    }
    return result;
  }

  if (nbDestDegrees >= nbSrcDegrees) {
    const degreeIndexes = destInfo.mostImportantDegreeIndexes.slice(0, nbSrcDegrees);
    for (const di of degreeIndexes.slice()) {
      const destDegree = fitDegreeAdvancedIndex(destInfo, di);
      const srcDegree = fitDegreeAdvancedIndex(srcInfo, di);
      const srcIndex = remainingSrc.indexOf(srcDegree);
      if (srcIndex !== -1) {
        result.set(srcDegree, destDegree);
        remainingSrc.splice(srcIndex, 1);
        const indexToRemove = degreeIndexes.indexOf(di);
        if (indexToRemove !== -1) {
          degreeIndexes.splice(indexToRemove, 1);
        }
      }
    }

    for (const srcDegree of remainingSrc) {
      if (degreeIndexes.length === 0) {
        result.set(srcDegree, fitDegreeAdvanced(destInfo.profile, srcDegree));
        continue;
      }
      const srcPitchBase = useDestRootForMatching ? destRoot : sourceRoot;
      const srcRel = normalizePitchClass(srcPitchBase + DEGREE_DEFS[srcDegree].pitch);
      let closestDegreeIndex: DegreeIndex = degreeIndexes[0];
      let smallestDelta = Number.POSITIVE_INFINITY;
      for (const di of degreeIndexes) {
        const destDegree = fitDegreeAdvancedIndex(destInfo, di);
        const destRel = normalizePitchClass(destRoot + DEGREE_DEFS[destDegree].pitch);
        const pitchDelta = Math.abs(relativePitchDelta(srcRel, destRel));
        if (pitchDelta < smallestDelta) {
          smallestDelta = pitchDelta;
          closestDegreeIndex = di;
        }
      }
      const destDegree = fitDegreeAdvancedIndex(destInfo, closestDegreeIndex);
      result.set(srcDegree, destDegree);
      const indexToRemove = degreeIndexes.indexOf(closestDegreeIndex);
      if (indexToRemove !== -1) {
        degreeIndexes.splice(indexToRemove, 1);
      }
    }

    return result;
  }

  const degreeIndexes = destInfo.mostImportantDegreeIndexes.slice();
  for (const di of degreeIndexes.slice()) {
    const destDegree = fitDegreeAdvancedIndex(destInfo, di);
    const srcDegree = fitDegreeAdvancedIndex(srcInfo, di);
    const srcIndex = remainingSrc.indexOf(srcDegree);
    if (srcIndex !== -1) {
      result.set(srcDegree, destDegree);
      remainingSrc.splice(srcIndex, 1);
    }
  }

  for (const srcDegree of remainingSrc) {
    if (degreeIndexes.length === 0) {
      result.set(srcDegree, fitDegreeAdvanced(destInfo.profile, srcDegree));
      continue;
    }
    const srcPitchBase = useDestRootForMatching ? destRoot : sourceRoot;
    const srcRel = normalizePitchClass(srcPitchBase + DEGREE_DEFS[srcDegree].pitch);
    let closestDegreeIndex: DegreeIndex = degreeIndexes[0];
    let smallestDelta = Number.POSITIVE_INFINITY;
    for (const di of degreeIndexes) {
      const destDegree = fitDegreeAdvancedIndex(destInfo, di);
      const destRel = normalizePitchClass(destRoot + DEGREE_DEFS[destDegree].pitch);
      const pitchDelta = Math.abs(relativePitchDelta(srcRel, destRel));
      if (pitchDelta < smallestDelta) {
        smallestDelta = pitchDelta;
        closestDegreeIndex = di;
      }
    }
    const destDegree = fitDegreeAdvancedIndex(destInfo, closestDegreeIndex);
    result.set(srcDegree, destDegree);
  }

  return result;
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
  usedDegrees: DegreeName[];
  typeInfo: ChordTypeInfo;
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
    const usedDegrees: DegreeName[] = [];
    for (const pc of uniqueRelPcs) {
      const relToRoot = normalizePitchClass(pc - sourceRoot);
      const degree = degreeMostProbable(relToRoot, profile.isMajor);
      if (!usedDegrees.includes(degree)) {
        usedDegrees.push(degree);
      }
    }
    sourceChordData.set(channel, {
      pitches,
      relPcs,
      uniqueRelPcs,
      sourceRoot,
      sourceTones,
      profile,
      usedDegrees: sortDegreesByOrder(usedDegrees),
      typeInfo: buildChordTypeInfo(sourceChordName, profile),
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

  type ChordModeMapping = {
    pitchMap: Map<number, number>;
    degreeMap: Map<DegreeName, DegreeName>;
  };

  const chordModeCache = new Map<string, ChordModeMapping>();
  const destInfoCache = new Map<string, ChordTypeInfo>();
  const getDestInfo = (segment: ChordSegment): ChordTypeInfo => {
    const key = segment.symbol ?? `${segment.root}:${segment.tones.join(',')}`;
    const cached = destInfoCache.get(key);
    if (cached) {
      return cached;
    }
    const quality = extractChordQuality(segment.symbol ?? '');
    const profile = buildChordProfile(quality);
    const info = buildChordTypeInfo(quality, profile);
    destInfoCache.set(key, info);
    return info;
  };
  const getChordModeMapping = (channel: number, segment: ChordSegment): ChordModeMapping | null => {
    const key = `${channel}:${segment.startTick}:${segment.root}:${segment.tones.join(',')}`;
    const cached = chordModeCache.get(key);
    if (cached) {
      return cached;
    }
    const data = sourceChordData.get(channel);
    if (!data || data.pitches.length === 0 || data.uniqueRelPcs.length === 0) {
      return null;
    }
    const destInfo = getDestInfo(segment);
    const destRoot = normalizePitchClass(segment.root);
    const degreeMap = getDestDegreesChordMode(
      data.typeInfo,
      destInfo,
      data.usedDegrees,
      data.sourceRoot,
      destRoot,
      false
    );
    const destDegrees = data.usedDegrees.map(
      (degree) => degreeMap.get(degree) ?? fitDegreeAdvanced(destInfo.profile, degree)
    );
    const destRelPitches = destDegrees.map((degree) => normalizePitchClass(segment.root + DEGREE_DEFS[degree].pitch));
    const permutations = destRelPitches.length > 1 ? uniquePermutations(destRelPitches) : [destRelPitches];
    let bestChord: number[] | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const permutation of permutations) {
      const above = computeParallelChord(data.pitches, data.relPcs, data.uniqueRelPcs, permutation, false);
      const scoreAbove = computeChordScore(data.pitches, above, destInfo, destRoot);
      if (scoreAbove < bestScore) {
        bestScore = scoreAbove;
        bestChord = above;
      }

      const below = computeParallelChord(data.pitches, data.relPcs, data.uniqueRelPcs, permutation, true);
      const scoreBelow = computeChordScore(data.pitches, below, destInfo, destRoot);
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
    const result = { pitchMap: mapping, degreeMap };
    chordModeCache.set(key, result);
    return result;
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
        const destInfo = getDestInfo(segment);
        const destProfile = destInfo.profile;
        let destDegree: DegreeName = srcDegree;
        let mapping: 'chord' | 'melody' | 'root' = 'root';

        if (!isDrums(destChannel)) {
          const isChordMode = ctb2 !== undefined && (ctb2.ntr === 1 || ctb2.ntr === 2);
          const isMelodyMode = ctb2 !== undefined && ctb2.ntr === 0 && ctb2.ntt !== 0;

          if (isChordMode) {
            mapping = 'chord';
            const chordMapping = getChordModeMapping(note.channel, segment);
            destDegree = chordMapping?.degreeMap.get(srcDegree) ?? fitDegreeAdvanced(destProfile, srcDegree);
            const mapped = chordMapping?.pitchMap.get(note.pitch);
            if (mapped !== undefined) {
              pitch = mapped;
            }
          } else if (isMelodyMode) {
            mapping = 'melody';
            const rootDelta = normalizePitchClass(targetRoot - sourceRoot);
            const basePitch = note.pitch + rootDelta;
            const isBassMode = ctb2?.bassOn === true;
            const sameChordType = isSameChordType(data?.typeInfo, destInfo);
            if (isBassMode && sameChordType) {
              const srcRelToRoot = normalizePitchClass(note.pitch - sourceRoot);
              const destRelPitch = normalizePitchClass(targetRoot + srcRelToRoot);
              pitch = getClosestPitch(basePitch, destRelPitch);
              destDegree = degreeMostProbable(normalizePitchClass(destRelPitch - targetRoot), destProfile.isMajor);
            } else {
              destDegree = fitDegreeMelodyMode(destProfile, srcDegree);
              const destRelPitch = normalizePitchClass(targetRoot + DEGREE_DEFS[destDegree].pitch);
              pitch = getClosestPitch(basePitch, destRelPitch);
            }
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

  const fixedNotes = fixOverlappedNotes(notes);
  return { notes: fixedNotes, totalTicks };
}
