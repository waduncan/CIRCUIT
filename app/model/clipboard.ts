import { createId } from "./project";
import { getProjectObject } from "./projectObject";
import type { DiagramContainer, Project, SelectionRef, SystemNode } from "./types";

// Clipboard + duplicate helpers for multi-object editing (#10). Pure — they snapshot and clone
// movable objects (nodes + containers) without touching the project.

export type MovablePayload = { nodes: SystemNode[]; containers: DiagramContainer[] };

// Snapshot the selected movables by value, so they survive a cut (originals deleted) or later edits.
export function collectMovables(project: Project, refs: SelectionRef[]): MovablePayload {
  const containers: DiagramContainer[] = [];
  const nodes: SystemNode[] = [];
  for (const ref of refs) {
    if (ref.type === "container") {
      const container = getProjectObject(project, "container", ref.id);
      if (container) containers.push(structuredClone(container));
    } else {
      const node = getProjectObject(project, "node", ref.id);
      if (node) nodes.push(structuredClone(node));
    }
  }
  return { nodes, containers };
}

// Clone a payload with fresh ids, offset by a fixed delta so relative positions are preserved. Links
// between cloned objects (container membership, nested parents) are remapped to the new ids.
export function cloneMovablePayload(payload: MovablePayload, offset: { x: number; y: number }): MovablePayload & { refs: SelectionRef[] } {
  const containerIdMap = new Map<string, string>();
  const nodeIdMap = new Map<string, string>();

  const containers = payload.containers.map((container) => {
    const id = createId("container");
    containerIdMap.set(container.id, id);
    return { ...container, id, x: container.x + offset.x, y: container.y + offset.y };
  });

  const cloned = payload.nodes.map((node) => {
    const id = createId("node");
    nodeIdMap.set(node.id, id);
    return {
      ...node,
      id,
      x: node.x + offset.x,
      y: node.y + offset.y,
      containerId: node.containerId && containerIdMap.has(node.containerId) ? containerIdMap.get(node.containerId) : node.containerId,
      ports: node.ports.map((port) => ({ ...port, id: createId("port") })),
      composite: node.composite ? {
        ...node.composite,
        sections: node.composite.sections.map((section) => ({
          ...section,
          fields: section.fields.map((field) => ({ ...field, id: createId("field") })),
          endpoints: section.endpoints.map((endpoint) => ({ ...endpoint, id: createId("endpoint") })),
        })),
      } : undefined,
    };
  });

  // Remap nested-parent references to cloned parents where the parent was cloned too.
  const nodes = cloned.map((node) => node.nestedParentId && nodeIdMap.has(node.nestedParentId)
    ? { ...node, nestedParentId: nodeIdMap.get(node.nestedParentId) }
    : node);

  return {
    nodes,
    containers,
    refs: [...containers.map((c) => ({ type: "container" as const, id: c.id })), ...nodes.map((n) => ({ type: "node" as const, id: n.id }))],
  };
}

// Duplicate straight from the project (Ctrl+D): snapshot the selection and clone it in one step.
export function cloneMovables(project: Project, refs: SelectionRef[], offset: { x: number; y: number }) {
  return cloneMovablePayload(collectMovables(project, refs), offset);
}
