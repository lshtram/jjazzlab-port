import fs from 'node:fs';
import { parseMidi } from 'midi-file';
import { renderStyleToNotes } from '../src/core/render.js';
import type { NoteMapping } from '../src/core/yamaha/buildSong.js';

type Args = {
  style?: string;
  java?: string;
  part: string;
  bars: number;
  chart?: string;
  chartFile?: string;
  limit: number;
  channel?: number;
};

type MidiNote = {
  channel: number;
  startTick: number;
  duration: number;
  pitch: number;
};

type Group<T> = {
  pitches: number[];
  entries: T[];
};

const DEFAULT_CHART =
  'Bb7 | Bb7 | Bb7 | Bb7 | Eb7 | Eb7 | Bb7 | Bb7 | F7 | Eb7 | Bb7 | F7';

function parseArgs(argv: string[]): Args {
  const args: Args = {
    part: 'Main A',
    bars: 12,
    limit: 10,
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
      case '--java':
        args.java = value;
        i += 1;
        break;
      case '--part':
        args.part = value;
        i += 1;
        break;
      case '--bars':
        args.bars = Number(value);
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
      case '--limit':
        args.limit = Number(value);
        i += 1;
        break;
      case '--channel':
        args.channel = Number(value);
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
    'Usage: compare-style-mapping --style <file> --java <file> [--part <name>] [--bars <n>] [--chart <text>] [--chart-file <file>] [--limit <n>] [--channel <n>]'
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
  return DEFAULT_CHART;
}

function extractNotes(path: string): MidiNote[] {
  const midi = parseMidi(fs.readFileSync(path));
  const notes: MidiNote[] = [];
  for (const track of midi.tracks) {
    let tick = 0;
    const active = new Map<string, { startTick: number }>();
    for (const ev of track) {
      tick += ev.deltaTime || 0;
      if (ev.type !== 'noteOn' && ev.type !== 'noteOff') {
        continue;
      }
      const channel = ev.channel;
      const pitch = ev.noteNumber;
      const velocity = ev.velocity;
      const key = `${channel}:${pitch}`;
      const isOn = ev.type === 'noteOn' && velocity > 0;
      const isOff = ev.type === 'noteOff' || (ev.type === 'noteOn' && velocity === 0);
      if (isOn) {
        active.set(key, { startTick: tick });
        continue;
      }
      if (isOff) {
        const start = active.get(key);
        if (!start) {
          continue;
        }
        active.delete(key);
        const duration = tick - start.startTick;
        if (duration <= 0) {
          continue;
        }
        notes.push({
          channel,
          startTick: start.startTick,
          duration,
          pitch,
        });
      }
    }
  }
  return notes;
}

function groupMidiNotes(notes: MidiNote[]): Map<string, Group<MidiNote>> {
  const grouped = new Map<string, Group<MidiNote>>();
  for (const note of notes) {
    const key = `${note.startTick}:${note.duration}:${note.channel}`;
    const entry = grouped.get(key) ?? { pitches: [], entries: [] };
    entry.pitches.push(note.pitch);
    entry.entries.push(note);
    grouped.set(key, entry);
  }
  for (const entry of grouped.values()) {
    entry.pitches.sort((a, b) => a - b);
    entry.entries.sort((a, b) => a.pitch - b.pitch);
  }
  return grouped;
}

function groupMappings(notes: NoteMapping[]): Map<string, Group<NoteMapping>> {
  const grouped = new Map<string, Group<NoteMapping>>();
  for (const note of notes) {
    const key = `${note.startTick}:${note.duration}:${note.destChannel}`;
    const entry = grouped.get(key) ?? { pitches: [], entries: [] };
    entry.pitches.push(note.destPitch);
    entry.entries.push(note);
    grouped.set(key, entry);
  }
  for (const entry of grouped.values()) {
    entry.pitches.sort((a, b) => a - b);
    entry.entries.sort((a, b) => a.destPitch - b.destPitch);
  }
  return grouped;
}

function parseKey(key: string): { tick: number; duration: number; channel: number } {
  const [tick, duration, channel] = key.split(':').map((value) => Number(value));
  return { tick, duration, channel };
}

const args = parseArgs(process.argv.slice(2));
if (!args.style || !args.java) {
  printUsage();
  process.exit(1);
}

const stylePath = requireFile(args.style, '--style');
const javaPath = requireFile(args.java, '--java');
const styleData = fs.readFileSync(stylePath);

const mappings: NoteMapping[] = [];
renderStyleToNotes(styleData, {
  part: args.part,
  bars: args.bars,
  chordChart: loadChartText(args),
  outputTicksPerBeat: 960,
  onNote: (info) => mappings.push(info),
});

const javaNotes = extractNotes(javaPath);
const javaGroups = groupMidiNotes(javaNotes);
const tsGroups = groupMappings(mappings);

const keys = new Set([...javaGroups.keys(), ...tsGroups.keys()]);
const sortedKeys = Array.from(keys).sort((a, b) => {
  const aa = parseKey(a);
  const bb = parseKey(b);
  if (aa.tick !== bb.tick) return aa.tick - bb.tick;
  if (aa.duration !== bb.duration) return aa.duration - bb.duration;
  return aa.channel - bb.channel;
});

let mismatches = 0;
for (const key of sortedKeys) {
  const { channel } = parseKey(key);
  if (args.channel !== undefined && channel !== args.channel) {
    continue;
  }
  const javaGroup = javaGroups.get(key) ?? { pitches: [], entries: [] };
  const tsGroup = tsGroups.get(key) ?? { pitches: [], entries: [] };
  if (javaGroup.pitches.join(',') === tsGroup.pitches.join(',')) {
    continue;
  }
  mismatches += 1;
  console.log(`group ${key}`);
  console.log(`  java: [${javaGroup.pitches.join(', ')}]`);
  console.log(`  ts:   [${tsGroup.pitches.join(', ')}]`);
  for (const note of tsGroup.entries) {
    const ctb2 = note.ctb2;
    const ctb2Summary = ctb2
      ? `ntr=${ctb2.ntr} ntt=${ctb2.ntt} bassOn=${ctb2.bassOn}`
      : 'n/a';
    console.log(
      `  ts pitch=${note.destPitch} src=${note.sourceChannel}:${note.sourcePitch} rel=${note.sourceRelPitch} deg=${note.sourceDegree}->${note.destDegree} map=${note.mapping} seg=${note.segment.symbol} roots=${note.sourceRoot}->${note.targetRoot} ctb2=${ctb2Summary}`
    );
  }
  console.log('');
  if (mismatches >= args.limit) {
    break;
  }
}

console.log(`mismatch groups=${mismatches} totalGroups=${sortedKeys.length}`);
