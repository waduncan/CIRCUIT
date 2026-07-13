import type { Bounds, DiagramContainer, SystemNode } from "./types";

export function containerBounds(container: DiagramContainer): Bounds {
  return { x: container.x, y: container.y, width: container.width, height: container.height };
}

export function containerForNode(node: SystemNode, containers: DiagramContainer[]): string | undefined {
  return containers
    .filter((container) => node.x >= container.x && node.y >= container.y && node.x + node.width <= container.x + container.width && node.y + node.height <= container.y + container.height)
    .sort((a, b) => a.width * a.height - b.width * b.height)
    .at(0)?.id;
}

export function reconcileNodeContainers(nodes: SystemNode[], containers: DiagramContainer[]): SystemNode[] {
  return nodes.map((node) => {
    const containerId = containerForNode(node, containers);
    return node.containerId === containerId ? node : { ...node, containerId };
  });
}
