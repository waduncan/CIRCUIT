import type { SystemNode } from "./types";

export function nestedParentForNode(node: SystemNode, nodes: SystemNode[]): string | undefined {
  if (node.kind === "nestable") return undefined;
  return nodes.filter((candidate) => candidate.kind === "nestable" && candidate.id !== node.id && node.x >= candidate.x + 12 && node.y >= candidate.y + 44 && node.x + node.width <= candidate.x + candidate.width - 12 && node.y + node.height <= candidate.y + candidate.height - 12)
    .sort((a, b) => a.width * a.height - b.width * b.height).at(0)?.id;
}

export function reconcileNestedNodes(nodes: SystemNode[]): SystemNode[] {
  return nodes.map((node) => {
    const nestedParentId = nestedParentForNode(node, nodes);
    return node.nestedParentId === nestedParentId ? node : { ...node, nestedParentId };
  });
}
