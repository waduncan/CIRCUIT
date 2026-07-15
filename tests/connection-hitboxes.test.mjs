import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("connection mode uses enlarged nearest-port hit testing without resizing ports", async () => {
  const [app, hitTest, node, css] = await Promise.all([
    readFile(new URL("app/DiagramApp.tsx", root), "utf8"),
    readFile(new URL("app/model/connectionHitTest.ts", root), "utf8"),
    readFile(new URL("app/components/canvas/SystemNode.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(app, /28 \/ zoom/);
  assert.match(app, /onPointerDownCapture=\{handleConnectionPointerDown\}/);
  assert.match(hitTest, /a\.distance - b\.distance/);
  assert.match(hitTest, /port\.direction === "outbound"/);
  assert.match(hitTest, /port\.direction === "inbound" && portsAreCompatible/);
  assert.match(node, /connectionMode \? "target-ready"/);
  assert.match(css, /\.node-port \{ position: absolute/);
  assert.doesNotMatch(css, /is-connecting[^}]*\.node-port[^}]*\b(width|height)\s*:/);
});
