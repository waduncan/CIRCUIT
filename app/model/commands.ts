import type { CanvasSettings, Connection, DataFlowProcess, LibraryItem, Project, Selection, SystemNode } from "./types";

export type ProjectCommand =
  | { type: "node.add"; node: SystemNode }
  | { type: "node.update"; id: string; patch: Partial<SystemNode> }
  | { type: "connection.add"; connection: Connection }
  | { type: "connection.update"; id: string; patch: Partial<Connection> }
  | { type: "process.add"; process: DataFlowProcess }
  | { type: "process.update"; id: string; patch: Partial<DataFlowProcess> }
  | { type: "library.add"; item: LibraryItem }
  | { type: "library.remove"; id: string }
  | { type: "library.replace"; items: LibraryItem[] }
  | { type: "canvas.update"; patch: Partial<CanvasSettings> }
  | { type: "selection.delete"; selection: Exclude<Selection, null> };

export function applyProjectCommand(project: Project, command: ProjectCommand): Project {
  switch (command.type) {
    case "node.add":
      return { ...project, nodes: [...project.nodes, command.node] };
    case "node.update":
      return { ...project, nodes: project.nodes.map((node) => node.id === command.id ? { ...node, ...command.patch } : node) };
    case "connection.add":
      return { ...project, connections: [...project.connections, command.connection] };
    case "connection.update":
      return { ...project, connections: project.connections.map((connection) => connection.id === command.id ? { ...connection, ...command.patch } : connection) };
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
    case "selection.delete":
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
  }
}
