import { parseMidi, writeMidi } from 'midi-file';

export type NoteEvent = {
  channel: number;
  pitch: number;
  velocity: number;
  startTick: number;
  duration: number;
};

export type TimeSignature = {
  numerator: number;
  denominator: number;
};

export type MidiMeta = {
  ticksPerBeat: number;
  tempo: number;
  timeSignature: TimeSignature | null;
};

type MidiEvent = Record<string, unknown> & {
  deltaTime: number;
  type?: string;
  meta?: boolean;
  channel?: number;
  noteNumber?: number;
  velocity?: number;
  microsecondsPerBeat?: number;
  numerator?: number;
  denominator?: number;
};

type MidiData = {
  header: {
    ticksPerBeat?: number;
  };
  tracks: MidiEvent[][];
};

export function parseMidiData(buffer: Buffer): MidiData {
  return parseMidi(buffer) as MidiData;
}

export function getTempoFromTrack(track: MidiEvent[]): number | null {
  for (const event of track) {
    if (event.meta && event.type === 'setTempo' && typeof event.microsecondsPerBeat === 'number') {
      return event.microsecondsPerBeat;
    }
  }
  return null;
}

export function getTimeSignatureFromTrack(track: MidiEvent[]): TimeSignature | null {
  for (const event of track) {
    if (
      event.meta &&
      event.type === 'timeSignature' &&
      typeof event.numerator === 'number' &&
      typeof event.denominator === 'number'
    ) {
      return {
        numerator: event.numerator,
        denominator: event.denominator,
      };
    }
  }
  return null;
}

export function collectNoteEvents(track: MidiEvent[]): { notes: NoteEvent[]; endTick: number } {
  const notes: NoteEvent[] = [];
  const active = new Map<string, { startTick: number; velocity: number }>();
  let tick = 0;
  let endTick = 0;

  for (const event of track) {
    tick += event.deltaTime ?? 0;
    endTick = Math.max(endTick, tick);

    if (event.type !== 'noteOn' && event.type !== 'noteOff') {
      continue;
    }

    const channel = typeof event.channel === 'number' ? event.channel : null;
    const pitch = typeof event.noteNumber === 'number' ? event.noteNumber : null;
    const velocity = typeof event.velocity === 'number' ? event.velocity : null;

    if (channel === null || pitch === null || velocity === null) {
      continue;
    }

    const key = `${channel}:${pitch}`;
    const isNoteOn = event.type === 'noteOn' && velocity > 0;
    const isNoteOff = event.type === 'noteOff' || (event.type === 'noteOn' && velocity === 0);

    if (isNoteOn) {
      active.set(key, { startTick: tick, velocity });
      continue;
    }

    if (isNoteOff) {
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
        pitch,
        velocity: start.velocity,
        startTick: start.startTick,
        duration,
      });
    }
  }

  return { notes, endTick };
}

type MidiEventWithTick = {
  tick: number;
  event: MidiEvent;
};

export function buildMidiFile(options: {
  ticksPerBeat: number;
  tempo: number;
  timeSignature: TimeSignature;
  notes: NoteEvent[];
}): Buffer {
  const events: MidiEventWithTick[] = [];

  events.push({
    tick: 0,
    event: {
      deltaTime: 0,
      meta: true,
      type: 'setTempo',
      microsecondsPerBeat: options.tempo,
    },
  });

  events.push({
    tick: 0,
    event: {
      deltaTime: 0,
      meta: true,
      type: 'timeSignature',
      numerator: options.timeSignature.numerator,
      denominator: options.timeSignature.denominator,
      metronome: 24,
      thirtyseconds: 8,
    },
  });

  for (const note of options.notes) {
    events.push({
      tick: note.startTick,
      event: {
        deltaTime: 0,
        type: 'noteOn',
        channel: note.channel,
        noteNumber: note.pitch,
        velocity: note.velocity,
      },
    });
    events.push({
      tick: note.startTick + note.duration,
      event: {
        deltaTime: 0,
        type: 'noteOff',
        channel: note.channel,
        noteNumber: note.pitch,
        velocity: 0,
      },
    });
  }

  events.sort((a, b) => {
    if (a.tick !== b.tick) {
      return a.tick - b.tick;
    }
    const order = (event: MidiEvent) => {
      if (event.meta) {
        return 0;
      }
      if (event.type === 'noteOff') {
        return 1;
      }
      return 2;
    };
    return order(a.event) - order(b.event);
  });

  let lastTick = 0;
  const track: MidiEvent[] = events.map(({ tick, event }) => {
    const deltaTime = tick - lastTick;
    lastTick = tick;
    return {
      ...event,
      deltaTime,
    };
  });

  track.push({
    deltaTime: 0,
    meta: true,
    type: 'endOfTrack',
  });

  const midiData = {
    header: {
      formatType: 0,
      ticksPerBeat: options.ticksPerBeat,
    },
    tracks: [track],
  };

  const bytes = writeMidi(midiData as unknown as Record<string, unknown>);
  return Buffer.from(bytes);
}
