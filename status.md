# Status (2026-01-23)

## Environment
- Node.js 20.20.0 and npm 10.8.2 installed from NodeSource.
- Yarn apt repo disabled at `/etc/apt/sources.list.d/yarn.list.disabled` due to an expired key.
- NodeSource apt repo added (`deb.nodesource.com/node_20.x`).
- Note: `npm install` in `web/app` ran before the Node upgrade; re-run to ensure native deps align with Node 20.

## Repo Changes
- Ported Java chord-mode degree mapping (most-important-degree logic) and refined `fitDegree` behavior to match Java.
- Aligned melody/bass mapping rules with Java and added note-overlap cleanup to match `fixOverlappedNotes`.
- Extended compare tool to apply overlap cleanup before grouping.
- Added a curated Yamaha style set under `web/fixtures/styles/curated`.

## Validation
- `npm -C web/app run -s build` passes.
- Java vs TS MIDI parity (via `tools:compare-mapping`):
  - `AcousticJazz1.S563.sty`: mismatch groups = 0
  - `JazzBluesSimple.S740.sty`: mismatch groups = 0
  - `JazzSamba.S346.sty`: mismatch groups = 0
  - `RocknRoll.sty`: mismatch groups = 0

## Working Tree Snapshot
- Modified: `web/app/src/core/yamaha/buildSong.ts`
- Modified: `web/app/tools/compare-style-mapping.ts`
- Added: `web/fixtures/styles/curated/`
- Untracked: `web/fixtures/styles/yamaha/`, `web/tmp/`, `web/app/tmp/`, `.m2/`, `.vscode/`

## Notes
- Curated styles are now tracked under `web/fixtures/styles/curated`.

## Next Steps
- Add/adjust MIDI fixtures for curated styles beyond the 4 parity-checked ones.
- Optionally add a fetch script to refresh the larger Yamaha style set when needed.
