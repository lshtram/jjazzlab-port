import fs from 'node:fs';
import { collectNoteEvents, parseMidiData } from './lib/midi.js';

type Summary = {
  ticksPerBeat: number;
  notes: number;
  endTick: number;
  perChannel: Map<number, number>;
};

function parseArgs(argv: string[]): { a?: string; b?: string } {
  const args: { a?: string; b?: string } = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }
    const value = argv[i + 1];
    if (token === '--a') {
      args.a = value;
      i += 1;
    }
    if (token === '--b') {
      args.b = value;
      i += 1;
    }
  }
  return args;
}

function summarize(buffer: Buffer): Summary {
  const midi = parseMidiData(buffer);
  const ticksPerBeat = midi.header.ticksPerBeat ?? 480;

  let allNotes = [];
  let endTick = 0;
  for (const track of midi.tracks) {
    const { notes, endTick: trackEnd } = collectNoteEvents(track);
    allNotes = allNotes.concat(notes);
    endTick = Math.max(endTick, trackEnd);
  }

  const perChannel = new Map<number, number>();
  for (const note of allNotes) {
    perChannel.set(note.channel, (perChannel.get(note.channel) ?? 0) + 1);
  }

  return {
    ticksPerBeat,
    notes: allNotes.length,
    endTick,
    perChannel,
  };
}

const args = parseArgs(process.argv.slice(2));
if (!args.a || !args.b) {
  console.error('Usage: compare-midi --a <file> --b <file>');
  process.exit(1);
}

const aBuffer = fs.readFileSync(args.a);
const bBuffer = fs.readFileSync(args.b);
const a = summarize(aBuffer);
const b = summarize(bBuffer);

const formatChannels = (summary: Summary) =>
  Array.from(summary.perChannel.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([channel, count]) => `${channel}:${count}`)
    .join(', ');

console.log('A:', args.a);
console.log(`  ticksPerBeat=${a.ticksPerBeat} notes=${a.notes} endTick=${a.endTick}`);
console.log(`  perChannel=${formatChannels(a)}`);
console.log('B:', args.b);
console.log(`  ticksPerBeat=${b.ticksPerBeat} notes=${b.notes} endTick=${b.endTick}`);
console.log(`  perChannel=${formatChannels(b)}`);
