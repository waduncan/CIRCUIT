import type { Port, Project, SystemNode } from "./types";

export const GRID = 16;
export const STORAGE_KEY = "careflow-studio-project-v1";

export const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
export const snap = (value: number) => Math.round(value / GRID) * GRID;

export function createDemoProject(): Project {
  const nodes: SystemNode[] = [
    {
      id: "emr-1", name: "Epic EMR", kind: "emr", description: "Enterprise electronic medical record", x: 144, y: 208, width: 224, height: 176, color: "#2859d9", capabilities: ["HL7", "FHIR"],
      ports: [{ id: "emr-orm-out", name: "Orders", direction: "outbound", capability: "HL7", subtype: "ORM" }],
    },
    {
      id: "ie-1", name: "Rhapsody Engine", kind: "interface", description: "Clinical interface and routing engine", x: 496, y: 208, width: 232, height: 208, color: "#7c4dff", capabilities: ["HL7", "TCP"],
      ports: [
        { id: "ie-orm-in", name: "Orders In", direction: "inbound", capability: "HL7", subtype: "ORM" },
        { id: "ie-orm-out", name: "Orders Out", direction: "outbound", capability: "HL7", subtype: "ORM" },
      ],
    },
    {
      id: "app-1", name: "PACS Application", kind: "application", description: "Imaging workflow and archive services", x: 864, y: 208, width: 240, height: 240, color: "#00a78e", capabilities: ["HL7", "DICOM", "TCP"],
      ports: [
        { id: "app-orm-in", name: "Orders", direction: "inbound", capability: "HL7", subtype: "ORM" },
        { id: "app-mwl-out", name: "Worklist", direction: "outbound", capability: "DICOM", subtype: "MWL" },
        { id: "app-store-in", name: "Image Store", direction: "inbound", capability: "DICOM", subtype: "C-STORE SCP" },
      ],
    },
    {
      id: "cart-1", name: "Echo Cart 04", kind: "device", description: "Cardiology ultrasound modality", x: 1248, y: 208, width: 224, height: 208, color: "#d14d72", capabilities: ["DICOM", "General Data"],
      ports: [
        { id: "cart-mwl-in", name: "Worklist", direction: "inbound", capability: "DICOM", subtype: "MWL" },
        { id: "cart-store-out", name: "Images", direction: "outbound", capability: "DICOM", subtype: "C-STORE SCU" },
      ],
    },
    {
      id: "db-1", name: "PACS Database", kind: "database", description: "PACS configuration and metadata", x: 864, y: 592, width: 240, height: 176, color: "#e67e22", capabilities: ["TCP", "General Data"],
      ports: [{ id: "db-tcp-in", name: "Database", direction: "inbound", capability: "TCP", subtype: "Server" }],
    },
  ];

  return {
    version: 1,
    id: "pacs-logical",
    name: "Cardiology PACS Connectivity",
    description: "Logical integration map for cardiology ordering, modality worklist, and image acquisition.",
    updatedAt: new Date().toISOString(),
    nodes,
    connections: [
      { id: "c1", sourceNodeId: "emr-1", sourcePortId: "emr-orm-out", targetNodeId: "ie-1", targetPortId: "ie-orm-in", capability: "HL7", subtype: "ORM", dataType: "Cardiology order", description: "Outbound signed order" },
      { id: "c2", sourceNodeId: "ie-1", sourcePortId: "ie-orm-out", targetNodeId: "app-1", targetPortId: "app-orm-in", capability: "HL7", subtype: "ORM", dataType: "Normalized order", description: "Transformed PACS order" },
      { id: "c3", sourceNodeId: "app-1", sourcePortId: "app-mwl-out", targetNodeId: "cart-1", targetPortId: "cart-mwl-in", capability: "DICOM", subtype: "MWL", dataType: "Scheduled procedure", description: "Modality worklist query" },
      { id: "c4", sourceNodeId: "cart-1", sourcePortId: "cart-store-out", targetNodeId: "app-1", targetPortId: "app-store-in", capability: "DICOM", subtype: "C-STORE", dataType: "Echo images", description: "Completed study images" },
    ],
    processes: [
      { id: "proc-order", name: "Order placement", description: "A signed cardiology order is routed from the EMR to the echo cart worklist.", checkpoints: ["emr-1", "cart-1"], color: "#2f6df6" },
      { id: "proc-complete", name: "Echo complete", description: "The technologist exports completed DICOM images from the cart to PACS.", checkpoints: ["cart-1", "app-1"], color: "#00a78e" },
    ],
    customLibrary: [],
  };
}

export function blankProject(name: string, description: string): Project {
  return { version: 1, id: createId("project"), name, description, updatedAt: new Date().toISOString(), nodes: [], connections: [], processes: [], customLibrary: [] };
}

export function calculateProcessRoute(project: Project, checkpoints: string[]): string[] {
  if (checkpoints.length < 2) return [];
  const fullRoute: string[] = [];
  for (let leg = 0; leg < checkpoints.length - 1; leg++) {
    const start = checkpoints[leg];
    const finish = checkpoints[leg + 1];
    const queue: Array<{ nodeId: string; edges: string[] }> = [{ nodeId: start, edges: [] }];
    const visited = new Set([start]);
    let found: string[] | null = null;
    while (queue.length) {
      const current = queue.shift()!;
      if (current.nodeId === finish) { found = current.edges; break; }
      for (const edge of project.connections.filter((connection) => connection.sourceNodeId === current.nodeId)) {
        if (!visited.has(edge.targetNodeId)) {
          visited.add(edge.targetNodeId);
          queue.push({ nodeId: edge.targetNodeId, edges: [...current.edges, edge.id] });
        }
      }
    }
    if (!found) return [];
    fullRoute.push(...found);
  }
  return fullRoute;
}

export function portsAreCompatible(source: Port, target: Port): boolean {
  if (source.capability !== target.capability) return false;
  if (source.subtype === target.subtype) return true;
  const pair = `${source.subtype}|${target.subtype}`;
  return pair === "C-STORE SCU|C-STORE SCP" || pair === "Client|Server";
}

export function connectionSubtype(source: Port, target: Port): string {
  if (source.capability === "DICOM" && source.subtype === "C-STORE SCU" && target.subtype === "C-STORE SCP") return "C-STORE";
  if (source.capability === "TCP" && source.subtype === "Client" && target.subtype === "Server") return "Client → Server";
  return source.subtype;
}

export function migrateProjectDocument(value: unknown): Project | null {
  if (!value || typeof value !== "object") return null;
  const project = value as Partial<Project>;
  if (project.version !== 1 || !Array.isArray(project.nodes) || !Array.isArray(project.connections) || !Array.isArray(project.processes)) return null;
  return {
    ...project,
    version: 1,
    id: project.id ?? createId("project"),
    name: project.name ?? "Untitled project",
    description: project.description ?? "",
    updatedAt: project.updatedAt ?? new Date().toISOString(),
    nodes: project.nodes,
    connections: project.connections,
    processes: project.processes,
    customLibrary: Array.isArray(project.customLibrary) ? project.customLibrary : [],
  };
}

export function isProject(value: unknown): value is Project {
  return migrateProjectDocument(value) !== null;
}
