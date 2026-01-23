export function normalizePitchClass(value: number): number {
  return ((value % 12) + 12) % 12;
}

export function chordTonesForQuality(quality: string): number[] {
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

export function chordTonesForSymbol(symbol: string): number[] {
  const match = symbol.match(/^([A-Ga-g])([#b]?)([^/]*)/);
  const quality = match?.[3] ?? '';
  return chordTonesForQuality(quality);
}

export function chordTonesForTypeName(name: string | null | undefined): number[] | null {
  if (!name) {
    return null;
  }
  return chordTonesForQuality(name);
}

export function parseChordRoot(chord: string): number {
  const match = chord.match(/^([A-Ga-g])([#b]?)/);
  if (!match) {
    return 0;
  }
  const letter = match[1].toUpperCase();
  const accidental = match[2] ?? '';
  const baseMap: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  let root = baseMap[letter] ?? 0;
  if (accidental === '#') {
    root += 1;
  } else if (accidental === 'b') {
    root -= 1;
  }
  return normalizePitchClass(root);
}
