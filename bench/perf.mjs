// Runnable performance benchmark for issue #16.  Usage:  node bench/perf.mjs [nodeCount]
// Measures the document-scale costs the app pays (JSON serialize for autosave/export, parse for
// load, and a full-document immutable map + bounds pass that stands in for per-edit/per-frame work),
// and writes bench/benchmark-500.json so the same document can be opened in the editor for manual
// pan/zoom/drag testing. Reports numbers; it does not assert (see tests/performance.test.mjs for the
// regression guard). Deterministic — same input yields the same document and comparable timings.

import { writeFile } from "node:fs/promises";
import { generateBenchmarkProject, countTextItems } from "./generateBenchmark.mjs";

const nodeCount = Number(process.argv[2]) || 500;

function time(label, fn, iterations = 1) {
  // Warm up once, then take the best of a few runs to reduce noise.
  fn();
  let best = Infinity;
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = fn();
    const ms = performance.now() - start;
    if (ms < best) best = ms;
    if (i === iterations - 1) return { ms: best, result };
  }
  return { ms: best };
}

const project = generateBenchmarkProject({ nodeCount, connectionCount: Math.round(nodeCount * 0.6) });
const textItems = countTextItems(project);

const serialize = time("serialize", () => JSON.stringify(project), 5);
const json = JSON.stringify(project);
const parse = time("parse", () => JSON.parse(json), 5);

// Stand-in for the immutable command reducer touching the whole document (e.g. a node update maps
// every node) plus a bounds recompute (per-frame viewport work).
const mapPass = time("map+bounds", () => {
  const next = project.nodes.map((n) => (n.id === "node-0" ? { ...n, x: n.x + 1 } : n));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of next) { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x + n.width); maxY = Math.max(maxY, n.y + n.height); }
  return { minX, minY, maxX, maxY };
}, 20);

const bytes = Buffer.byteLength(json, "utf8");
const fmt = (ms) => `${ms.toFixed(2)} ms`;

console.log("\nCareFlow performance benchmark");
console.log("──────────────────────────────");
console.log(`nodes:        ${project.nodes.length}`);
console.log(`connections:  ${project.connections.length}`);
console.log(`containers:   ${project.containers.length}`);
console.log(`text items:   ${textItems}`);
console.log(`JSON size:    ${(bytes / 1024).toFixed(1)} KB`);
console.log("──────────────────────────────");
console.log(`serialize (autosave/export):  ${fmt(serialize.ms)}`);
console.log(`parse (open document):        ${fmt(parse.ms)}`);
console.log(`full map + bounds (per edit): ${fmt(mapPass.ms)}`);
console.log("──────────────────────────────");

const out = new URL("./benchmark-500.json", import.meta.url);
await writeFile(out, json);
console.log(`Wrote ${out.pathname.replace(/^\//, "")} — open it in CareFlow (Open JSON) for manual interaction testing.\n`);
