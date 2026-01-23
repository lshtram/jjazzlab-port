import fs from 'node:fs';
import path from 'node:path';
import { buildMidiFile, TimeSignature } from './lib/midi.js';
import { buildSongFromStylePart } from './yamaha/buildSong.js';
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

const { notes } = buildSongFromStylePart({
  bars: args.bars,
  inputTicksPerBeat: parsed.ticksPerBeat,
  outputTicksPerBeat: args.outputTicksPerBeat,
  tempo,
  timeSignature,
  part,
});

const midi = buildMidiFile({
  ticksPerBeat: args.outputTicksPerBeat,
  tempo,
  timeSignature,
  notes,
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, midi);
console.log(`Wrote MIDI to ${outPath}`);
