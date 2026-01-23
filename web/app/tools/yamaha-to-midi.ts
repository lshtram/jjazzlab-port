import fs from 'node:fs';
import path from 'node:path';
import { renderStyleToMidi } from '../src/core/render.js';

type Args = {
  style?: string;
  out?: string;
  bars: number;
  part: string;
  tempo?: number;
  outputTicksPerBeat: number;
  chart?: string;
  chartFile?: string;
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
      case '--chart':
        args.chart = value;
        i += 1;
        break;
      case '--chart-file':
        args.chartFile = value;
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
    `Usage: yamaha-to-midi --style <file> --out <file> [--bars <n>] [--part <marker>] [--tempo <bpm>] [--ppq <ticks>] [--chart <text>] [--chart-file <file>]`
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

function loadChartText(args: Args): string {
  if (args.chartFile) {
    return fs.readFileSync(requireFile(args.chartFile, '--chart-file'), 'utf8');
  }
  if (args.chart) {
    return args.chart;
  }
  return 'Bb7 | Bb7 | Bb7 | Bb7 | Eb7 | Eb7 | Bb7 | Bb7 | F7 | Eb7 | Bb7 | F7';
}

const args = parseArgs(process.argv.slice(2));
if (!args.style || !args.out) {
  printUsage();
  process.exit(1);
}

const stylePath = requireFile(args.style, '--style');
const outPath = args.out!;
const buffer = fs.readFileSync(stylePath);
const midi = renderStyleToMidi(buffer, {
  bars: args.bars,
  part: args.part,
  tempo: args.tempo,
  outputTicksPerBeat: args.outputTicksPerBeat,
  chordChart: loadChartText(args),
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, midi);
console.log(`Wrote MIDI to ${outPath}`);
