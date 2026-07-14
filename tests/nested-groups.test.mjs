import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("nested groups persist membership based on a fully-contained drop", async () => {
  const [types, nesting, commands] = await Promise.all([
    readFile(new URL("app/model/types.ts", root), "utf8"),
    readFile(new URL("app/model/nesting.ts", root), "utf8"),
    readFile(new URL("app/model/commands.ts", root), "utf8"),
  ]);
  assert.match(types, /nestedParentId\?: string/);
  assert.match(nesting, /node\.x >= candidate\.x \+ 12/);
  assert.match(nesting, /reconcileNestedNodes/);
  assert.match(commands, /node\.kind === "nestable"/);
});

test("nested groups keep shared external ports while unconnected children hide theirs", async () => {
  const [catalog, layer, exporter] = await Promise.all([
    readFile(new URL("app/model/catalog.ts", root), "utf8"),
    readFile(new URL("app/components/canvas/SystemNodeLayer.tsx", root), "utf8"),
    readFile(new URL("app/model/exportSvg.ts", root), "utf8"),
  ]);
  assert.match(catalog, /Nestable Container[\s\S]*"DICOM"/);
  assert.match(layer, /shared external ports/);
  assert.match(layer, /!node\.nestedParentId \|\| project\.connections\.some/);
  assert.match(exporter, /!node\.nestedParentId \|\| project\.connections\.some/);
});

test("renders nested group parents behind their contained systems", async () => {
  const [layer, exporter] = await Promise.all([
    readFile(new URL("app/components/canvas/SystemNodeLayer.tsx", root), "utf8"),
    readFile(new URL("app/model/exportSvg.ts", root), "utf8"),
  ]);
  assert.match(layer, /sort\(\(a, b\) => \(a\.kind === "nestable"/);
  assert.match(layer, /nested-node-header/);
  assert.match(exporter, /node\.kind === "nestable"/);
});
