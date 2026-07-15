import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

// Issue #13: document search, minimap, and focus navigation.

test("search covers nodes, ports/endpoints, containers, connections, and processes", async () => {
  const source = await read("app/model/search.ts");
  assert.match(source, /export function searchProject/);
  assert.match(source, /export function resultBounds/);
  assert.match(source, /export function resultSelection/);
  assert.match(source, /export function selectionBreadcrumb/);
  // Ports are the "named endpoints" the acceptance criteria require to be findable.
  assert.match(source, /for \(const port of node\.ports\)/);
  assert.match(source, /type: "port"/);
  assert.match(source, /secondaryIdentifier/); // endpoint identifier is searchable
  // Metadata surfaces: connection labels and composite content.
  assert.match(source, /connection\.labels/);
  assert.match(source, /composite\.sections/);
});

test("navigation never alters document geometry (read-only focus)", async () => {
  const [nav, minimap, search] = await Promise.all([
    read("app/hooks/useDocumentNavigation.ts"),
    read("app/components/Minimap.tsx"),
    read("app/model/search.ts"),
  ]);
  // Focus/minimap may only move the viewport + selection — never dispatch a command or setProject.
  for (const source of [nav, minimap, search]) {
    assert.doesNotMatch(source, /dispatch\s*\(/);
    assert.doesNotMatch(source, /applyProjectCommand/);
    assert.doesNotMatch(source, /setProject/);
  }
  assert.match(nav, /fitBounds/);
  assert.match(nav, /setSelection/);
  assert.match(minimap, /panTo/);
});

test("search is hardened against injection and unbounded work", async () => {
  const [search, docSearch, minimap] = await Promise.all([
    read("app/model/search.ts"),
    read("app/components/DocumentSearch.tsx"),
    read("app/components/Minimap.tsx"),
  ]);
  // No HTML/JS injection sinks in the search/navigation UI — result text (which can come from an
  // imported project) must render as escaped text, never as markup.
  for (const source of [search, docSearch, minimap]) {
    assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
    assert.doesNotMatch(source, /\binnerHTML\b/);
    assert.doesNotMatch(source, /\beval\(|new Function\(/);
  }
  // The query becomes a RegExp, so metacharacters must be escaped (prevents regex injection / ReDoS)
  // and the length is capped so a pasted megastring can't stall the editor.
  assert.match(search, /new RegExp/);
  assert.match(search, /"\\\\\$&"/); // escape-replacement applied to the query before building the RegExp
  assert.match(search, /MAX_QUERY/);
  assert.match(search, /slice\(0, MAX_QUERY\)/);
});

test("viewport exposes zoom-preserving panTo and the shell wires the navigation UI", async () => {
  const [viewport, app] = await Promise.all([
    read("app/hooks/useCanvasViewport.ts"),
    read("app/DiagramApp.tsx"),
  ]);
  assert.match(viewport, /const panTo =/);
  assert.match(viewport, /\bpanTo\b/);
  assert.match(app, /<Minimap/);
  assert.match(app, /<DocumentSearch/);
  assert.match(app, /selectionBreadcrumb\(project, selection\)/);
});
