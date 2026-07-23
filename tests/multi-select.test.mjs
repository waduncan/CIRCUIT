import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

// Issue #10 (phase 1): multi-select, group move, align, distribute, duplicate, delete.

test("batch multi-object commands exist and reconcile", async () => {
  const commands = await read("app/model/commands.ts");
  for (const kind of ["objects.arrange", "objects.delete", "objects.add"]) {
    assert.match(commands, new RegExp(`"${kind.replace(".", "\\.")}"`), `missing command ${kind}`);
  }
  // arrange moves nodes + containers and re-runs container/nesting reconciliation
  assert.match(commands, /case "objects\.arrange":[\s\S]*reconcileNodeContainers/);
  // delete cleans up connections + process checkpoints for removed nodes
  assert.match(commands, /case "objects\.delete":[\s\S]*connections: project\.connections\.filter/);
});

test("alignment and distribution math covers all edges and both axes", async () => {
  const arrange = await read("app/model/arrange.ts");
  assert.match(arrange, /export function alignMoves/);
  assert.match(arrange, /export function distributeMoves/);
  for (const edge of ["left", "right", "hcenter", "top", "bottom", "vcenter"]) {
    assert.match(arrange, new RegExp(`case "${edge}"`), `align missing ${edge}`);
  }
  assert.match(arrange, /length < 2/); // align needs 2+
  assert.match(arrange, /length < 3/); // distribute needs 3+
});

test("group move preserves relative positions by snapping the delta once", async () => {
  const [diagram, container] = await Promise.all([
    read("app/hooks/useDiagramInteractions.ts"),
    read("app/hooks/useContainerInteractions.ts"),
  ]);
  // Both drag hooks snap an anchor object and offset the group by that same delta (not per-object),
  // so a multi-object move never drifts relative spacing.
  for (const source of [diagram, container]) {
    assert.match(source, /const anchor =/);
    assert.match(source, /origin\.x \+ dx/);
    assert.match(source, /moveObjects\(/);
  }
});

test("selection set drives multi-select, arrange, duplicate, and delete", async () => {
  const [hook, clip] = await Promise.all([
    read("app/hooks/useSelectionSet.ts"),
    read("app/model/clipboard.ts"),
  ]);
  for (const api of ["selectAtPointer", "replaceRefs", "align", "distribute", "duplicate", "removeSelected"]) {
    assert.match(hook, new RegExp(`\\b${api}\\b`), `selection set missing ${api}`);
  }
  assert.match(hook, /"Delete"|"Backspace"/); // delete shortcut
  assert.match(hook, /toLowerCase\(\) === "d"/); // Ctrl+D duplicate
  assert.match(clip, /export function cloneMovables/);
  assert.match(clip, /createId\("node"\)/); // clones get fresh ids
});

test("the shell wires marquee, arrange actions, and per-object selection", async () => {
  const [app, nodeLayer, containerLayer] = await Promise.all([
    read("app/DiagramApp.tsx"),
    read("app/components/canvas/SystemNodeLayer.tsx"),
    read("app/components/canvas/ContainerLayer.tsx"),
  ]);
  assert.match(app, /useSelectionSet/);
  assert.match(app, /useMarquee/);
  assert.match(app, /<SelectionActions/);
  assert.match(app, /beginMarquee/);
  assert.match(nodeLayer, /isSelected\("node"/);
  assert.match(containerLayer, /isSelected\("container"/);
});
