import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

// Issue #49: dark mode with a persisted, flash-free theme toggle.

test("theme choice is persisted to localStorage and applied to the document", async () => {
  const source = await read("app/hooks/useTheme.ts");
  assert.match(source, /THEME_STORAGE_KEY\s*=\s*"circuit-theme"/);
  assert.match(source, /localStorage\.setItem/);
  assert.match(source, /localStorage\.getItem/);
  assert.match(source, /document\.documentElement\.dataset\.theme/);
  assert.match(source, /prefers-color-scheme/); // first-visit default follows the OS
});

test("the saved theme is applied before first paint to avoid a flash", async () => {
  const html = await read("index.html");
  // An inline script in <head> must set data-theme from storage before the module bundle loads.
  const headScriptBeforeModule = /<script>[\s\S]*?dataset\.theme[\s\S]*?<\/script>[\s\S]*?<script type="module"/;
  assert.match(html, headScriptBeforeModule);
  assert.match(html, /localStorage\.getItem\("circuit-theme"\)/);
});

test("a theme toggle built on the shared Switch is mounted in the shell", async () => {
  const [toggle, app] = await Promise.all([
    read("app/components/ThemeToggle.tsx"),
    read("app/DiagramApp.tsx"),
  ]);
  assert.match(toggle, /from "\.\/ui\/Switch"/);
  assert.match(toggle, /useTheme/);
  assert.match(toggle, /onCheckedChange/);
  assert.match(app, /<ThemeToggle/);
});

test("a dark theme layer is defined and keyed on data-theme", async () => {
  const css = await read("app/globals.css");
  assert.match(css, /:root\[data-theme="dark"\]/);
});
