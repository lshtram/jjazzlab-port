import type { TimeSignature } from './midi.js';
import { chordTonesForSymbol, normalizePitchClass, parseChordRoot } from './harmony.js';

export type ChordSegment = {
  startTick: number;
  endTick: number;
  root: number;
  tones: number[];
};

export type ChordChart = {
  bars: string[][];
};

export function parseChordChart(chart: string): ChordChart {
  const sanitized = chart.replace(/\r/g, '').replace(/\n/g, '|').trim();
  const rawBars = sanitized.length ? sanitized.split('|') : [];
  const bars: string[][] = [];
  let lastChord = 'C7';

  for (const raw of rawBars) {
    const cleaned = raw.trim();
    if (!cleaned) {
      bars.push([lastChord]);
      continue;
    }
    const tokens = cleaned
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
    const chords: string[] = [];
    for (const token of tokens) {
      if (/^n\.?c\.?$/i.test(token)) {
        chords.push(lastChord);
        continue;
      }
      chords.push(token);
      lastChord = token;
    }
    bars.push(chords.length ? chords : [lastChord]);
  }

  return { bars };
}

export function buildChordTimeline(options: {
  chart: ChordChart;
  totalBars?: number;
  ticksPerBar: number;
}): ChordSegment[] {
  const { chart, totalBars, ticksPerBar } = options;
  const bars = chart.bars.length ? chart.bars : [['C7']];
  const barsToRender = totalBars ?? bars.length;
  const segments: ChordSegment[] = [];

  for (let barIndex = 0; barIndex < barsToRender; barIndex += 1) {
    const bar = bars[barIndex % bars.length] ?? ['C7'];
    const chordCount = Math.max(1, bar.length);
    const ticksPerChord = ticksPerBar / chordCount;
    for (let chordIndex = 0; chordIndex < chordCount; chordIndex += 1) {
      const chord = bar[chordIndex] ?? bar[bar.length - 1] ?? 'C7';
      const startTick = Math.round(barIndex * ticksPerBar + chordIndex * ticksPerChord);
      const endTick = Math.round(barIndex * ticksPerBar + (chordIndex + 1) * ticksPerChord);
      const root = normalizePitchClass(parseChordRoot(chord));
      const tones = chordTonesForSymbol(chord);
      const last = segments[segments.length - 1];
      if (last && last.root === root && last.tones.join(',') === tones.join(',')) {
        last.endTick = endTick;
      } else {
        segments.push({ startTick, endTick, root, tones });
      }
    }
  }

  return segments;
}

export function ticksPerBarFromTimeSignature(timeSignature: TimeSignature, ticksPerBeat: number): number {
  return ticksPerBeat * ((timeSignature.numerator * 4) / timeSignature.denominator);
}
