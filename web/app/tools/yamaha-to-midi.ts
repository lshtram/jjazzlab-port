import fs from 'node:fs';
import path from 'node:path';
import { buildMidiFile, TimeSignature } from './lib/midi.js';
import { buildSongFromStylePart } from './yamaha/buildSong.js';
import type { ChordSegment } from './yamaha/buildSong.js';
import { normalizeStylePartName, parseStyleFromBuffer } from './yamaha/parseStyle.js';

type Args = {
  style?: string;
  out?: string;
  bars: number;
  part: string;
  tempo?: number;
  outputTicksPerBeat: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    bars: 12,
    part: 'Main A',
    outputTicksPerBeat: 960,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }
    const value = argv[i + 1];
    switch (token) {
      case '--style':
        args.style = value;
        i += 1;
        break;
      case '--out':
        args.out = value;
        i += 1;
        break;
      case '--bars':
        args.bars = Number(value);
        i += 1;
        break;
      case '--part':
        args.part = value;
        i += 1;
        break;
      case '--tempo':
        args.tempo = Number(value);
        i += 1;
        break;
      case '--ppq':
        args.outputTicksPerBeat = Number(value);
        i += 1;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
      default:
        break;
    }
  }

  return args;
}

function printUsage(): void {
  console.error(
    `Usage: yamaha-to-midi --style <file> --out <file> [--bars <n>] [--part <marker>] [--tempo <bpm>] [--ppq <ticks>]`
  );
}

function requireFile(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required flag ${name}`);
  }
  if (!fs.existsSync(value)) {
    throw new Error(`File not found: ${value}`);
  }
  return value;
}

function computeTempoMicroseconds(tempo?: number, fallback: number): number {
  if (!tempo || Number.isNaN(tempo) || tempo <= 0) {
    return fallback;
  }
  return Math.round(60_000_000 / tempo);
}

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

function parseChordRoot(chord: string): number {
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
  return (root + 12) % 12;
}

function buildBluesChordTimeline(bars: number, ticksPerBar: number): ChordSegment[] {
  const changes = [
    { bar: 0, chord: 'Bb7' },
    { bar: 4, chord: 'Eb7' },
    { bar: 6, chord: 'Bb7' },
    { bar: 8, chord: 'F7' },
    { bar: 9, chord: 'Eb7' },
    { bar: 10, chord: 'Bb7' },
    { bar: 11, chord: 'F7' },
  ];

  const chordAtBar = (bar: number) => {
    const cycleBar = bar % 12;
    let chord = changes[0].chord;
    for (const change of changes) {
      if (cycleBar >= change.bar) {
        chord = change.chord;
      }
    }
    return chord;
  };

  const segments: ChordSegment[] = [];
  for (let bar = 0; bar < bars; bar += 1) {
    const chord = chordAtBar(bar);
    const root = parseChordRoot(chord);
    const startTick = bar * ticksPerBar;
    const endTick = startTick + ticksPerBar;
    const tones = chordTonesForSymbol(chord);
    const last = segments[segments.length - 1];
    if (last && last.root === root) {
      last.endTick = endTick;
    } else {
      segments.push({ startTick, endTick, root, tones });
    }
  }
  return segments;
}

const args = parseArgs(process.argv.slice(2));
if (!args.style || !args.out) {
  printUsage();
  process.exit(1);
}

const stylePath = requireFile(args.style, '--style');
const outPath = args.out!;
const buffer = fs.readFileSync(stylePath);
const parsed = parseStyleFromBuffer(buffer);

const partId = normalizeStylePartName(args.part);
const part = parsed.parts.find((item) => item.id === partId);
if (!part) {
  const available = parsed.parts.map((item) => item.marker).join(', ');
  throw new Error(`Style part "${args.part}" not found. Available markers: ${available}`);
}

const timeSignature: TimeSignature = parsed.timeSignature ?? { numerator: 4, denominator: 4 };
const tempo = computeTempoMicroseconds(args.tempo, parsed.tempo);

const { notes, totalTicks } = buildSongFromStylePart({
  bars: args.bars,
  inputTicksPerBeat: parsed.ticksPerBeat,
  outputTicksPerBeat: args.outputTicksPerBeat,
  tempo,
  timeSignature,
  part,
  chordTimeline: buildBluesChordTimeline(
    args.bars,
    args.outputTicksPerBeat * ((timeSignature.numerator * 4) / timeSignature.denominator)
  ),
  channelMap: parsed.channelMap,
  sourceChordByChannel: parsed.sourceChordByChannel,
  sourceChordTypeByChannel: parsed.sourceChordTypeByChannel,
  ctb2ByChannel: parsed.ctb2ByChannel,
});

const midi = buildMidiFile({
  ticksPerBeat: args.outputTicksPerBeat,
  tempo,
  timeSignature,
  notes,
  formatType: 1,
  trackName: 'YamahaBlues (JJazzLab song)',
  endTick: totalTicks + 1,
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, midi);
console.log(`Wrote MIDI to ${outPath}`);
