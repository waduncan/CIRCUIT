import { portsAreCompatible } from "./project";
import { getProjectObject } from "./projectObject";
import { portPosition } from "./routing";
import type { Point, Port, Project, SystemNode } from "./types";

export type ConnectionPortTarget = { node: SystemNode; port: Port; distance: number };

export function nearestConnectionPort(
  project: Project,
  point: Point,
  radius: number,
  source: { nodeId: string; portId: string } | null,
): ConnectionPortTarget | null {
  const targets: ConnectionPortTarget[] = [];

  for (const node of project.nodes) {
    for (const port of node.ports) {
      const visible = !node.nestedParentId || project.connections.some(
        (connection) => connection.sourcePortId === port.id || connection.targetPortId === port.id,
      );
      const eligible = source ? port.direction === "inbound" : port.direction === "outbound";
      if (!visible || !eligible) continue;

      const position = portPosition(project, node.id, port.id);
      const distance = Math.hypot(point.x - position.x, point.y - position.y);
      if (distance <= radius) targets.push({ node, port, distance });
    }
  }

  return targets.sort((a, b) => a.distance - b.distance || a.port.id.localeCompare(b.port.id))[0] ?? null;
}

export function nearestEligibleConnectionPort(
  project: Project,
  point: Point,
  radius: number,
  source: { nodeId: string; portId: string } | null,
): ConnectionPortTarget | null {
  const target = nearestConnectionPort(project, point, radius, source);
  const sourcePort = source ? getProjectObject(project, "port", source.portId) : undefined;
  if (!target) return null;
  const eligible = !sourcePort || (target.port.direction === "inbound" && portsAreCompatible(sourcePort, target.port));
  return eligible ? target : null;
}
