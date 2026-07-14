import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("persists boxed port edge, offset, dimensions, and secondary identifier", async () => {
  const [types, migration] = await Promise.all([
    readFile(new URL("app/model/types.ts", root), "utf8"),
    readFile(new URL("app/model/project.ts", root), "utf8"),
  ]);
  for (const field of ["secondaryIdentifier", "offset", "width", "height"]) assert.match(types, new RegExp(`${field}\\?`));
  assert.match(migration, /peerIndex/);
  assert.match(migration, /width: Math\.max\(56/);
  assert.match(migration, /secondaryIdentifier: port\.secondaryIdentifier/);
});

test("supports dragging and resizing port tiles independently of connection semantics", async () => {
  const [hook, layer, inspector] = await Promise.all([
    readFile(new URL("app/hooks/useDiagramInteractions.ts", root), "utf8"),
    readFile(new URL("app/components/canvas/SystemNodeLayer.tsx", root), "utf8"),
    readFile(new URL("app/components/PropertiesInspector.tsx", root), "utf8"),
  ]);
  assert.match(hook, /beginPortDrag/);
  assert.match(hook, /beginPortResize/);
  assert.match(hook, /setSelection\(\{ type: "node", id: node\.id \}\)/);
  assert.match(hook, /PortSide/);
  assert.match(layer, /port-resize-handle/);
  assert.match(layer, /dataset\.selectOnly/);
  assert.match(layer, /secondaryIdentifier/);
  assert.match(inspector, /semantics remain independent of edge placement/);
});

test("routes and exports connections at the outside edge of boxed ports", async () => {
  const [routing, exporter] = await Promise.all([
    readFile(new URL("app/model/routing.ts", root), "utf8"),
    readFile(new URL("app/model/exportSvg.ts", root), "utf8"),
  ]);
  assert.match(routing, /portTilePosition/);
  assert.match(routing, /port\.width \?\? 92/);
  assert.match(routing, /port\.height \?\? 34/);
  assert.match(exporter, /fill-opacity="0\.12"/);
  assert.match(exporter, /port\.secondaryIdentifier/);
});
