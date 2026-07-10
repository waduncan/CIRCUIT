import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("persists configurable canvas settings with legacy project defaults", async () => {
  const [types, project, commands] = await Promise.all([
    readFile(new URL("app/model/types.ts", root), "utf8"),
    readFile(new URL("app/model/project.ts", root), "utf8"),
    readFile(new URL("app/model/commands.ts", root), "utf8"),
  ]);

  assert.match(types, /mode:\s*"bounded"\s*\|\s*"infinite"/);
  assert.match(types, /canvas:\s*CanvasSettings/);
  assert.match(project, /DEFAULT_CANVAS/);
  assert.match(project, /project\.canvas\?\.mode === "infinite"/);
  assert.match(commands, /type:\s*"canvas\.update"/);
});

test("supports cursor-centered zoom and fit controls", async () => {
  const [viewport, app] = await Promise.all([
    readFile(new URL("app/hooks/useCanvasViewport.ts", root), "utf8"),
    readFile(new URL("app/DiagramApp.tsx", root), "utf8"),
  ]);

  assert.match(viewport, /MIN_ZOOM\s*=\s*0\.1/);
  assert.match(viewport, /MAX_ZOOM\s*=\s*4/);
  assert.match(viewport, /function screenToCanvasPoint/);
  assert.match(viewport, /local\.x - canvasPoint\.x \* nextZoom/);
  assert.match(viewport, /fitDocument/);
  assert.match(viewport, /fitBounds/);
  assert.match(viewport, /resetView/);
  assert.match(app, /Fit document/);
  assert.match(app, /Fit selection/);
  assert.match(app, />1:1<\/button>/);
});

test("renders and culls layers using the current viewport instead of a fixed SVG", async () => {
  const [connections, nodes] = await Promise.all([
    readFile(new URL("app/components/canvas/ConnectionLayer.tsx", root), "utf8"),
    readFile(new URL("app/components/canvas/SystemNodeLayer.tsx", root), "utf8"),
  ]);

  assert.match(connections, /renderBounds/);
  assert.match(connections, /viewportBounds/);
  assert.match(connections, /intersectsBounds/);
  assert.doesNotMatch(connections, /2400\s+1600/);
  assert.match(nodes, /viewportBounds/);
  assert.match(nodes, /intersectsBounds/);
});
