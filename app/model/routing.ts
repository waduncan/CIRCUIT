import type { Connection, Point, Project } from "./types";
import { snap } from "./project";

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
  const segments = points.slice(1).map((point, index) => ({
    start: points[index],
    end: point,
    length: Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y),
  }));
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  let remaining = totalLength / 2;
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

export function portPosition(project: Pick<Project, "nodes">, nodeId: string, portId: string): Point {
  const node = project.nodes.find((item) => item.id === nodeId);
  if (!node) return { x: 0, y: 0 };
  const port = node.ports.find((item) => item.id === portId);
  if (!port) return { x: node.x, y: node.y };
  const sameDirection = node.ports.filter((item) => item.direction === port.direction);
  const index = sameDirection.findIndex((item) => item.id === portId);
  return { x: port.direction === "inbound" ? node.x : node.x + node.width, y: node.y + 82 + index * 34 };
}

export function connectionRoute(project: Pick<Project, "nodes">, connection: Connection): Point[] {
  const source = portPosition(project, connection.sourceNodeId, connection.sourcePortId);
  const target = portPosition(project, connection.targetNodeId, connection.targetPortId);
  return orthogonalRoutePoints(source, target, connection.bendPoints);
}
