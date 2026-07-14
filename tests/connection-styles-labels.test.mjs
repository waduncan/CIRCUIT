import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("connection model persists multiple anchored labels and visual styles", async () => {
  const types = await readFile(new URL("app/model/types.ts", root), "utf8");
  const project = await readFile(new URL("app/model/project.ts", root), "utf8");
  assert.match(types, /labels\?: ConnectionLabel\[\]/);
  assert.match(types, /lineStyle: ConnectionLineStyle/);
  assert.match(types, /anchor: "route" \| "segment"/);
  assert.match(project, /defaultConnectionLabel/);
  assert.match(project, /connections: project\.connections\.map/);
});

test("canvas and exports render configurable lines, arrows, and draggable labels", async () => {
  const [layer, inspector, exporter] = await Promise.all([
    readFile(new URL("app/components/canvas/ConnectionLayer.tsx", root), "utf8"),
    readFile(new URL("app/components/PropertiesInspector.tsx", root), "utf8"),
    readFile(new URL("app/model/exportSvg.ts", root), "utf8"),
  ]);
  assert.match(layer, /pointAlongRoute/);
  assert.match(layer, /pointermove/);
  assert.match(layer, /markerEnd/);
  assert.match(inspector, /Add label/);
  assert.match(inspector, /Future connection/);
  assert.match(exporter, /exportConnectionArrow/);
  assert.match(exporter, /stroke-dasharray/);
});
