import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

function numericMatches(source, expression) {
  return [...source.matchAll(expression)].map((match) => Number(match[1]));
}

test("keeps editor CSS font sizes at or above 10px", async () => {
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  const sizes = numericMatches(css, /font-size:\s*(\d+(?:\.\d+)?)px/g);

  assert.ok(sizes.length > 0, "expected explicit editor font sizes");
  assert.deepEqual(sizes.filter((size) => size < 10), []);
  assert.match(css, /\.node-header strong \{ font-size: 12px/);
  assert.match(css, /\.port-property strong \{ font-size: 12px/);
});

test("keeps exported SVG text at or above 10px", async () => {
  const [renderer, printDocument] = await Promise.all([
    readFile(new URL("app/model/exportSvg.ts", root), "utf8"),
    readFile(new URL("app/utils/printDocument.ts", root), "utf8"),
  ]);
  const sizes = numericMatches(renderer, /font-size="(\d+(?:\.\d+)?)"/g);
  const shorthandSizes = numericMatches(printDocument, /font:\s*[^;]*?(\d+(?:\.\d+)?)px/g);

  assert.ok(sizes.length > 0, "expected explicit SVG font sizes");
  assert.deepEqual(sizes.filter((size) => size < 10), []);
  assert.deepEqual(shorthandSizes.filter((size) => size < 10), []);
});
