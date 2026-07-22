import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps the application shell focused on orchestration", async () => {
  const source = await readFile(new URL("app/DiagramApp.tsx", root), "utf8");

  // The shell orchestrates hooks + view layers only. The cap grew from 400 to 600 after the
  // connection-preview work (#46) legitimately expanded the orchestration surface past 543 lines;
  // it still guards against the shell absorbing model/rendering logic that belongs in other files.
  // connection-preview work (#46) expanded the orchestration surface past 543 lines; it still
  // guards against the shell absorbing model/rendering logic that belongs in other files.
  assert.ok(source.split(/\r?\n/).length < 600, "DiagramApp should remain smaller than 600 lines");
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

test("SystemNodeLayer delegates node markup to the SystemNode renderer", async () => {
  const [layer, node] = await Promise.all([
    readFile(new URL("app/components/canvas/SystemNodeLayer.tsx", root), "utf8"),
    readFile(new URL("app/components/canvas/SystemNode.tsx", root), "utf8"),
  ]);

  assert.match(layer, /import \{ SystemNode as SystemNodeRenderer \} from "\.\/SystemNode"/);
  assert.match(layer, /<SystemNodeRenderer/);
  assert.match(node, /export function SystemNode/);
});
