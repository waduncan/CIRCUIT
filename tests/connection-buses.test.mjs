import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("connection buses and routing controls persist in the project model", async () => {
  const [types, project, commands] = await Promise.all([
    readFile(new URL("app/model/types.ts", root), "utf8"),
    readFile(new URL("app/model/project.ts", root), "utf8"),
    readFile(new URL("app/model/commands.ts", root), "utf8"),
  ]);
  assert.match(types, /busId\?: string/);
  assert.match(types, /trunkPoints: Point\[\]/);
  assert.match(types, /crossingStyle: ConnectionCrossingStyle/);
  assert.match(project, /defaultConnectionRouting/);
  assert.match(commands, /connection\.bus\.update/);
});

test("canvas and export render buses, crossings, junctions, and stable z-order", async () => {
  const [layer, inspector, exporter] = await Promise.all([
    readFile(new URL("app/components/canvas/ConnectionLayer.tsx", root), "utf8"),
    readFile(new URL("app/components/PropertiesInspector.tsx", root), "utf8"),
    readFile(new URL("app/model/exportSvg.ts", root), "utf8"),
  ]);
  assert.match(layer, /routeCrossings/);
  assert.match(layer, /connection-junction/);
  assert.match(layer, /connection-crossing/);
  assert.match(inspector, /Use route as shared trunk/);
  assert.match(inspector, /Parallel spacing/);
  assert.match(exporter, /routing\?\.zIndex/);
});
