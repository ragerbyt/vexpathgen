# Copilot instructions

## Project overview
- Vite + TypeScript single-page app that renders a VEX field path editor in the browser.
- Core state lives in [src/editor-state.ts](src/editor-state.ts): `controlpoints`, `sections`, `pathpoints`, field view (0-144 in), and robot config.
- Primary data flow: UI edits -> `controlpoints/sections` -> `computePathProfile()` in [src/path-profile.ts](src/path-profile.ts) -> `pathpoints` -> render via [src/field-renderer.ts](src/field-renderer.ts) and graph via [src/velocity-graph.ts](src/velocity-graph.ts).

## Key modules and responsibilities
- [src/canvas-interaction.ts](src/canvas-interaction.ts): canvas interactions (click/drag/pan/zoom), control point creation, history snapshots, and G2 continuity for bezier seams.
- [src/field-renderer.ts](src/field-renderer.ts): draws field background, control polygons, path coloring by velocity, and optional wheel tracks.
- [src/path-profile.ts](src/path-profile.ts): path generation + motion profiling (curvature smoothing, accel/decel passes, wheel velocity limits).
- [src/velocity-graph.ts](src/velocity-graph.ts): graph rendering with time/dist domain zoom and pan logic.
- [src/drawing-mode.ts](src/drawing-mode.ts): MODE switch for bezier vs line creation.
- [src/interaction-state.ts](src/interaction-state.ts): segment and flag interaction selection state.
- [src/path-flags.ts](src/path-flags.ts): path flag placement, distance mapping, and time sorting.
- [src/coordinate-display.ts](src/coordinate-display.ts): mouse coordinate display updates.
- [src/app.ts](src/app.ts): app bootstrap, cursor dot, and C++ file save using File System Access API.

## Conventions and patterns
- Field coordinates are inches; conversion helpers in [src/editor-state.ts](src/editor-state.ts) must be used for canvas/field mapping.
- UI elements are tied to ids in [index.html](index.html); keep ids consistent when adding controls.
- `pathpoints` is the authoritative output for rendering and C++ export; avoid writing render-only data elsewhere.
- C++ export in [src/app.ts](src/app.ts) resamples pathpoints at 10 ms intervals without changing the UI profile or JSON metadata.
- Exported linear acceleration is calculated forward from each current velocity to the next velocity; the final exported point has zero linear acceleration.
- C++ export currently uses forward-drive sign conventions by default; do not hardcode reverse mode when changing export formatting.
- Graph mode is controlled via `GRAPHMODE` in [src/velocity-graph.ts](src/velocity-graph.ts) with domains stored per mode (time/dist).
- Redraws are often triggered by `computePathProfile()` or custom events (`redrawCanvas` / `drawpath`) in [src/field-renderer.ts](src/field-renderer.ts).

## Path-profile.ts details (path generation + profiling)
- `computePathProfile()` is the main entry point: it rebuilds `pathpoints`, runs curvature/velocity passes, profiles in-place turns, then calls `plot()`.
- Segment sampling is dense (`POINTS_PER_SEGMENT = 1000`) and uses `sections` to decide between `generateBezierWaypoints()` and `generateLineWaypoints()`.
- Join transitions: `insertJoinTransitions()` blends seams with arcs or in-place turns (when angle exceeds `IN_PLACE_TURN_ANGLE` or `rev` flips). In-place turns insert same-position points and lock velocity to 0.
- Curvature processing: `computeStableCurvaturePrime()` smooths curvature before derivative; `getEffectiveCurvaturePrime()` suppresses noise at low curvature.
- Velocity profile passes: `applyCurvatureVelocityLimits()` caps by curvature; then forward/backward passes apply accel/decel limits and wheel accel limits (`applyWheelAccelerationConstraints()`), honoring velocity locks.
- In-place turn profiling: `applyInPlaceTurnAngularProfile()` computes angular velocity using kinematic limits (`getMaxAngularVelocity/Acceleration/Deceleration`) so turns take time.
- Wheel bounds derive from diff-drive geometry: `getLeftGain()`/`getRightGain()`, `getWheelBounds()`, and `getDiffDriveCurvatureDenom()`.
- Wheel velocity output uses linear + angular velocity so turns show up on the graph (`computeWheelVelocities()`).
- Timestamps and acceleration are computed from step distance or orientation change in `computeTimestampsAndAcceleration()`.

## Workflows
- Dev server: `bun run dev` (Vite).
- Build: `bun run dev`.
- Preview build: `npm run preview`.
-NO NEED TO BUILD to debug, I will do that myself

## Integration points
- Uses browser File System Access API in [src/app.ts](src/app.ts) for C++ export; keep this behind user gesture.
- Background field image imported as an asset in [src/editor-state.ts](src/editor-state.ts).
