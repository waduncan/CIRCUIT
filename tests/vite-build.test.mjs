import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("builds the local Vite SPA shell", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");

  assert.match(html, /<title>CareFlow Studio<\/title>/);
  assert.match(html, /id="root"/);
  assert.match(html, /\/assets\/[^"']+\.js/);
  assert.doesNotMatch(html, /next|vinext|cloudflare|chatgpt/i);

  const scriptPath = html.match(/src="(\/assets\/[^"']+\.js)"/)?.[1];
  assert.ok(scriptPath, "the Vite bundle should be linked from the SPA shell");
  const script = await readFile(new URL(`../dist${scriptPath}`, import.meta.url), "utf8");
  assert.match(script, /Every 90° corner has a handle/);
  assert.match(script, /drag between handles to move a whole segment/);
  assert.match(script, /Ctrl\+right-click removes one/);
});

test("deduplicates React for local Vite development", async () => {
  const config = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");

  assert.match(config, /dedupe:\s*\["react",\s*"react-dom"\]/);
});
