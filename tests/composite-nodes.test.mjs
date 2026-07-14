import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("persists project-owned composite templates and structured node content", async () => {
  const [types, templates, project] = await Promise.all([
    readFile(new URL("app/model/types.ts", root), "utf8"),
    readFile(new URL("app/model/compositeTemplates.ts", root), "utf8"),
    readFile(new URL("app/model/project.ts", root), "utf8"),
  ]);

  assert.match(types, /export type CompositeNodeTemplate/);
  assert.match(types, /composite\?: CompositeNodeContent/);
  assert.match(types, /nodeTemplates: CompositeNodeTemplate\[\]/);
  for (const category of ["gateway", "server", "modality-collection", "database", "storage", "browser-client", "external-system"]) {
    assert.match(templates, new RegExp(`category: "${category}"`));
  }
  assert.match(project, /Array\.isArray\(project\.nodeTemplates\)/);
  assert.match(project, /defaultCompositeTemplates/);
});

test("creates, duplicates, and edits composite node instances", async () => {
  const [app, inspector, node] = await Promise.all([
    readFile(new URL("app/DiagramApp.tsx", root), "utf8"),
    readFile(new URL("app/components/PropertiesInspector.tsx", root), "utf8"),
    readFile(new URL("app/components/canvas/SystemNode.tsx", root), "utf8"),
  ]);

  assert.match(app, /compositeLibraryItems\(project\.nodeTemplates\)/);
  assert.match(app, /cloneCompositeContent\(template\)/);
  assert.match(app, /const duplicateNode/);
  assert.match(inspector, /Card template/);
  assert.match(inspector, /Composite content/);
  assert.match(inspector, /Add endpoint row/);
  assert.match(node, /composite-section/);
  assert.match(node, /composite-endpoints/);
});

test("supports four-sided port groups in routing, editing, and export", async () => {
  const [routing, inspector, exportSvg] = await Promise.all([
    readFile(new URL("app/model/routing.ts", root), "utf8"),
    readFile(new URL("app/components/PropertiesInspector.tsx", root), "utf8"),
    readFile(new URL("app/model/exportSvg.ts", root), "utf8"),
  ]);

  assert.match(routing, /side === "top"/);
  assert.match(routing, /side === "bottom"/);
  assert.match(inspector, /<option value="left">Left<\/option>/);
  assert.match(inspector, /<option value="right">Right<\/option>/);
  assert.match(inspector, /<option value="top">Top<\/option>/);
  assert.match(inspector, /<option value="bottom">Bottom<\/option>/);
  assert.match(exportSvg, /node\.composite\.sections/);
  assert.match(exportSvg, /font-size="10"/);
});
