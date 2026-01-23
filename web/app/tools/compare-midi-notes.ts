import fs from 'node:fs';
import { parseMidi } from 'midi-file';

type NoteEvent = {
  channel: number;
  startTick: number;
  duration: number;
  pitch: number;
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

function extractNotes(path: string): NoteEvent[] {
  const midi = parseMidi(fs.readFileSync(path));
  const notes: NoteEvent[] = [];
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
  notes.sort((a, b) => {
    if (a.startTick !== b.startTick) return a.startTick - b.startTick;
    if (a.channel !== b.channel) return a.channel - b.channel;
    if (a.pitch !== b.pitch) return a.pitch - b.pitch;
    return a.duration - b.duration;
  });
  return notes;
}

const args = parseArgs(process.argv.slice(2));
if (!args.a || !args.b) {
  console.error('Usage: compare-midi-notes --a <file> --b <file>');
  process.exit(1);
}

const aNotes = extractNotes(args.a);
const bNotes = extractNotes(args.b);
const total = Math.max(aNotes.length, bNotes.length);
let mismatches = 0;
for (let i = 0; i < total; i += 1) {
  const a = aNotes[i];
  const b = bNotes[i];
  if (!a || !b) {
    mismatches += 1;
    continue;
  }
  if (
    a.channel !== b.channel ||
    a.startTick !== b.startTick ||
    a.duration !== b.duration ||
    a.pitch !== b.pitch
  ) {
    mismatches += 1;
    if (mismatches <= 5) {
      console.log('diff', i, a, b);
    }
  }
}

console.log(`notes A=${aNotes.length} B=${bNotes.length} mismatches=${mismatches}`);
