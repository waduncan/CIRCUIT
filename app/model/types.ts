export type Capability = "HL7" | "FHIR" | "DICOM" | "TCP" | "General Data";
export type Direction = "inbound" | "outbound";
export type PrimitiveKind = "emr" | "interface" | "application" | "database" | "device" | "cloud";

export type Point = {
  x: number;
  y: number;
};

export type Port = {
  id: string;
  name: string;
  direction: Direction;
  capability: Capability;
  subtype: string;
};

export type SystemNode = {
  id: string;
  name: string;
  kind: PrimitiveKind;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  capabilities: Capability[];
  ports: Port[];
};

export type Connection = {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  capability: Capability;
  subtype: string;
  dataType: string;
  description: string;
  bendPoints?: Point[];
};

export type DataFlowProcess = {
  id: string;
  name: string;
  description: string;
  checkpoints: string[];
  color: string;
};

export type LibraryItem = {
  id: string;
  name: string;
  kind: PrimitiveKind;
  description: string;
  color: string;
  capabilities: Capability[];
};

export type Project = {
  version: 1;
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  nodes: SystemNode[];
  connections: Connection[];
  processes: DataFlowProcess[];
  customLibrary: LibraryItem[];
};

export type Selection =
  | { type: "node"; id: string }
  | { type: "connection"; id: string }
  | { type: "process"; id: string }
  | null;

export type PortDraft = {
  direction: Direction;
  capability: Capability;
  subtype: string;
  name: string;
};
