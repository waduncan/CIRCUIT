import { createId } from "./project";
import { getProjectObject } from "./projectObject";
import type { DiagramContainer, Project, SelectionRef, SystemNode } from "./types";

// Deep-clone selected movable objects with fresh ids, offset by a fixed delta so relative positions
// are preserved (#10 duplicate; reused by clipboard paste later). Pure — returns new objects and the
// refs that should become selected, for the `objects.add` command.
export function cloneMovables(project: Project, refs: SelectionRef[], offset: { x: number; y: number }): {
  nodes: SystemNode[];
  containers: DiagramContainer[];
  refs: SelectionRef[];
} {
  const containerIdMap = new Map<string, string>();
  const nodeIdMap = new Map<string, string>();
  const containers: DiagramContainer[] = [];
  const nodes: SystemNode[] = [];

  for (const ref of refs.filter((r) => r.type === "container")) {
    const container = getProjectObject(project, "container", ref.id);
    if (!container) continue;
    const id = createId("container");
    containerIdMap.set(container.id, id);
    containers.push({ ...container, id, name: `${container.name} copy`, x: container.x + offset.x, y: container.y + offset.y });
  }

  for (const ref of refs.filter((r) => r.type === "node")) {
    const node = getProjectObject(project, "node", ref.id);
    if (!node) continue;
    const id = createId("node");
    nodeIdMap.set(node.id, id);
    nodes.push({
      ...node,
      id,
      name: `${node.name} copy`,
      x: node.x + offset.x,
      y: node.y + offset.y,
      // Remap container/nested parent only when that object was cloned too; otherwise keep the link.
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
    });
  }

  // Second pass: remap nested parent references to cloned parents where applicable.
  const remapped = nodes.map((node) => node.nestedParentId && nodeIdMap.has(node.nestedParentId)
    ? { ...node, nestedParentId: nodeIdMap.get(node.nestedParentId) }
    : node);

  return {
    nodes: remapped,
    containers,
    refs: [...containers.map((c) => ({ type: "container" as const, id: c.id })), ...nodes.map((n) => ({ type: "node" as const, id: n.id }))],
  };
}
