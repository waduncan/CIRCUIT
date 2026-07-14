export type Capability = "HL7" | "FHIR" | "DICOM" | "TCP" | "General Data";
export type Direction = "inbound" | "outbound";
export type PortSide = "left" | "right" | "top" | "bottom";
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
  side?: PortSide;
};

export type CompositeField = {
  id: string;
  label: string;
  value: string;
};

export type CompositeEndpoint = {
  id: string;
  name: string;
  address: string;
  details: string;
};

export type CompositeSection = {
  id: string;
  title: string;
  kind: "fields" | "endpoints";
  fields: CompositeField[];
  endpoints: CompositeEndpoint[];
};

export type CompositeNodeContent = {
  templateId: string;
  headerLabel: string;
  footer: string;
  logoText: string;
  sections: CompositeSection[];
};

export type CompositeNodeTemplate = {
  id: string;
  name: string;
  category: "gateway" | "server" | "modality-collection" | "database" | "storage" | "browser-client" | "external-system";
  kind: PrimitiveKind;
  icon: string;
  color: string;
  defaultWidth: number;
  defaultHeight: number;
  capabilities: Capability[];
  content: Omit<CompositeNodeContent, "templateId">;
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
  containerId?: string;
  composite?: CompositeNodeContent;
};

export type DiagramContainer = {
  id: string;
  name: string;
  description: string;
  kind: "logical" | "physical";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
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
  style?: ConnectionStyle;
  labels?: ConnectionLabel[];
};

export type ConnectionLineStyle = "solid" | "dashed" | "dotted";
export type ConnectionArrowStyle = "none" | "end" | "start" | "both";

export type ConnectionStyle = {
  lineStyle: ConnectionLineStyle;
  color?: string;
  width: number;
  opacity: number;
  arrowStyle: ConnectionArrowStyle;
};

export type ConnectionLabel = {
  id: string;
  text: string;
  anchor: "route" | "segment";
  position: number;
  segmentIndex?: number;
  offsetX: number;
  offsetY: number;
  background: boolean;
  rotation: number;
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
  templateId?: string;
};

export type CanvasSettings = {
  mode: "bounded" | "infinite";
  width: number;
  height: number;
};

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Project = {
  version: 1;
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  canvas: CanvasSettings;
  containers: DiagramContainer[];
  nodes: SystemNode[];
  connections: Connection[];
  processes: DataFlowProcess[];
  customLibrary: LibraryItem[];
  nodeTemplates: CompositeNodeTemplate[];
};

export type Selection =
  | { type: "container"; id: string }
  | { type: "node"; id: string }
  | { type: "connection"; id: string }
  | { type: "process"; id: string }
  | null;

export type PortDraft = {
  direction: Direction;
  capability: Capability;
  subtype: string;
  name: string;
  side: PortSide;
};
