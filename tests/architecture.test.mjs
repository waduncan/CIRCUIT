import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps the application shell focused on orchestration", async () => {
  const source = await readFile(new URL("app/DiagramApp.tsx", root), "utf8");

  assert.ok(source.split(/\r?\n/).length < 400, "DiagramApp should remain smaller than 400 lines");
  assert.match(source, /useProjectDocument/);
  assert.match(source, /useCanvasViewport/);
  assert.match(source, /useDiagramInteractions/);
  assert.match(source, /<ConnectionLayer/);
  assert.match(source, /<SystemNodeLayer/);
  assert.match(source, /<PropertiesInspector/);
  assert.doesNotMatch(source, /type Project\s*=/);
  assert.doesNotMatch(source, /function orthogonalRoutePoints/);
});

test("defines typed document commands and migration boundaries", async () => {
  const [commands, project, persistence] = await Promise.all([
    readFile(new URL("app/model/commands.ts", root), "utf8"),
    readFile(new URL("app/model/project.ts", root), "utf8"),
    readFile(new URL("app/hooks/useProjectDocument.ts", root), "utf8"),
  ]);

  assert.match(commands, /export type ProjectCommand/);
  assert.match(commands, /selection\.delete/);
  assert.match(commands, /applyProjectCommand/);
  assert.match(project, /migrateProjectDocument/);
  assert.match(persistence, /migrateProjectDocument/);
});
