import { containerForNode, reconcileNodeContainers } from "./containers";
import { reconcileNestedNodes } from "./nesting";
import { getProjectObject } from "./projectObject";
import type { CanvasSettings, Connection, DataFlowProcess, DiagramContainer, LibraryItem, Point, Project, Selection, SelectionRef, SystemNode } from "./types";

export type ProjectCommand =
  | { type: "node.add"; node: SystemNode }
  | { type: "node.update"; id: string; patch: Partial<SystemNode> }
  | { type: "container.add"; container: DiagramContainer }
  | { type: "container.update"; id: string; patch: Partial<DiagramContainer> }
  | { type: "connection.add"; connection: Connection }
  | { type: "connection.update"; id: string; patch: Partial<Connection> }
  | { type: "connection.bus.update"; busId: string; trunkPoints: Point[] }
  | { type: "process.add"; process: DataFlowProcess }
  | { type: "process.update"; id: string; patch: Partial<DataFlowProcess> }
  | { type: "library.add"; item: LibraryItem }
  | { type: "library.remove"; id: string }
  | { type: "library.replace"; items: LibraryItem[] }
  | { type: "canvas.update"; patch: Partial<CanvasSettings> }
  | { type: "presentation.update"; presentation: Project["presentation"] }
  | { type: "selection.delete"; selection: Exclude<Selection, null> }
  // Multi-object operations (#10) — each applied as one command so it is a single undo step.
  | { type: "objects.arrange"; moves: Array<{ type: "node" | "container"; id: string; x: number; y: number; width?: number; height?: number }> }
  | { type: "objects.delete"; refs: SelectionRef[] }
  | { type: "objects.add"; nodes: SystemNode[]; containers: DiagramContainer[] };

export function applyProjectCommand(project: Project, command: ProjectCommand): Project {
  switch (command.type) {
    case "node.add":
      return { ...project, nodes: reconcileNestedNodes([...project.nodes, { ...command.node, containerId: containerForNode(command.node, project.containers) }]) };
    case "node.update": {
      const updated = project.nodes.map((node) => {
        if (node.id !== command.id) return node;
        const nextNode = { ...node, ...command.patch };
        const geometryChanged = "x" in command.patch || "y" in command.patch || "width" in command.patch || "height" in command.patch;
        return geometryChanged ? { ...nextNode, containerId: containerForNode(nextNode, project.containers) } : nextNode;
      });
      const movedParent = getProjectObject(project, "node", command.id);
      const dx = movedParent?.kind === "nestable" && typeof command.patch.x === "number" ? command.patch.x - movedParent.x : 0;
      const dy = movedParent?.kind === "nestable" && typeof command.patch.y === "number" ? command.patch.y - movedParent.y : 0;
      const movedNodes = updated.map((node) => node.nestedParentId === command.id && (dx || dy) ? { ...node, x: node.x + dx, y: node.y + dy } : node);
      return { ...project, nodes: reconcileNestedNodes(movedNodes) };
    }
    case "container.add": {
      const containers = [...project.containers, command.container];
      return { ...project, containers, nodes: reconcileNodeContainers(project.nodes, containers) };
    }
    case "container.update": {
      const containers = project.containers.map((container) => container.id === command.id ? { ...container, ...command.patch } : container);
      const geometryChanged = "x" in command.patch || "y" in command.patch || "width" in command.patch || "height" in command.patch;
      return { ...project, containers, nodes: geometryChanged ? reconcileNodeContainers(project.nodes, containers) : project.nodes };
    }
    case "connection.add":
      return { ...project, connections: [...project.connections, command.connection] };
    case "connection.update":
      return { ...project, connections: project.connections.map((connection) => connection.id === command.id ? { ...connection, ...command.patch } : connection) };
    case "connection.bus.update":
      return { ...project, connections: project.connections.map((connection) => connection.routing?.busId === command.busId ? { ...connection, routing: { ...connection.routing, trunkPoints: command.trunkPoints } } : connection) };
    case "process.add":
      return { ...project, processes: [...project.processes, command.process] };
    case "process.update":
      return { ...project, processes: project.processes.map((process) => process.id === command.id ? { ...process, ...command.patch } : process) };
    case "library.add":
      return { ...project, customLibrary: [...project.customLibrary, command.item] };
    case "library.remove":
      return { ...project, customLibrary: project.customLibrary.filter((item) => item.id !== command.id) };
    case "library.replace":
      return { ...project, customLibrary: command.items };
    case "canvas.update":
      return { ...project, canvas: { ...project.canvas, ...command.patch } };
    case "presentation.update":
      return { ...project, presentation: command.presentation };
    case "selection.delete":
      if (command.selection.type === "container") {
        return { ...project, containers: project.containers.filter((container) => container.id !== command.selection.id), nodes: project.nodes.map((node) => node.containerId === command.selection.id ? { ...node, containerId: undefined } : node) };
      }
      if (command.selection.type === "node") {
        return {
          ...project,
          nodes: project.nodes.filter((node) => node.id !== command.selection.id),
          connections: project.connections.filter((edge) => edge.sourceNodeId !== command.selection.id && edge.targetNodeId !== command.selection.id),
          processes: project.processes.map((process) => ({ ...process, checkpoints: process.checkpoints.filter((nodeId) => nodeId !== command.selection.id) })),
        };
      }
      if (command.selection.type === "connection") return { ...project, connections: project.connections.filter((edge) => edge.id !== command.selection.id) };
      return { ...project, processes: project.processes.filter((process) => process.id !== command.selection.id) };
    case "objects.arrange": {
      const key = (type: string, id: string) => `${type}:${id}`;
      const targets = new Map(command.moves.map((move) => [key(move.type, move.id), move]));
      // Move each listed node to its target, recording the delta of nestable parents so their
      // contained children follow (unless a child was itself explicitly moved).
      const parentDelta = new Map<string, Point>();
      const moved = project.nodes.map((node) => {
        const target = targets.get(key("node", node.id));
        if (!target) return node;
        if (node.kind === "nestable") parentDelta.set(node.id, { x: target.x - node.x, y: target.y - node.y });
        return { ...node, x: target.x, y: target.y, width: target.width ?? node.width, height: target.height ?? node.height };
      });
      const withChildren = moved.map((node) => {
        if (node.nestedParentId && !targets.has(key("node", node.id))) {
          const delta = parentDelta.get(node.nestedParentId);
          if (delta) return { ...node, x: node.x + delta.x, y: node.y + delta.y };
        }
        return node;
      });
      const containers = project.containers.map((container) => {
        const target = targets.get(key("container", container.id));
        return target ? { ...container, x: target.x, y: target.y, width: target.width ?? container.width, height: target.height ?? container.height } : container;
      });
      return { ...project, containers, nodes: reconcileNodeContainers(reconcileNestedNodes(withChildren), containers) };
    }
    case "objects.delete": {
      const nodeIds = new Set(command.refs.filter((ref) => ref.type === "node").map((ref) => ref.id));
      const containerIds = new Set(command.refs.filter((ref) => ref.type === "container").map((ref) => ref.id));
      return {
        ...project,
        containers: project.containers.filter((container) => !containerIds.has(container.id)),
        nodes: project.nodes.filter((node) => !nodeIds.has(node.id)).map((node) => node.containerId && containerIds.has(node.containerId) ? { ...node, containerId: undefined } : node),
        connections: project.connections.filter((edge) => !nodeIds.has(edge.sourceNodeId) && !nodeIds.has(edge.targetNodeId)),
        processes: project.processes.map((process) => ({ ...process, checkpoints: process.checkpoints.filter((nodeId) => !nodeIds.has(nodeId)) })),
      };
    }
    case "objects.add": {
      const containers = [...project.containers, ...command.containers];
      return { ...project, containers, nodes: reconcileNodeContainers(reconcileNestedNodes([...project.nodes, ...command.nodes]), containers) };
    }
  }
}
