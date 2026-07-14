# Performance benchmarks & interaction budgets

Tracks issue #16 — keep editing responsive at the scale of the ScImage reference diagram and beyond.

## Reference scale (supported counts)

The benchmark fixture approximates a large real document:

| Element        | Target  |
|----------------|---------|
| Nodes (shapes) | ≥ 500   |
| Connections (vector routes) | ≥ 300 |
| Text items (names, ports, chips, labels) | ≥ 1,500 |
| Containers     | 25      |

These are the counts the editor is expected to remain usable at. Documents beyond this may degrade;
that is acceptable but should be a conscious decision, not an accidental regression.

## Automated benchmark

Deterministic generator + measurement, no app dependencies (matches the repo's `node --test` setup):

- `bench/generateBenchmark.mjs` — `generateBenchmarkProject({ nodeCount, connectionCount, seed })`
  returns a **current-schema** project (openable in the editor) plus `countTextItems(project)`.
- `bench/perf.mjs` — run it to measure the document-scale costs and emit a loadable fixture:

  ```
  node bench/perf.mjs            # 500 nodes (default)
  node bench/perf.mjs 1000       # stress a larger document
  ```

  It reports serialize (autosave/export), parse (open document), and a full-document immutable
  map + bounds pass (per-edit / per-frame proxy), and writes `bench/benchmark-500.json`.

- `tests/performance.test.mjs` (runs in `npm test`) guards against regressions: it asserts the
  fixture meets the reference-scale targets, that connections reference valid nodes/ports, that
  generation is deterministic, and that a serialize+parse round-trip stays within budget.

### Budgets — headless (measured via `node bench/perf.mjs`, 500 nodes)

| Operation | Typical | Test ceiling |
|-----------|---------|--------------|
| Serialize (autosave/export) | ~0.7 ms | — |
| Parse (open document) | ~0.9 ms | — |
| Serialize + parse round-trip | ~1–2 ms | **750 ms** (regression guard) |
| Full-document map + bounds (per-edit proxy) | ~0.03 ms | — |

The 750 ms ceiling is deliberately loose so it never flakes on slow CI while still catching an
accidental O(n²)/deep-copy regression. Tighten it if the typical numbers ever approach it.

### Budgets — in-browser interaction (production build, 500-node fixture)

Measured against the **production** bundle (`npm run build` + `vite preview`) with `benchmark-500.json`
loaded, driving real `wheel`/pointer events and subtracting timer overhead. Dev-server numbers run
several times slower (unminified React) and are not a valid basis for these budgets.

| Interaction | Main-thread block p50 | p95 | DOM rendered (of full model) |
|-------------|----------------------|-----|------------------------------|
| Initial load (open 500-node doc) | ~34 ms to DOMContentLoaded | — | 16 nodes of 500 |
| Pan (wheel) | ~15 ms | ~21 ms | 16–30 nodes of 500 |
| Zoom (ctrl+wheel) | ~19 ms | ~23 ms | 16 nodes of 500 |
| Node drag (per pointermove) | ~17 ms | ~23 ms | **16 nodes of 500** |
| Route/segment drag (per pointermove) | ~16 ms | ~18 ms | 16 nodes / 59 paths of 300 |
| Selection (discrete click) | ~39 ms | ~44 ms | 16 nodes of 500 |

The continuous gestures (pan, zoom, node drag, route drag) all sit around one 60 fps frame —
interactive. Selection is a one-shot click (~39 ms — it also mounts the properties inspector), not a
sustained gesture, so it does not need per-frame budget.

The decisive point for "dragging avoids full-document work": with 500 nodes and 300 connections in
the model, **only ~16 node articles and ~59 connection paths are ever in the DOM** (off-screen
elements are culled to `null` in every layer), so a drag reconciles the on-screen set, not the whole
document — even though the command reducer still maps the full node array each move (~0.03 ms,
negligible).

## Manual interaction check (in-browser)

Automated timing can't measure pan/zoom/drag smoothness — do this on a typical Windows workstation:

1. `node bench/perf.mjs` to produce `bench/benchmark-500.json`.
2. Start the app (`npm run dev`) and **Open JSON** → `bench/benchmark-500.json`.
3. Verify, watching the browser's FPS/Performance panel for jank:
   - **Pan** (scroll) and **zoom** (Ctrl+scroll) stay interactive (no multi-hundred-ms stalls).
   - **Dragging a node** updates smoothly and does not visibly re-render the whole document.
   - **Selecting** and **route dragging** remain responsive.
4. Note that grid pan/zoom is CSS-driven (issue #21) and does not add per-node work.

## Already in place (verified in the render path)

- **Viewport culling** is implemented in both canvas layers: off-screen nodes and connections
  return `null` rather than rendering (`SystemNodeLayer.tsx` and `ConnectionLayer.tsx` gate on
  `intersectsBounds(..., viewportBounds)`). This is what keeps a pointer drag from doing avoidable
  full-document DOM work — a drag only reconciles the elements currently on screen, not all 500.
  Culling lives in the viewport layer (issue #5); do not fork it here.

## Not yet done (follow-ups — coordinate with the canvas owner)

- Additional render memoization (e.g. `React.memo` on the node article / layer) so the per-render
  traversal over all nodes is skipped when unrelated state changes. Only worth adding if the manual
  check reveals jank at 500+ nodes; it touches the boss's canvas render code, so coordinate first.
- An automated in-browser interaction benchmark (e.g. Playwright tracing) for pan/zoom/drag FPS.
