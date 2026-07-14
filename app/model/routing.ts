import type { Connection, Point, Project } from "./types";
import { snap } from "./project";
import { getProjectObject } from "./projectObject";

export function compactPoints(points: Point[]): Point[] {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    return !previous || previous.x !== point.x || previous.y !== point.y;
  });
}

export function orthogonalRoutePoints(source: Point, target: Point, bendPoints: Point[] = []): Point[] {
  if (!bendPoints.length) {
    const midpointX = snap((source.x + target.x) / 2);
    return compactPoints([source, { x: midpointX, y: source.y }, { x: midpointX, y: target.y }, target]);
  }
  const route = [source];
  let current = source;
  for (const bend of bendPoints) {
    route.push({ x: bend.x, y: current.y }, bend);
    current = bend;
  }
  route.push({ x: target.x, y: current.y }, target);
  return compactPoints(route);
}

export function svgPath(points: Point[]): string {
  return points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
}

export function routeMidpoint(points: Point[]): Point {
  return pointAlongRoute(points, 0.5);
}

export function pointAlongRoute(points: Point[], position: number, segmentIndex?: number): Point {
  if (segmentIndex !== undefined) {
    const index = Math.max(0, Math.min(points.length - 2, segmentIndex));
    const start = points[index] ?? points[0] ?? { x: 0, y: 0 };
    const end = points[index + 1] ?? start;
    const ratio = Math.max(0, Math.min(1, position));
    return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
  }
  const segments = points.slice(1).map((point, index) => ({
    start: points[index],
    end: point,
    length: Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y),
  }));
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  let remaining = totalLength * Math.max(0, Math.min(1, position));
  for (const segment of segments) {
    if (remaining <= segment.length) {
      const ratio = segment.length ? remaining / segment.length : 0;
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
        y: segment.start.y + (segment.end.y - segment.start.y) * ratio,
      };
    }
    remaining -= segment.length;
  }
  return points.at(-1) ?? { x: 0, y: 0 };
}

export function portTilePosition(project: Pick<Project, "nodes">, nodeId: string, portId: string): Point {
  const node = getProjectObject(project, "node", nodeId);
  if (!node) return { x: 0, y: 0 };
  const port = getProjectObject(project, "port", portId);
  if (!port) return { x: node.x, y: node.y };
  const side = port.side ?? (port.direction === "inbound" ? "left" : "right");
  const sameSide = node.ports.filter((item) => (item.side ?? (item.direction === "inbound" ? "left" : "right")) === side);
  const index = sameSide.findIndex((item) => item.id === portId);
  const ratio = Math.max(0, Math.min(1, port.offset ?? (index + 1) / (sameSide.length + 1)));
  if (side === "top") return { x: node.x + node.width * ratio, y: node.y };
  if (side === "bottom") return { x: node.x + node.width * ratio, y: node.y + node.height };
  return { x: side === "left" ? node.x : node.x + node.width, y: node.y + node.height * ratio };
}

export function portPosition(project: Pick<Project, "nodes">, nodeId: string, portId: string): Point {
  const center = portTilePosition(project, nodeId, portId);
  const node = getProjectObject(project, "node", nodeId);
  const port = getProjectObject(project, "port", portId);
  if (!node || !port) return center;
  const side = port.side ?? (port.direction === "inbound" ? "left" : "right");
  if (side === "left") return { x: center.x - (port.width ?? 92) / 2, y: center.y };
  if (side === "right") return { x: center.x + (port.width ?? 92) / 2, y: center.y };
  if (side === "top") return { x: center.x, y: center.y - (port.height ?? 34) / 2 };
  return { x: center.x, y: center.y + (port.height ?? 34) / 2 };
}

export function connectionRoute(project: Pick<Project, "nodes">, connection: Connection): Point[] {
  const source = portPosition(project, connection.sourceNodeId, connection.sourcePortId);
  const target = portPosition(project, connection.targetNodeId, connection.targetPortId);
  return orthogonalRoutePoints(source, target, connection.bendPoints);
}
