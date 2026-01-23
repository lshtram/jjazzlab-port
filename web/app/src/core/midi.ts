import { parseMidi, writeMidi } from 'midi-file';
import type { MidiData as MidiFileData, MidiEvent as MidiFileEvent } from 'midi-file';

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

export type ProgramChangeEvent = {
  tick: number;
  channel: number;
  program: number;
  bankMsb?: number;
  bankLsb?: number;
};

type MidiEvent = MidiFileEvent;
type MidiData = MidiFileData;

export function parseMidiData(buffer: Uint8Array): MidiData {
  return parseMidi(buffer) as MidiData;
}

export function getTempoFromTrack(track: MidiEvent[]): number | null {
  for (const event of track) {
    if ('meta' in event && event.meta && event.type === 'setTempo' && typeof event.microsecondsPerBeat === 'number') {
      return event.microsecondsPerBeat;
    }
  }
  return null;
}

export function getTimeSignatureFromTrack(track: MidiEvent[]): TimeSignature | null {
  for (const event of track) {
    if (
      'meta' in event &&
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
  formatType?: 0 | 1;
  trackName?: string;
  endTick?: number;
  programChanges?: ProgramChangeEvent[];
}): Uint8Array {
  const formatType = options.formatType ?? 0;
  const metaEvents: MidiEventWithTick[] = [];
  const noteEvents: MidiEventWithTick[] = [];

  if (options.trackName) {
    metaEvents.push({
      tick: 0,
      event: {
        deltaTime: 0,
        meta: true,
        type: 'trackName',
        text: options.trackName,
      },
    });
  }

  metaEvents.push({
    tick: 0,
    event: {
      deltaTime: 0,
      meta: true,
      type: 'setTempo',
      microsecondsPerBeat: options.tempo,
    },
  });

  metaEvents.push({
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
    noteEvents.push({
      tick: note.startTick,
      event: {
        deltaTime: 0,
        type: 'noteOn',
        channel: note.channel,
        noteNumber: note.pitch,
        velocity: note.velocity,
      },
    });
    noteEvents.push({
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

  for (const change of options.programChanges ?? []) {
    if (typeof change.bankMsb === 'number') {
      noteEvents.push({
        tick: change.tick,
        event: {
          deltaTime: 0,
          type: 'controller',
          channel: change.channel,
          controllerType: 0,
          value: change.bankMsb,
        },
      });
    }
    if (typeof change.bankLsb === 'number') {
      noteEvents.push({
        tick: change.tick,
        event: {
          deltaTime: 0,
          type: 'controller',
          channel: change.channel,
          controllerType: 32,
          value: change.bankLsb,
        },
      });
    }
    noteEvents.push({
      tick: change.tick,
      event: {
        deltaTime: 0,
        type: 'programChange',
        channel: change.channel,
        programNumber: change.program,
      },
    });
  }

  const sortEvents = (events: MidiEventWithTick[]) => {
    events.sort((a, b) => {
      if (a.tick !== b.tick) {
        return a.tick - b.tick;
      }
      const order = (event: MidiEvent) => {
        if ('meta' in event && event.meta) {
          return 0;
        }
        if (event.type === 'controller') {
          return 1;
        }
        if (event.type === 'programChange') {
          return 2;
        }
        if (event.type === 'noteOff') {
          return 3;
        }
        return 4;
      };
      return order(a.event) - order(b.event);
    });
  };

  sortEvents(metaEvents);
  sortEvents(noteEvents);

  const buildTrack = (events: MidiEventWithTick[], endTick?: number): MidiEvent[] => {
    let lastTick = 0;
    const track: MidiEvent[] = events.map(({ tick, event }) => {
      const deltaTime = tick - lastTick;
      lastTick = tick;
      return {
        ...event,
        deltaTime,
      };
    });

    const finalTick = endTick ?? lastTick;
    track.push({
      deltaTime: Math.max(0, finalTick - lastTick),
      meta: true,
      type: 'endOfTrack',
    });
    return track;
  };

  const metaEndTick = options.endTick ?? (noteEvents.length ? noteEvents[noteEvents.length - 1]!.tick : 0);
  const metaTrack = buildTrack(metaEvents, metaEndTick);
  const noteTrack = buildTrack(noteEvents);

  const tracks =
    formatType === 1
      ? [metaTrack, noteTrack]
      : (() => {
          const combined = [...metaEvents, ...noteEvents];
          sortEvents(combined);
          return [
            buildTrack(
              combined,
              options.endTick ?? (noteEvents.length ? noteEvents[noteEvents.length - 1]!.tick : 0)
            ),
          ];
        })();

  const midiData: MidiFileData = {
    header: {
      format: formatType,
      numTracks: tracks.length,
      ticksPerBeat: options.ticksPerBeat,
    },
    tracks,
  };

  const bytes = writeMidi(midiData);
  return Uint8Array.from(bytes);
}
