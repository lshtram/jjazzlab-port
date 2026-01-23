# Status (2026-01-23)

## Environment
- Node.js 20.20.0 and npm 10.8.2 installed from NodeSource.
- Yarn apt repo disabled at `/etc/apt/sources.list.d/yarn.list.disabled` due to an expired key.
- NodeSource apt repo added (`deb.nodesource.com/node_20.x`).
- Note: `npm install` in `web/app` ran before the Node upgrade; re-run to ensure native deps align with Node 20.

## Repo Changes
- Added a Java CLI to export a Yamaha style + 12-bar blues to MIDI.
- Added a headless flag to skip adapted rhythm generation during CLI export.
- Added Vite + React + TypeScript scaffold at `web/app` with TS harness tools.
- Added MIDI fixtures `web/fixtures/midi/java/jazzblues_simple_12bar.mid` and `web/fixtures/midi/ts/jazzblues_simple_12bar.mid`.
- Updated `web/fixtures/midi/README.md` with offline export steps.
  - TS harness applies CASM channel mapping and root-only chord transposition with chord-boundary splits.
  - MIDI note counts and end tick now match the Java baseline.

## Working Tree Snapshot
- Modified: `JJazzLab/core/SongStructure/src/main/java/org/jjazz/songstructure/SongStructureImpl.java`
- Added: `JJazzLab/app/Test/src/main/java/org/jjazz/test/ExportYamahaMidiCli.java`
- Untracked: `web/` (includes Vite app + fixtures), `.m2/`, `.vscode/`
- Pre-existing unrelated change: `JJazzLab/plugins/FluidSynthEmbeddedSynth/pom.xml`

## Next Steps
- Improve Yamaha parsing (Ctb2 NTR/NTT + chord-quality rules) for parity.
