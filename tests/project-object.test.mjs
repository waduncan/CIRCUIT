import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("centralizes project-owned object lookups in getProjectObject", async () => {
  const [selector, app, inspector, routing] = await Promise.all([
    readFile(new URL("app/model/projectObject.ts", root), "utf8"),
    readFile(new URL("app/DiagramApp.tsx", root), "utf8"),
    readFile(new URL("app/components/PropertiesInspector.tsx", root), "utf8"),
    readFile(new URL("app/model/routing.ts", root), "utf8"),
  ]);

  for (const type of ["container", "node", "port", "connection", "process", "nodeTemplate"]) assert.match(selector, new RegExp(`case "${type}"`));
  for (const source of [app, inspector, routing]) assert.match(source, /getProjectObject/);
  for (const source of [app, inspector, routing]) assert.doesNotMatch(source, /(project\.(nodes|containers|connections|processes|nodeTemplates)|node\.ports)\.find/);
});
