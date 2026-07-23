import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

// Issue #10 (phase 2): clipboard copy/cut/paste and keyboard nudge.

test("clipboard snapshots by value and clones with fresh ids", async () => {
  const clip = await read("app/model/clipboard.ts");
  // A value snapshot (structuredClone) lets a cut still be pasted after the originals are deleted.
  assert.match(clip, /export function collectMovables/);
  assert.match(clip, /structuredClone/);
  assert.match(clip, /export function cloneMovablePayload/);
  assert.match(clip, /createId\("node"\)/);
  assert.match(clip, /createId\("container"\)/);
  // clone remaps container membership + nested parents to the new ids
  assert.match(clip, /containerIdMap/);
  assert.match(clip, /nodeIdMap\.has\(node\.nestedParentId\)/);
});

test("selection set exposes copy, cut, paste, and nudge", async () => {
  const hook = await read("app/hooks/useSelectionSet.ts");
  for (const api of ["const copy", "const cut", "const paste", "const nudge"]) {
    assert.match(hook, new RegExp(api.replace(" ", "\\s")), `missing ${api}`);
  }
  // cut = copy + delete; paste re-adds via objects.add and cascades repeated pastes
  assert.match(hook, /copy\(\)\)\s*\{\s*removeSelected\(\)/);
  assert.match(hook, /pasteRun\.current/);
  assert.match(hook, /"objects\.add"/);
});

test("keyboard wires clipboard shortcuts and coarse/fine nudge", async () => {
  const hook = await read("app/hooks/useSelectionSet.ts");
  assert.match(hook, /=== "c"/);
  assert.match(hook, /=== "x"/);
  assert.match(hook, /=== "v"/);
  // arrow nudge, coarse with Shift (5 cells) vs fine (1 cell), coalesced into one undo step
  assert.match(hook, /Arrow(Left|Right|Up|Down)/);
  assert.match(hook, /GRID \* \(event\.shiftKey \? 5 : 1\)/);
  assert.match(hook, /"objects\.arrange", moves \}, "nudge"/);
});
