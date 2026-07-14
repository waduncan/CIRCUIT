import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("persists a backwards-compatible global node presentation mode", async () => {
  const [types, project, commands] = await Promise.all([
    readFile(new URL("app/model/types.ts", root), "utf8"),
    readFile(new URL("app/model/project.ts", root), "utf8"),
    readFile(new URL("app/model/commands.ts", root), "utf8"),
  ]);
  assert.match(types, /presentation: "detailed" \| "clean"/);
  assert.match(project, /project\.presentation === "clean" \? "clean" : "detailed"/);
  assert.match(commands, /presentation\.update/);
});

test("uses the shadcn Base UI switch to toggle clean and detailed node views", async () => {
  const [switchComponent, app, node] = await Promise.all([
    readFile(new URL("app/components/ui/Switch.tsx", root), "utf8"),
    readFile(new URL("app/DiagramApp.tsx", root), "utf8"),
    readFile(new URL("app/components/canvas/SystemNode.tsx", root), "utf8"),
  ]);
  assert.match(switchComponent, /@base-ui\/react\/switch/);
  assert.match(app, /Toggle detailed object view/);
  assert.match(node, /clean-node-body/);
  assert.match(node, /popover-composite-body/);
  assert.doesNotMatch(node, /<PopoverDescription>/);
  assert.ok(node.indexOf("node.ports.filter") > node.indexOf('project.presentation === "clean"'), "ports must render outside the presentation-specific card content");
});

test("exports clean nodes without changing exported port tiles", async () => {
  const exporter = await readFile(new URL("app/model/exportSvg.ts", root), "utf8");
  assert.match(exporter, /presentation === "clean"/);
  assert.match(exporter, /renderNode\(node, project\)/);
  assert.match(exporter, /Port tiles straddle the node boundary/);
});
