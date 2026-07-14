import assert from "node:assert/strict";
import test from "node:test";
import { generateBenchmarkProject, countTextItems } from "../bench/generateBenchmark.mjs";

// Issue #16: a reference-scale benchmark fixture plus guards against gross serialization regressions.

test("benchmark fixture meets the reference-scale targets", () => {
  const project = generateBenchmarkProject();
  assert.ok(project.nodes.length >= 500, `expected >=500 nodes, got ${project.nodes.length}`);
  assert.ok(project.connections.length >= 300, `expected >=300 connections, got ${project.connections.length}`);
  assert.ok(countTextItems(project) >= 1500, `expected >=1500 text items, got ${countTextItems(project)}`);
});

test("generated document is a valid, current-schema project", () => {
  const project = generateBenchmarkProject();
  assert.equal(project.version, 1);
  for (const key of ["canvas", "presentation", "containers", "nodes", "connections", "processes", "nodeTemplates"]) {
    assert.ok(key in project, `missing project.${key}`);
  }
  // Every connection references existing nodes and ports (would break rendering otherwise).
  const nodeIds = new Set(project.nodes.map((n) => n.id));
  const portIds = new Set(project.nodes.flatMap((n) => n.ports.map((p) => p.id)));
  for (const c of project.connections) {
    assert.ok(nodeIds.has(c.sourceNodeId) && nodeIds.has(c.targetNodeId), `connection ${c.id} references a missing node`);
    assert.ok(portIds.has(c.sourcePortId) && portIds.has(c.targetPortId), `connection ${c.id} references a missing port`);
  }
});

test("generation is deterministic for a given seed", () => {
  assert.equal(
    JSON.stringify(generateBenchmarkProject({ seed: 7 })),
    JSON.stringify(generateBenchmarkProject({ seed: 7 })),
  );
});

test("serialize + parse round-trip stays within budget", () => {
  const project = generateBenchmarkProject();
  const start = performance.now();
  const round = JSON.parse(JSON.stringify(project));
  const ms = performance.now() - start;
  // Typical is a few ms; a generous ceiling catches accidental O(n^2)/deep-copy regressions
  // without flaking on slow CI. Update alongside documented targets in docs/PERFORMANCE.md.
  assert.ok(ms < 750, `serialize+parse took ${ms.toFixed(1)}ms (budget 750ms)`);
  assert.equal(round.nodes.length, project.nodes.length);
});
