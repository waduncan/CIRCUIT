import type { CompositeNodeTemplate, Connection, DataFlowProcess, DiagramContainer, Port, Project, SystemNode } from "./types";

export type ProjectObjectType = "container" | "node" | "port" | "connection" | "process" | "nodeTemplate";

type ProjectObjectByType = {
  container: DiagramContainer;
  node: SystemNode;
  port: Port;
  connection: Connection;
  process: DataFlowProcess;
  nodeTemplate: CompositeNodeTemplate;
};

export function getProjectObject<T extends ProjectObjectType>(project: Project, type: T, id: string | null | undefined): ProjectObjectByType[T] | undefined;
export function getProjectObject(project: Pick<Project, "nodes">, type: "node", id: string | null | undefined): SystemNode | undefined;
export function getProjectObject(project: Pick<Project, "nodes">, type: "port", id: string | null | undefined): Port | undefined;
/** Returns the current project-owned object for an id, or undefined when it no longer exists. */
export function getProjectObject(project: Project | Pick<Project, "nodes">, type: ProjectObjectType, id: string | null | undefined): ProjectObjectByType[ProjectObjectType] | undefined {
  if (!id) return undefined;
  const fullProject = project as Project;
  switch (type) {
    case "container": return fullProject.containers.find((item) => item.id === id);
    case "node": return project.nodes.find((item) => item.id === id);
    case "port": return project.nodes.flatMap((node) => node.ports).find((item) => item.id === id);
    case "connection": return fullProject.connections.find((item) => item.id === id);
    case "process": return fullProject.processes.find((item) => item.id === id);
    case "nodeTemplate": return fullProject.nodeTemplates.find((item) => item.id === id);
  }
}
