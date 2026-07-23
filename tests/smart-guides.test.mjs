import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

// Issue #10 (phase 3): smart guides, configurable grid snapping, and group resize.

test("smart guides snap to edges/centers and stay zoom-accurate", async () => {
  const guides = await read("app/model/guides.ts");
  assert.match(guides, /export function snapToGuides/);
  assert.match(guides, /export function resolveGroupDrag/);
  assert.match(guides, /export function groupDragContext/);
  // threshold is expressed in canvas units (px / zoom) so it holds at any zoom level
  assert.match(guides, /6 \/ zoom/);
  // compares left/center/right and top/center/bottom lines
  assert.match(guides, /b\.x \+ b\.width \/ 2/);
  assert.match(guides, /b\.y \+ b\.height \/ 2/);
});

test("drag hooks route group move through guides + report active guides", async () => {
  const [diagram, container] = await Promise.all([
    read("app/hooks/useDiagramInteractions.ts"),
    read("app/hooks/useContainerInteractions.ts"),
  ]);
  for (const source of [diagram, container]) {
    assert.match(source, /resolveGroupDrag/);
    assert.match(source, /onGuides\(guides\)/);
    assert.match(source, /onGuides\(\[\]\)/); // cleared on pointer up
    assert.match(source, /project\.canvas\.snapToGrid !== false/);
  }
});

test("grid snapping is a configurable canvas setting with a toolbar toggle", async () => {
  const [types, toolbar, app] = await Promise.all([
    read("app/model/types.ts"),
    read("app/components/CanvasToolbar.tsx"),
    read("app/DiagramApp.tsx"),
  ]);
  assert.match(types, /snapToGrid\?: boolean/);
  assert.match(toolbar, /onToggleSnap/);
  assert.match(app, /snapToGrid: project\.canvas\.snapToGrid === false/); // toggle dispatches canvas.update
});

test("group resize scales the selection with min-size clamping", async () => {
  const [arrange, hook, commands, app] = await Promise.all([
    read("app/model/arrange.ts"),
    read("app/hooks/useGroupResize.ts"),
    read("app/model/commands.ts"),
    read("app/DiagramApp.tsx"),
  ]);
  assert.match(arrange, /export function resizeMoves/);
  assert.match(arrange, /Math\.max\(rawScaleX, minScaleX\)/); // clamp so nothing goes below min size
  assert.match(hook, /export function useGroupResize/);
  // arrange command carries width/height for resize
  assert.match(commands, /width\?: number; height\?: number/);
  assert.match(app, /group-resize-handle/);
  assert.match(app, /smart-guide/);
});
