import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("previews a straight line to the cursor and the routed path inside a port hitbox", async () => {
  const [app, hook, layer, hitTest] = await Promise.all([
    readFile(new URL("app/DiagramApp.tsx", root), "utf8"),
    readFile(new URL("app/hooks/useConnectionPreview.ts", root), "utf8"),
    readFile(new URL("app/components/canvas/ConnectionLayer.tsx", root), "utf8"),
    readFile(new URL("app/model/connectionHitTest.ts", root), "utf8"),
  ]);
  assert.match(app, /onPointerMove=\{handleConnectionPointerMove\}/);
  assert.match(hook, /orthogonalRoutePoints\(sourcePoint, targetPoint\)/);
  assert.match(hook, /\[sourcePoint, targetPoint\]/);
  assert.match(hook, /invalid: Boolean\(target && !portsAreCompatible\(source, target\)\)/);
  assert.match(hitTest, /export function nearestConnectionPort/);
  assert.match(layer, /connection-preview/);
});
