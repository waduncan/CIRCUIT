import type { Bounds, Project, Selection } from "./types";
import { boundsFromNodes, boundsFromPoints, nodeBounds } from "./viewport";
import { containerBounds } from "./containers";
import { connectionRoute } from "./routing";
import { getProjectObject } from "./projectObject";

// Pure document search + focus geometry for issue #13. No React, no mutation — navigation only ever
// reads the project and produces a target Selection + Bounds, so it never alters document geometry.

export type SearchResultType = "node" | "port" | "container" | "connection" | "process";

export type SearchResult = {
  type: SearchResultType;
  id: string;
  /** Owning node id for a port result (ports are not independently selectable). */
  nodeId?: string;
  label: string;
  sublabel: string;
  /** Which field produced the match, shown to explain why a result appeared. */
  field: string;
  score: number;
};

const RESULT_LIMIT = 60;
// Node/port endpoints are what users hunt for most, so they outrank incidental metadata matches.
const TYPE_PRIORITY: Record<SearchResultType, number> = { port: 5, node: 4, container: 3, connection: 2, process: 1 };

// 0 = no match; higher = tighter match (exact > prefix > word-start > substring).
function matchScore(value: string | undefined, query: string): number {
  if (!value) return 0;
  const text = value.toLowerCase();
  if (text === query) return 4;
  if (text.startsWith(query)) return 3;
  if (new RegExp(`\\b${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text)) return 2;
  if (text.includes(query)) return 1;
  return 0;
}

type Field = { name: string; value: string | undefined };

// Best (score, field) across an object's searchable fields, weighting the primary label field so a
// name hit ranks above a description hit of the same tightness.
function bestField(fields: Field[], query: string): { score: number; field: string } {
  let best = { score: 0, field: "" };
  fields.forEach((entry, index) => {
    const raw = matchScore(entry.value, query);
    if (!raw) return;
    const weighted = raw * 10 + (index === 0 ? 3 : 0);
    if (weighted > best.score) best = { score: weighted, field: entry.name };
  });
  return best;
}

// Real endpoint/name queries are short; capping the length bounds the per-keystroke work (a new
// RegExp is built per field) so a pasted multi-thousand-character string can't freeze the editor.
const MAX_QUERY = 80;

export function searchProject(project: Project, rawQuery: string): SearchResult[] {
  const query = rawQuery.trim().slice(0, MAX_QUERY).toLowerCase();
  if (!query) return [];
  const results: SearchResult[] = [];
  const containerName = (id: string | undefined) => (id ? getProjectObject(project, "container", id)?.name : undefined);

  for (const node of project.nodes) {
    const composite = node.composite;
    const compositeText = composite
      ? [composite.headerLabel, composite.footer, composite.logoText,
         ...composite.sections.flatMap((section) => [section.title,
           ...section.fields.flatMap((f) => [f.label, f.value]),
           ...section.endpoints.flatMap((e) => [e.name, e.address, e.details])])].join(" ")
      : undefined;
    const nodeMatch = bestField([
      { name: "name", value: node.name },
      { name: "description", value: node.description },
      { name: "type", value: node.kind },
      { name: "capabilities", value: node.capabilities.join(" ") },
      { name: "details", value: compositeText },
    ], query);
    if (nodeMatch.score) {
      results.push({ type: "node", id: node.id, label: node.name, field: nodeMatch.field,
        sublabel: `${node.kind}${containerName(node.containerId) ? ` · ${containerName(node.containerId)}` : ""}`, score: nodeMatch.score + TYPE_PRIORITY.node });
    }
    // Ports are the "named endpoints" the acceptance criteria call out — searched independently so an
    // address or interface identifier finds the exact port even when the node name does not match.
    for (const port of node.ports) {
      const portMatch = bestField([
        { name: "name", value: port.name },
        { name: "identifier", value: port.secondaryIdentifier },
        { name: "interface", value: `${port.capability} ${port.subtype}` },
        { name: "direction", value: port.direction },
      ], query);
      if (portMatch.score) {
        results.push({ type: "port", id: port.id, nodeId: node.id, label: port.name, field: portMatch.field,
          sublabel: `${node.name} · ${port.capability} ${port.subtype}`, score: portMatch.score + TYPE_PRIORITY.port });
      }
    }
  }

  for (const container of project.containers) {
    const match = bestField([
      { name: "name", value: container.name },
      { name: "description", value: container.description },
      { name: "type", value: `${container.kind} container` },
    ], query);
    if (match.score) results.push({ type: "container", id: container.id, label: container.name, field: match.field,
      sublabel: `${container.kind} container`, score: match.score + TYPE_PRIORITY.container });
  }

  for (const connection of project.connections) {
    const labelText = (connection.labels ?? []).map((l) => l.text).join(" ");
    const match = bestField([
      { name: "data type", value: connection.dataType },
      { name: "interface", value: `${connection.capability} ${connection.subtype}` },
      { name: "label", value: labelText },
      { name: "description", value: connection.description },
    ], query);
    if (match.score) {
      const source = getProjectObject(project, "node", connection.sourceNodeId);
      const target = getProjectObject(project, "node", connection.targetNodeId);
      results.push({ type: "connection", id: connection.id, label: `${source?.name ?? "?"} → ${target?.name ?? "?"}`,
        field: match.field, sublabel: `${connection.capability} ${connection.subtype}`, score: match.score + TYPE_PRIORITY.connection });
    }
  }

  for (const process of project.processes) {
    const match = bestField([
      { name: "name", value: process.name },
      { name: "description", value: process.description },
    ], query);
    if (match.score) results.push({ type: "process", id: process.id, label: process.name, field: match.field,
      sublabel: "process", score: match.score + TYPE_PRIORITY.process });
  }

  results.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  return results.slice(0, RESULT_LIMIT);
}

/** The selection a result focuses. Ports have no selectable type, so they focus their owning node. */
export function resultSelection(result: SearchResult): Selection {
  if (result.type === "port") return { type: "node", id: result.nodeId! };
  return { type: result.type, id: result.id };
}

/** Canvas-space bounds to fit when focusing a result. Read-only — never mutates the project. */
export function resultBounds(project: Project, result: SearchResult): Bounds | null {
  switch (result.type) {
    case "node":
    case "port": {
      const node = getProjectObject(project, "node", result.type === "port" ? result.nodeId : result.id);
      return node ? nodeBounds(node) : null;
    }
    case "container": {
      const container = getProjectObject(project, "container", result.id);
      return container ? containerBounds(container) : null;
    }
    case "connection": {
      const connection = getProjectObject(project, "connection", result.id);
      return connection ? boundsFromPoints(connectionRoute(project, connection)) : null;
    }
    case "process": {
      const process = getProjectObject(project, "process", result.id);
      return process ? boundsFromNodes(project.nodes.filter((node) => process.checkpoints.includes(node.id))) : null;
    }
  }
}

// Breadcrumb of the containing context for the current selection: container → nested parent chain →
// object. Answers the issue's "selection context for nested containers" and works for collapsed or
// nested content because it walks the model, not the rendered canvas.
export function selectionBreadcrumb(project: Project, selection: Selection): string[] {
  if (!selection) return [];
  if (selection.type === "container") {
    const container = getProjectObject(project, "container", selection.id);
    return container ? [container.name] : [];
  }
  if (selection.type === "process") {
    const process = getProjectObject(project, "process", selection.id);
    return process ? ["Processes", process.name] : [];
  }
  if (selection.type === "connection") {
    const connection = getProjectObject(project, "connection", selection.id);
    if (!connection) return [];
    const source = getProjectObject(project, "node", connection.sourceNodeId);
    const target = getProjectObject(project, "node", connection.targetNodeId);
    return [`${source?.name ?? "?"} → ${target?.name ?? "?"}`];
  }
  const node = getProjectObject(project, "node", selection.id);
  if (!node) return [];
  const trail: string[] = [];
  const container = getProjectObject(project, "container", node.containerId);
  if (container) trail.push(container.name);
  // Walk nested parents (guard against cycles) so a node inside a collapsed group shows its path.
  const seen = new Set<string>([node.id]);
  const parents: string[] = [];
  let parentId = node.nestedParentId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = getProjectObject(project, "node", parentId);
    if (!parent) break;
    parents.unshift(parent.name);
    parentId = parent.nestedParentId;
  }
  return [...trail, ...parents, node.name];
}
