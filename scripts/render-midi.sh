#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: render-midi.sh --midi <file> --soundfont <file> --out <file.wav> [--gain <n>] [--rate <hz>]

Options:
  --midi        Path to a MIDI file.
  --soundfont   Path to a .sf2 soundfont file.
  --out         Output WAV file.
  --gain        Fluidsynth gain (default: 0.8).
  --rate        Sample rate in Hz (default: 44100).
  -h, --help    Show this help.
USAGE
}

midi=""
soundfont=""
out=""
gain="0.8"
rate="44100"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --midi)
      midi="${2:-}"
      shift 2
      ;;
    --soundfont)
      soundfont="${2:-}"
      shift 2
      ;;
    --out)
      out="${2:-}"
      shift 2
      ;;
    --gain)
      gain="${2:-}"
      shift 2
      ;;
    --rate)
      rate="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: unknown option $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$midi" || -z "$soundfont" || -z "$out" ]]; then
  usage
  exit 1
fi

if ! command -v fluidsynth >/dev/null 2>&1; then
  echo "Error: fluidsynth is required." >&2
  exit 1
fi

if [[ ! -f "$midi" ]]; then
  echo "Error: MIDI file not found: $midi" >&2
  exit 1
fi

if [[ ! -f "$soundfont" ]]; then
  echo "Error: soundfont not found: $soundfont" >&2
  exit 1
fi

mkdir -p "$(dirname "$out")"
fluidsynth -ni -g "$gain" -r "$rate" -F "$out" "$soundfont" "$midi"
