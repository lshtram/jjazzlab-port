# Status (2026-01-23)

## Environment
- Node.js 20.20.0 and npm 10.8.2 installed from NodeSource.
- Yarn apt repo disabled at `/etc/apt/sources.list.d/yarn.list.disabled` due to an expired key.
- NodeSource apt repo added (`deb.nodesource.com/node_20.x`).
- Note: `npm install` in `web/app` ran before the Node upgrade; re-run to ensure native deps align with Node 20.

## Repo Changes
- Added note-mapping debug callback (`onNote`) to `buildSongFromStylePart` and `renderStyleToNotes`.
- Added `web/app/tools/compare-style-mapping.ts` and npm script `tools:compare-mapping` to compare Java MIDI vs TS notes and print mapping details.
- Updated `JJazzLab/plugins/FluidSynthEmbeddedSynth/pom.xml` to use a `fluidsynthjava.version` property with a JDK 23 override.

## Validation
- `npm -C web/app run -s build` passes.
- `npm -C web/app run -s tools:compare-mapping -- --style .../JazzSamba.S346.sty --java .../jazz_samba_12bar.mid --part "Main A" --bars 12 --limit 1`
  - Sample mismatch shows chord-mode mapping differences with `ctb2 ntr=1 ntt=2` and degrees like `SIXTH_OR_THIRTEENTH -> SEVENTH_FLAT`.
  - `mismatch groups=1 totalGroups=476` (limited by `--limit 1`).

## Working Tree Snapshot
- Modified: `JJazzLab/plugins/FluidSynthEmbeddedSynth/pom.xml`
- Modified: `web/app/package.json`
- Modified: `web/app/src/core/render.ts`
- Modified: `web/app/src/core/yamaha/buildSong.ts`
- Added: `web/app/tools/compare-style-mapping.ts`
- Untracked: `web/fixtures/styles/`, `web/tmp/`, `web/app/tmp/`, `.m2/`, `.vscode/`

## Notes
- Style assets downloaded under `web/fixtures/styles/` (untracked) are used for comparison tooling.

## Next Steps
- Port Java chord-mode mapping (`SourcePhrase.getDestDegreesChordMode` + `fitDegree*`) to resolve JazzSamba/RocknRoll mismatches.
- Decide which external style assets should be tracked vs fetched by script for reproducible tests.
