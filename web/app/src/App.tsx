import { useMemo, useRef, useState } from 'react';
import { renderStyleToMidi, renderStyleToNotes } from './core/render.js';
import { parseStyleFromBuffer } from './core/yamaha/parseStyle.js';
import { SoundfontSynth } from './audio/soundfont.js';
import './App.css';

const DEFAULT_CHART =
  'Bb7 | Bb7 | Bb7 | Bb7 | Eb7 | Eb7 | Bb7 | Bb7 | F7 | Eb7 | Bb7 | F7';

const SOUND_FONTS = [
  { value: 'MusyngKite', label: 'MusyngKite (HQ, large)' },
  { value: 'FluidR3_GM', label: 'FluidR3 (lighter)' },
];

function toPositiveNumber(value: string): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function pickDefaultPart(parts: string[]): string {
  return parts.find((part) => part.toLowerCase().includes('main a')) ?? parts[0] ?? '';
}

function App() {
  const [styleData, setStyleData] = useState<Uint8Array | null>(null);
  const [styleName, setStyleName] = useState<string>('No style loaded');
  const [parts, setParts] = useState<string[]>([]);
  const [selectedPart, setSelectedPart] = useState<string>('');
  const [chart, setChart] = useState<string>(DEFAULT_CHART);
  const [bars, setBars] = useState<string>('12');
  const [tempo, setTempo] = useState<string>('120');
  const [soundfont, setSoundfont] = useState<string>('MusyngKite');
  const [status, setStatus] = useState<string>('Load a Yamaha style to begin.');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const audioRef = useRef<AudioContext | null>(null);
  const synthRef = useRef<SoundfontSynth | null>(null);
  const soundfontRef = useRef<string>('MusyngKite');
  const playbackRef = useRef<{ stop: () => void } | null>(null);

  const hasStyle = Boolean(styleData);
  const partOptions = useMemo(() => parts, [parts]);

  const handleStyleChange = async (file: File | null) => {
    if (!file) {
      return;
    }
    setIsLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      const parsed = parseStyleFromBuffer(data);
      const markers = parsed.parts.map((part) => part.marker);
      const defaultPart = pickDefaultPart(markers);
      setStyleData(data);
      setStyleName(file.name);
      setParts(markers);
      setSelectedPart(defaultPart);
      setStatus(`Loaded ${markers.length} parts from ${file.name}.`);
    } catch (error) {
      setStatus(`Failed to parse style: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const buildRenderOptions = () => ({
    part: selectedPart,
    bars: toPositiveNumber(bars),
    tempo: toPositiveNumber(tempo),
    outputTicksPerBeat: 960,
    chordChart: chart,
  });

  const handlePlay = async () => {
    if (!styleData || !selectedPart) {
      setStatus('Select a style and part before playing.');
      return;
    }
    setIsLoading(true);
    try {
      const renderOptions = buildRenderOptions();
      const rendered = renderStyleToNotes(styleData, renderOptions);

      const audio = audioRef.current ?? new AudioContext();
      audioRef.current = audio;
      if (audio.state === 'suspended') {
        await audio.resume();
      }

      if (!synthRef.current || soundfontRef.current !== soundfont) {
        synthRef.current = new SoundfontSynth(audio, { soundfont });
        soundfontRef.current = soundfont;
      }

      playbackRef.current?.stop();
      await synthRef.current.prepare(rendered.programsByChannel);
      playbackRef.current = synthRef.current.play(rendered);

      setStatus(
        `Playing ${rendered.notes.length} notes at ${Math.round(
          60_000_000 / rendered.tempo
        )} bpm (${rendered.timeSignature.numerator}/${rendered.timeSignature.denominator}).`
      );
    } catch (error) {
      setStatus(`Playback failed: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    playbackRef.current?.stop();
    setStatus('Playback stopped.');
  };

  const handleDownloadMidi = () => {
    if (!styleData || !selectedPart) {
      setStatus('Select a style and part before exporting.');
      return;
    }
    try {
      const midi = renderStyleToMidi(styleData, buildRenderOptions());
      const midiBuffer = new ArrayBuffer(midi.byteLength);
      new Uint8Array(midiBuffer).set(midi);
      const blob = new Blob([midiBuffer], { type: 'audio/midi' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'jjazzlab-render.mid';
      link.click();
      URL.revokeObjectURL(url);
      setStatus('MIDI exported.');
    } catch (error) {
      setStatus(`Export failed: ${(error as Error).message}`);
    }
  };

  return (
    <div className="app">
      <header className="hero">
        <p className="eyebrow">JJazzLab Web Core</p>
        <h1>Style-driven playback without the UI baggage.</h1>
        <p className="subhead">
          Load a Yamaha style, drop in a chord chart, and play straight through a SoundFont synth.
        </p>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h2>Inputs</h2>
          <span className="badge">{styleName}</span>
        </div>

        <div className="grid">
          <label className="field">
            <span>Style file (.sty)</span>
            <input
              type="file"
              accept=".sty,.prs,.bcs,.sst"
              onChange={(event) => handleStyleChange(event.target.files?.[0] ?? null)}
            />
          </label>

          <label className="field">
            <span>Style part</span>
            <select
              value={selectedPart}
              onChange={(event) => setSelectedPart(event.target.value)}
              disabled={!hasStyle}
            >
              {partOptions.map((part) => (
                <option key={part} value={part}>
                  {part}
                </option>
              ))}
            </select>
          </label>

          <label className="field wide">
            <span>Chord chart</span>
            <textarea
              rows={4}
              value={chart}
              onChange={(event) => setChart(event.target.value)}
              placeholder="Bb7 | Bb7 | Eb7 | ... (bars separated by |)"
            />
          </label>

          <label className="field">
            <span>Bars</span>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={bars}
              onChange={(event) => setBars(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Tempo (bpm)</span>
            <input
              type="number"
              min="30"
              max="260"
              inputMode="numeric"
              value={tempo}
              onChange={(event) => setTempo(event.target.value)}
            />
          </label>

          <label className="field">
            <span>SoundFont</span>
            <select value={soundfont} onChange={(event) => setSoundfont(event.target.value)}>
              {SOUND_FONTS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel actions">
        <button onClick={handlePlay} disabled={!hasStyle || isLoading}>
          {isLoading ? 'Preparing…' : 'Play'}
        </button>
        <button onClick={handleStop} disabled={!hasStyle}>
          Stop
        </button>
        <button onClick={handleDownloadMidi} disabled={!hasStyle || isLoading}>
          Export MIDI
        </button>
      </section>

      <section className="panel status">
        <h2>Status</h2>
        <p>{status}</p>
      </section>
    </div>
  );
}

export default App;
