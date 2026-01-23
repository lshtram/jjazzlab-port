export function normalizePitchClass(value: number): number {
  return ((value % 12) + 12) % 12;
}

export function chordTonesForQuality(quality: string): number[] {
  const normalized = quality.trim().toLowerCase();
  if (!normalized) {
    return [0, 4, 7];
  }
  if (normalized === '1+8') {
    return [0];
  }
  if (normalized === '1+5') {
    return [0, 7];
  }
  if (normalized === '1+2+5' || normalized === '2') {
    return [0, 2, 7];
  }
  if (normalized.startsWith('maj7') || normalized.startsWith('m7m') || normalized.includes('maj7')) {
    const tones = [0, 4, 7, 11];
    if (normalized.includes('9')) {
      tones.push(2);
    }
    if (normalized.includes('#11')) {
      tones.push(6);
    }
    if (normalized.includes('11') && !normalized.includes('#11')) {
      tones.push(5);
    }
    if (normalized.includes('13')) {
      tones.push(normalized.includes('b13') ? 8 : 9);
    }
    return Array.from(new Set(tones));
  }
  if (normalized.startsWith('min7') || normalized.startsWith('m7')) {
    const tones = [0, 3, 7, 10];
    if (normalized.includes('b5')) {
      tones[2] = 6;
    } else if (normalized.includes('#5')) {
      tones[2] = 8;
    }
    if (normalized.includes('9')) {
      tones.push(normalized.includes('b9') ? 1 : normalized.includes('#9') ? 3 : 2);
    }
    if (normalized.includes('11')) {
      tones.push(5);
    }
    if (normalized.includes('13')) {
      tones.push(normalized.includes('b13') ? 8 : 9);
    }
    return Array.from(new Set(tones));
  }
  if (normalized.startsWith('min') || normalized.startsWith('m')) {
    const tones = [0, 3, 7];
    if (normalized.includes('b5')) {
      tones[2] = 6;
    } else if (normalized.includes('#5')) {
      tones[2] = 8;
    }
    if (normalized.includes('6')) {
      tones.push(9);
    }
    if (normalized.includes('9')) {
      tones.push(normalized.includes('b9') ? 1 : normalized.includes('#9') ? 3 : 2);
    }
    if (normalized.includes('11')) {
      tones.push(5);
    }
    if (normalized.includes('13')) {
      tones.push(normalized.includes('b13') ? 8 : 9);
    }
    return Array.from(new Set(tones));
  }
  if (normalized.startsWith('dim7')) {
    return [0, 3, 6, 9];
  }
  if (normalized.startsWith('dim')) {
    return [0, 3, 6];
  }
  if (normalized.startsWith('aug') || normalized.startsWith('+')) {
    const tones = [0, 4, 8];
    if (normalized.includes('7')) {
      tones.push(10);
    }
    return tones;
  }
  if (normalized.startsWith('sus4') || normalized.startsWith('sus')) {
    const tones = [0, 5, 7];
    if (normalized.includes('7')) {
      tones.push(10);
    }
    if (normalized.includes('9')) {
      tones.push(normalized.includes('b9') ? 1 : normalized.includes('#9') ? 3 : 2);
    }
    if (normalized.includes('13')) {
      tones.push(normalized.includes('b13') ? 8 : 9);
    }
    return Array.from(new Set(tones));
  }
  if (normalized.startsWith('7') || normalized.includes('7')) {
    const tones = [0, 4, 7, 10];
    if (normalized.includes('b5')) {
      tones[2] = 6;
    } else if (normalized.includes('#5') || normalized.includes('aug')) {
      tones[2] = 8;
    }
    if (normalized.includes('b9')) {
      tones.push(1);
    } else if (normalized.includes('#9')) {
      tones.push(3);
    } else if (normalized.includes('9')) {
      tones.push(2);
    }
    if (normalized.includes('#11')) {
      tones.push(6);
    } else if (normalized.includes('11')) {
      tones.push(5);
    }
    if (normalized.includes('b13')) {
      tones.push(8);
    } else if (normalized.includes('13')) {
      tones.push(9);
    }
    return Array.from(new Set(tones));
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
  const key = name.trim().toLowerCase();
  const yamahaChordTones: Record<string, number[]> = {
    '1+2+5': [0, 2, 7],
    'sus4': [0, 5, 7],
    '1+5': [0, 7],
    '1+8': [0],
    '7aug': [0, 4, 8, 10],
    'maj7aug': [0, 4, 8, 11],
    '7(#9)': [0, 4, 7, 10, 3],
    '7(b13)': [0, 4, 7, 10, 8],
    '7(b9)': [0, 4, 7, 10, 1],
    '7(13)': [0, 4, 7, 10, 9],
    '7#11': [0, 4, 7, 10, 6],
    '7(9)': [0, 4, 7, 10, 2],
    '7b5': [0, 4, 6, 10],
    '7sus4': [0, 5, 7, 10],
    '7th': [0, 4, 7, 10],
    'dim7': [0, 3, 6, 9],
    'dim': [0, 3, 6],
    'minmaj7(9)': [0, 3, 7, 11, 2],
    'minmaj7': [0, 3, 7, 11],
    'min7(11)': [0, 3, 7, 10, 5],
    'min7(9)': [0, 3, 7, 10, 2],
    'min(9)': [0, 3, 7, 2],
    'm7b5': [0, 3, 6, 10],
    'min7': [0, 3, 7, 10],
    'min6': [0, 3, 7, 9],
    'min': [0, 3, 7],
    'aug': [0, 4, 8],
    'maj6(9)': [0, 4, 7, 9, 2],
    'maj7(9)': [0, 4, 7, 11, 2],
    'maj(9)': [0, 4, 7, 2],
    'maj7#11': [0, 4, 7, 11, 6],
    'maj7': [0, 4, 7, 11],
    'maj6': [0, 4, 7, 9],
    'maj': [0, 4, 7],
  };
  const tones = yamahaChordTones[key];
  if (tones) {
    return tones.slice();
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
