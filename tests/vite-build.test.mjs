import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("builds the local Vite SPA shell", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");

  assert.match(html, /<title>CareFlow Studio<\/title>/);
  assert.match(html, /id="root"/);
  assert.match(html, /\/assets\/[^"']+\.js/);
  assert.doesNotMatch(html, /next|vinext|cloudflare|chatgpt/i);
});
