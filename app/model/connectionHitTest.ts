import { portsAreCompatible } from "./project";
import { getProjectObject } from "./projectObject";
import { portPosition } from "./routing";
import type { Point, Port, Project, SystemNode } from "./types";

export type ConnectionPortTarget = { node: SystemNode; port: Port; distance: number };

export function nearestEligibleConnectionPort(
  project: Project,
  point: Point,
  radius: number,
  source: { nodeId: string; portId: string } | null,
): ConnectionPortTarget | null {
  const sourcePort = source ? getProjectObject(project, "port", source.portId) : undefined;
  const targets: ConnectionPortTarget[] = [];

  for (const node of project.nodes) {
    for (const port of node.ports) {
      const visible = !node.nestedParentId || project.connections.some(
        (connection) => connection.sourcePortId === port.id || connection.targetPortId === port.id,
      );
      const eligible = sourcePort
        ? port.direction === "inbound" && portsAreCompatible(sourcePort, port)
        : port.direction === "outbound";
      if (!visible || !eligible) continue;

      const position = portPosition(project, node.id, port.id);
      const distance = Math.hypot(point.x - position.x, point.y - position.y);
      if (distance <= radius) targets.push({ node, port, distance });
    }
  }

  return targets.sort((a, b) => a.distance - b.distance || a.port.id.localeCompare(b.port.id))[0] ?? null;
}
