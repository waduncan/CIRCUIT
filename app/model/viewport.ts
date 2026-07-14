import type { Bounds, DiagramContainer, Point, SystemNode } from "./types";
import { GRID } from "./project";

export const EMPTY_BOUNDS: Bounds = { x: 0, y: 0, width: 0, height: 0 };

// Background-grid style that tracks the diagram's pan/zoom so grid lines align with the coordinate
// space (a snapped node at a multiple of GRID lands on a grid line). Returned as plain CSS props
// (camelCase) for use directly as an element `style`. The four background-size entries match the
// two major + two minor gradient layers declared in CSS.
export function gridBackgroundStyle(pan: Point, zoom: number): { backgroundPosition: string; backgroundSize: string } {
  const minor = GRID * zoom;
  const major = minor * 5;
  return {
    backgroundPosition: `${pan.x}px ${pan.y}px`,
    backgroundSize: `${major}px ${major}px, ${major}px ${major}px, ${minor}px ${minor}px, ${minor}px ${minor}px`,
  };
}

export function boundsFromNodes(nodes: SystemNode[]): Bounds {
  if (!nodes.length) return EMPTY_BOUNDS;
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function boundsFromContainers(containers: DiagramContainer[]): Bounds {
  if (!containers.length) return EMPTY_BOUNDS;
  const minX = Math.min(...containers.map((container) => container.x));
  const minY = Math.min(...containers.map((container) => container.y - 32));
  const maxX = Math.max(...containers.map((container) => container.x + container.width));
  const maxY = Math.max(...containers.map((container) => container.y + container.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function boundsFromPoints(points: Point[]): Bounds {
  if (!points.length) return EMPTY_BOUNDS;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export function expandBounds(bounds: Bounds, padding: number): Bounds {
  return { x: bounds.x - padding, y: bounds.y - padding, width: bounds.width + padding * 2, height: bounds.height + padding * 2 };
}

export function unionBounds(...items: Bounds[]): Bounds {
  const nonEmpty = items.filter((bounds) => bounds.width || bounds.height);
  if (!nonEmpty.length) return EMPTY_BOUNDS;
  const x = Math.min(...nonEmpty.map((bounds) => bounds.x));
  const y = Math.min(...nonEmpty.map((bounds) => bounds.y));
  const right = Math.max(...nonEmpty.map((bounds) => bounds.x + bounds.width));
  const bottom = Math.max(...nonEmpty.map((bounds) => bounds.y + bounds.height));
  return { x, y, width: right - x, height: bottom - y };
}

export function intersectsBounds(a: Bounds, b: Bounds): boolean {
  return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
}

export function nodeBounds(node: SystemNode): Bounds {
  return { x: node.x, y: node.y, width: node.width, height: node.height };
}
