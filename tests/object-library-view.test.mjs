import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("provides a dedicated SPA object library workspace", async () => {
  const [app, libraryView, viewport] = await Promise.all([
    readFile(new URL("app/DiagramApp.tsx", root), "utf8"),
    readFile(new URL("app/components/ObjectLibraryView.tsx", root), "utf8"),
    readFile(new URL("app/hooks/useCanvasViewport.ts", root), "utf8"),
  ]);

  assert.match(app, /activeView.*"diagram".*"library"/);
  assert.match(app, /aria-label="Project views"/);
  assert.match(app, /<ObjectLibraryView/);
  assert.doesNotMatch(app, /libraryOpen/);
  assert.match(libraryView, /Search object library/);
  assert.match(libraryView, /Create custom object/);
  assert.match(libraryView, /Export custom library/);
  assert.match(libraryView, /Import library JSON/);
  assert.match(libraryView, /Return to diagram/);
  assert.match(app, /active:\s*activeView === "diagram"/);
  assert.match(viewport, /if \(!active\) return/);
  assert.match(viewport, /\[active\]/);
});
