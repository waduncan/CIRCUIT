import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from "react";

type Capability = "HL7" | "FHIR" | "DICOM" | "TCP" | "General Data";
type Direction = "inbound" | "outbound";
type PrimitiveKind = "emr" | "interface" | "application" | "database" | "device" | "cloud";

type Point = {
  x: number;
  y: number;
};

type Port = {
  id: string;
  name: string;
  direction: Direction;
  capability: Capability;
  subtype: string;
};

type SystemNode = {
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

type Connection = {
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

type Process = {
  id: string;
  name: string;
  description: string;
  checkpoints: string[];
  color: string;
};

type LibraryItem = {
  id: string;
  name: string;
  kind: PrimitiveKind;
  description: string;
  color: string;
  capabilities: Capability[];
};

type Project = {
  version: 1;
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  nodes: SystemNode[];
  connections: Connection[];
  processes: Process[];
  customLibrary: LibraryItem[];
};

type Selection =
  | { type: "node"; id: string }
  | { type: "connection"; id: string }
  | { type: "process"; id: string }
  | null;

const GRID = 16;
const STORAGE_KEY = "careflow-studio-project-v1";

const capabilityConfig: Record<Capability, { color: string; subtypes: string[] }> = {
  HL7: { color: "#2f6df6", subtypes: ["ADT", "SIU", "ORM", "ORU"] },
  FHIR: { color: "#7c4dff", subtypes: ["REST", "Subscription", "Bundle", "Messaging"] },
  DICOM: { color: "#00a78e", subtypes: ["MWL", "C-STORE SCU", "C-STORE SCP", "MPPS"] },
  TCP: { color: "#e67e22", subtypes: ["Client", "Server", "MLLP"] },
  "General Data": { color: "#64748b", subtypes: ["File", "API", "Message", "Manual"] },
};

const primitiveLibrary: LibraryItem[] = [
  { id: "emr", name: "Electronic Medical Record", kind: "emr", description: "Clinical system of record", color: "#2859d9", capabilities: ["HL7", "FHIR"] },
  { id: "interface", name: "Interface Engine", kind: "interface", description: "Routes and transforms messages", color: "#7c4dff", capabilities: ["HL7", "FHIR", "TCP"] },
  { id: "application", name: "Application Server", kind: "application", description: "Hosts healthcare application services", color: "#00a78e", capabilities: ["HL7", "FHIR", "DICOM", "TCP"] },
  { id: "database", name: "Database Server", kind: "database", description: "Stores application and clinical data", color: "#e67e22", capabilities: ["TCP", "General Data"] },
  { id: "device", name: "Clinical Device", kind: "device", description: "Modality, cart, or bedside device", color: "#d14d72", capabilities: ["DICOM", "HL7", "General Data"] },
  { id: "cloud", name: "External Service", kind: "cloud", description: "Cloud or third-party endpoint", color: "#5a7184", capabilities: ["FHIR", "TCP", "General Data"] },
];

const icons: Record<PrimitiveKind, string> = {
  emr: "✚",
  interface: "⇄",
  application: "▣",
  database: "◉",
  device: "⌁",
  cloud: "☁",
};

const id = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
const snap = (value: number) => Math.round(value / GRID) * GRID;

function createDemoProject(): Project {
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

function blankProject(name: string, description: string): Project {
  return { version: 1, id: id("project"), name, description, updatedAt: new Date().toISOString(), nodes: [], connections: [], processes: [], customLibrary: [] };
}

function calculateRoute(project: Project, checkpoints: string[]): string[] {
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

function portsAreCompatible(source: Port, target: Port) {
  if (source.capability !== target.capability) return false;
  if (source.subtype === target.subtype) return true;
  const pair = `${source.subtype}|${target.subtype}`;
  return pair === "C-STORE SCU|C-STORE SCP" || pair === "Client|Server";
}

function connectionSubtype(source: Port, target: Port) {
  if (source.capability === "DICOM" && source.subtype === "C-STORE SCU" && target.subtype === "C-STORE SCP") return "C-STORE";
  if (source.capability === "TCP" && source.subtype === "Client" && target.subtype === "Server") return "Client → Server";
  return source.subtype;
}

function compactPoints(points: Point[]): Point[] {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    return !previous || previous.x !== point.x || previous.y !== point.y;
  });
}

function orthogonalRoutePoints(source: Point, target: Point, bendPoints: Point[] = []): Point[] {
  if (!bendPoints.length) {
    const midpointX = snap((source.x + target.x) / 2);
    return compactPoints([
      source,
      { x: midpointX, y: source.y },
      { x: midpointX, y: target.y },
      target,
    ]);
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

function svgPath(points: Point[]): string {
  return points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
}

function routeMidpoint(points: Point[]): Point {
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

function downloadJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function DiagramApp() {
  const [project, setProject] = useState<Project>(() => createDemoProject());
  const [hydrated, setHydrated] = useState(false);
  const [selection, setSelection] = useState<Selection>({ type: "node", id: "app-1" });
  const [zoom, setZoom] = useState(0.82);
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [connecting, setConnecting] = useState<{ nodeId: string; portId: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [modifierKeys, setModifierKeys] = useState({ ctrl: false, shift: false });
  const [activeProcessId, setActiveProcessId] = useState<string | null>("proc-order");
  const [isAnimating, setIsAnimating] = useState(true);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [processOpen, setProcessOpen] = useState(true);
  const [newProjectName, setNewProjectName] = useState("New healthcare integration");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateKind, setNewTemplateKind] = useState<PrimitiveKind>("application");
  const [portDraft, setPortDraft] = useState<{ direction: Direction; capability: Capability; subtype: string; name: string }>({ direction: "inbound", capability: "HL7", subtype: "ADT", name: "" });
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setProject(JSON.parse(saved) as Project); } catch { /* retain demo */ }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...project, updatedAt: new Date().toISOString() }));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [project, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const updateModifiers = (event: KeyboardEvent) => {
      setModifierKeys({ ctrl: event.ctrlKey, shift: event.shiftKey });
    };
    const clearModifiers = () => setModifierKeys({ ctrl: false, shift: false });
    window.addEventListener("keydown", updateModifiers);
    window.addEventListener("keyup", updateModifiers);
    window.addEventListener("blur", clearModifiers);
    return () => {
      window.removeEventListener("keydown", updateModifiers);
      window.removeEventListener("keyup", updateModifiers);
      window.removeEventListener("blur", clearModifiers);
    };
  }, []);

  const allLibraryItems = useMemo(() => [...primitiveLibrary, ...project.customLibrary], [project.customLibrary]);
  const selectedNode = selection?.type === "node" ? project.nodes.find((node) => node.id === selection.id) : undefined;
  const selectedConnection = selection?.type === "connection" ? project.connections.find((connection) => connection.id === selection.id) : undefined;
  const selectedProcess = selection?.type === "process" ? project.processes.find((process) => process.id === selection.id) : undefined;
  const activeProcess = project.processes.find((process) => process.id === activeProcessId);
  const activeRoute = useMemo(() => activeProcess ? calculateRoute(project, activeProcess.checkpoints) : [], [project, activeProcess]);

  useEffect(() => {
    if (!selectedNode || !selectedNode.capabilities.length || selectedNode.capabilities.includes(portDraft.capability)) return;
    const capability = selectedNode.capabilities[0];
    setPortDraft((current) => ({ ...current, capability, subtype: capabilityConfig[capability].subtypes[0] }));
  }, [selectedNode, portDraft.capability]);

  const updateNode = useCallback((nodeId: string, patch: Partial<SystemNode>) => {
    setProject((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === nodeId ? { ...node, ...patch } : node) }));
  }, []);

  const updateConnection = useCallback((connectionId: string, patch: Partial<Connection>) => {
    setProject((current) => ({ ...current, connections: current.connections.map((connection) => connection.id === connectionId ? { ...connection, ...patch } : connection) }));
  }, []);

  const updateProcess = useCallback((processId: string, patch: Partial<Process>) => {
    setProject((current) => ({ ...current, processes: current.processes.map((process) => process.id === processId ? { ...process, ...patch } : process) }));
  }, []);

  const showToast = (message: string) => setToast(message);

  const portPosition = useCallback((nodeId: string, portId: string) => {
    const node = project.nodes.find((item) => item.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    const port = node.ports.find((item) => item.id === portId);
    if (!port) return { x: node.x, y: node.y };
    const sameDirection = node.ports.filter((item) => item.direction === port.direction);
    const index = sameDirection.findIndex((item) => item.id === portId);
    return { x: port.direction === "inbound" ? node.x : node.x + node.width, y: node.y + 82 + index * 34 };
  }, [project.nodes]);

  const routeForConnection = useCallback((connection: Connection) => {
    const source = portPosition(connection.sourceNodeId, connection.sourcePortId);
    const target = portPosition(connection.targetNodeId, connection.targetPortId);
    return orthogonalRoutePoints(source, target, connection.bendPoints);
  }, [portPosition]);

  const saveRoute = useCallback((connection: Connection, routePoints: Point[]) => {
    updateConnection(connection.id, { bendPoints: compactPoints(routePoints).slice(1, -1) });
  }, [updateConnection]);

  const addBendPoint = useCallback((connection: Connection, point: Point) => {
    const source = portPosition(connection.sourceNodeId, connection.sourcePortId);
    const target = portPosition(connection.targetNodeId, connection.targetPortId);
    const route = orthogonalRoutePoints(source, target, connection.bendPoints);
    let segmentIndex = 0;
    let shortestDistance = Number.POSITIVE_INFINITY;
    route.slice(1).forEach((end, index) => {
      const start = route[index];
      const distance = start.x === end.x
        ? Math.abs(point.x - start.x) + Math.max(0, Math.min(start.y, end.y) - point.y, point.y - Math.max(start.y, end.y))
        : Math.abs(point.y - start.y) + Math.max(0, Math.min(start.x, end.x) - point.x, point.x - Math.max(start.x, end.x));
      if (distance < shortestDistance) {
        shortestDistance = distance;
        segmentIndex = index;
      }
    });
    const nextRoute = [...route];
    nextRoute.splice(segmentIndex + 1, 0, point);
    saveRoute(connection, orthogonalRoutePoints(source, target, nextRoute.slice(1, -1)));
  }, [portPosition, saveRoute]);

  const beginBendDrag = (event: ReactPointerEvent<SVGCircleElement>, connection: Connection, pointIndex: number) => {
    event.stopPropagation();
    if (event.button === 2) return;
    event.preventDefault();
    setSelection({ type: "connection", id: connection.id });
    const source = portPosition(connection.sourceNodeId, connection.sourcePortId);
    const target = portPosition(connection.targetNodeId, connection.targetPortId);
    const route = orthogonalRoutePoints(source, target, connection.bendPoints);
    const bendPoints = route.slice(1, -1);
    const point = bendPoints[pointIndex];
    if (!point) return;
    if (event.ctrlKey && event.shiftKey) {
      bendPoints.splice(pointIndex, 1);
      saveRoute(connection, orthogonalRoutePoints(source, target, bendPoints));
      showToast(`Bend point ${pointIndex + 1} removed.`);
      return;
    }
    const startX = event.clientX;
    const startY = event.clientY;
    const move = (moveEvent: PointerEvent) => {
      const movedBends = [...bendPoints];
      const movedPoint = {
        x: snap(point.x + (moveEvent.clientX - startX) / zoom),
        y: snap(point.y + (moveEvent.clientY - startY) / zoom),
      };
      movedBends[pointIndex] = movedPoint;
      saveRoute(connection, orthogonalRoutePoints(source, target, movedBends));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const beginSegmentDrag = (event: ReactPointerEvent<SVGLineElement>, connection: Connection, segmentIndex: number, route: Point[]) => {
    if (event.ctrlKey || event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    setSelection({ type: "connection", id: connection.id });
    const start = route[segmentIndex];
    const end = route[segmentIndex + 1];
    const horizontal = start.y === end.y;
    const startClientX = event.clientX;
    const startClientY = event.clientY;
    const move = (moveEvent: PointerEvent) => {
      const nextRoute = route.map((point) => ({ ...point }));
      const delta = horizontal
        ? snap((moveEvent.clientY - startClientY) / zoom)
        : snap((moveEvent.clientX - startClientX) / zoom);
      if (horizontal) {
        const y = start.y + delta;
        if (route.length === 2) {
          nextRoute.splice(1, 0, { x: start.x, y }, { x: end.x, y });
        } else if (segmentIndex === 0) {
          nextRoute.splice(1, 1, { x: start.x, y }, { x: end.x, y });
        } else if (segmentIndex === route.length - 2) {
          nextRoute[segmentIndex].y = y;
          nextRoute.splice(nextRoute.length - 1, 0, { x: end.x, y });
        } else {
          nextRoute[segmentIndex].y = y;
          nextRoute[segmentIndex + 1].y = y;
        }
      } else {
        const x = start.x + delta;
        if (route.length === 2) {
          nextRoute.splice(1, 0, { x, y: start.y }, { x, y: end.y });
        } else if (segmentIndex === 0) {
          nextRoute.splice(1, 1, { x, y: start.y }, { x, y: end.y });
        } else if (segmentIndex === route.length - 2) {
          nextRoute[segmentIndex].x = x;
          nextRoute.splice(nextRoute.length - 1, 0, { x, y: end.y });
        } else {
          nextRoute[segmentIndex].x = x;
          nextRoute[segmentIndex + 1].x = x;
        }
      }
      saveRoute(connection, nextRoute);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const handlePortClick = (node: SystemNode, port: Port) => {
    if (!connecting) {
      if (port.direction !== "outbound") {
        showToast("Start a connection from an outbound port.");
        return;
      }
      setConnecting({ nodeId: node.id, portId: port.id });
      showToast(`Connecting from ${node.name} · ${port.name}`);
      return;
    }
    const sourceNode = project.nodes.find((item) => item.id === connecting.nodeId);
    const sourcePort = sourceNode?.ports.find((item) => item.id === connecting.portId);
    if (!sourceNode || !sourcePort) { setConnecting(null); return; }
    if (port.direction !== "inbound") {
      showToast("Connections must finish at an inbound port.");
      return;
    }
    if (sourcePort.capability !== port.capability) {
      showToast(`${sourcePort.capability} is not compatible with ${port.capability}.`);
      return;
    }
    if (!portsAreCompatible(sourcePort, port)) {
      showToast(`${sourcePort.capability} ${sourcePort.subtype} is not compatible with ${port.subtype}.`);
      return;
    }
    const duplicate = project.connections.some((edge) => edge.sourcePortId === sourcePort.id && edge.targetPortId === port.id);
    if (duplicate) { showToast("These ports are already connected."); setConnecting(null); return; }
    const connection: Connection = {
      id: id("connection"), sourceNodeId: sourceNode.id, sourcePortId: sourcePort.id, targetNodeId: node.id, targetPortId: port.id,
      capability: sourcePort.capability, subtype: connectionSubtype(sourcePort, port), dataType: "Unassigned data", description: "",
    };
    setProject((current) => ({ ...current, connections: [...current.connections, connection] }));
    setConnecting(null);
    setSelection({ type: "connection", id: connection.id });
    showToast(`${connection.capability} ${connection.subtype} connection created.`);
  };

  const beginNodeDrag = (event: ReactPointerEvent, node: SystemNode) => {
    if ((event.target as HTMLElement).closest("button, input, select")) return;
    event.stopPropagation();
    setSelection({ type: "node", id: node.id });
    const startX = event.clientX;
    const startY = event.clientY;
    const initialX = node.x;
    const initialY = node.y;
    const move = (moveEvent: PointerEvent) => updateNode(node.id, { x: snap(initialX + (moveEvent.clientX - startX) / zoom), y: snap(initialY + (moveEvent.clientY - startY) / zoom) });
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const beginResize = (event: ReactPointerEvent, node: SystemNode) => {
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const initialWidth = node.width;
    const initialHeight = node.height;
    const move = (moveEvent: PointerEvent) => updateNode(node.id, { width: Math.max(192, snap(initialWidth + (moveEvent.clientX - startX) / zoom)), height: Math.max(160, snap(initialHeight + (moveEvent.clientY - startY) / zoom)) });
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const beginPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget && !(event.target as HTMLElement).classList.contains("diagram-surface")) return;
    setSelection(null);
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = pan;
    const move = (moveEvent: PointerEvent) => setPan({ x: initial.x + moveEvent.clientX - startX, y: initial.y + moveEvent.clientY - startY });
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      setZoom((current) => Math.min(1.5, Math.max(0.4, current - event.deltaY * 0.001)));
    } else {
      setPan((current) => ({ x: current.x - event.deltaX, y: current.y - event.deltaY }));
    }
  };

  const addNodeFromLibrary = (item: LibraryItem, x = 480, y = 360) => {
    const node: SystemNode = { id: id("node"), name: item.name, kind: item.kind, description: item.description, x: snap(x), y: snap(y), width: 224, height: 176, color: item.color, capabilities: [...item.capabilities], ports: [] };
    setProject((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setSelection({ type: "node", id: node.id });
    showToast(`${node.name} added. Add ports from Properties.`);
  };

  const handleCanvasDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const libraryId = event.dataTransfer.getData("application/x-careflow-library");
    const item = allLibraryItems.find((entry) => entry.id === libraryId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!item || !rect) return;
    addNodeFromLibrary(item, (event.clientX - rect.left - pan.x) / zoom, (event.clientY - rect.top - pan.y) / zoom);
  };

  const addPort = () => {
    if (!selectedNode) return;
    if (!selectedNode.capabilities.includes(portDraft.capability)) {
      showToast(`Enable ${portDraft.capability} before adding this port.`);
      return;
    }
    const port: Port = {
      id: id("port"),
      ...portDraft,
      name:
        portDraft.name.trim() ||
        `${portDraft.subtype} ${portDraft.direction === "inbound" ? "In" : "Out"}`,
    };
    updateNode(selectedNode.id, { ports: [...selectedNode.ports, port] });
    setPortDraft((current) => ({ ...current, name: "" }));
    showToast(`${port.capability} ${port.subtype} port added.`);
  };

  const removeSelected = () => {
    if (!selection) return;
    if (selection.type === "node") {
      setProject((current) => ({ ...current, nodes: current.nodes.filter((node) => node.id !== selection.id), connections: current.connections.filter((edge) => edge.sourceNodeId !== selection.id && edge.targetNodeId !== selection.id), processes: current.processes.map((process) => ({ ...process, checkpoints: process.checkpoints.filter((nodeId) => nodeId !== selection.id) })) }));
    } else if (selection.type === "connection") {
      setProject((current) => ({ ...current, connections: current.connections.filter((edge) => edge.id !== selection.id) }));
    } else {
      setProject((current) => ({ ...current, processes: current.processes.filter((process) => process.id !== selection.id) }));
    }
    setSelection(null);
    showToast("Removed from the project.");
  };

  const importProject = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Project;
      if (parsed.version !== 1 || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.connections)) throw new Error();
      setProject(parsed);
      setSelection(null);
      showToast(`${parsed.name} opened.`);
    } catch { showToast("That file is not a valid CareFlow project."); }
  };

  const importLibrary = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as LibraryItem[];
      if (!Array.isArray(parsed)) throw new Error();
      setProject((current) => ({ ...current, customLibrary: parsed }));
      showToast(`${parsed.length} custom objects imported.`);
    } catch { showToast("That file is not a valid object library."); }
  };

  const createTemplate = () => {
    const name = newTemplateName.trim();
    if (!name) return;
    const source = primitiveLibrary.find((item) => item.kind === newTemplateKind)!;
    const item: LibraryItem = { ...source, id: id("template"), name, description: `Custom ${source.name.toLowerCase()}` };
    setProject((current) => ({ ...current, customLibrary: [...current.customLibrary, item] }));
    setNewTemplateName("");
    showToast(`${name} added to your custom library.`);
  };

  const addProcess = () => {
    const process: Process = { id: id("process"), name: "New process", description: "Describe the operational workflow.", checkpoints: [], color: "#2f6df6" };
    setProject((current) => ({ ...current, processes: [...current.processes, process] }));
    setSelection({ type: "process", id: process.id });
    setActiveProcessId(process.id);
    setProcessOpen(true);
  };

  const addCheckpoint = (nodeId: string) => {
    if (!selectedProcess || !nodeId) return;
    updateProcess(selectedProcess.id, { checkpoints: [...selectedProcess.checkpoints, nodeId] });
  };

  const fitDiagram = () => {
    if (!project.nodes.length) { setZoom(0.82); setPan({ x: 40, y: 40 }); return; }
    const minX = Math.min(...project.nodes.map((node) => node.x));
    const minY = Math.min(...project.nodes.map((node) => node.y));
    setZoom(0.82);
    setPan({ x: 70 - minX * 0.82, y: 90 - minY * 0.82 });
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">CF</div>
        <div className="brand-copy"><strong>CareFlow Studio</strong><span>Healthcare connectivity modeling</span></div>
        <div className="project-divider" />
        <button className="project-title-button" onClick={() => setNewProjectOpen(true)} aria-label="Project options">
          <span>{project.name}</span><small>Saved locally · {project.nodes.length} systems</small>
        </button>
        <div className="topbar-actions">
          <button className="button ghost" onClick={() => fileInputRef.current?.click()}>Open JSON</button>
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={(event) => event.target.files?.[0] && importProject(event.target.files[0])} />
          <button className="button ghost" onClick={() => downloadJson(project, `${project.name.toLowerCase().replaceAll(" ", "-")}.json`)}>Export</button>
          <button className="button primary" onClick={() => showToast("All changes are saved in this browser.")}><span className="status-dot" /> Saved</button>
        </div>
      </header>

      <div className="workspace">
        <aside className="library-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">Build</span><h2>Object library</h2></div>
            <button className="icon-button" onClick={() => setLibraryOpen(true)} aria-label="Manage object library">⚙</button>
          </div>
          <div className="library-search">⌕ <span>Search systems…</span><kbd>⌘K</kbd></div>
          <p className="section-label">Healthcare primitives</p>
          <div className="library-list">
            {allLibraryItems.map((item) => (
              <div key={item.id} className="library-card" draggable onDragStart={(event) => event.dataTransfer.setData("application/x-careflow-library", item.id)} onDoubleClick={() => addNodeFromLibrary(item)}>
                <div className="library-icon" style={{ "--accent": item.color } as React.CSSProperties}>{icons[item.kind]}</div>
                <div><strong>{item.name}</strong><span>{item.capabilities.join(" · ")}</span></div>
                <span className="drag-grip">⠿</span>
              </div>
            ))}
          </div>
          <button className="manage-library" onClick={() => setLibraryOpen(true)}>＋ Create custom object</button>
          <div className="tip-card"><span>TIP</span><p>Drag an object onto the canvas, then define its capabilities and ports in Properties.</p></div>
        </aside>

        <section className="canvas-column">
          <div className="canvas-toolbar">
            <div className="tool-group">
              <button className="tool active" aria-label="Select tool">↖</button>
              <button className="tool" onClick={() => setConnecting(null)} aria-label="Pan tool">✋</button>
              <span className="tool-separator" />
              <button className={`tool ${connecting ? "active-connect" : ""}`} onClick={() => { setConnecting(null); showToast("Click an outbound port, then a compatible inbound port."); }} aria-label="Connect tool">↗</button>
              <button className="tool" onClick={addProcess} aria-label="Add process">◎</button>
            </div>
            <div className="canvas-crumb"><span>Logical Diagram</span><b>/</b><strong>Primary View</strong></div>
            <div className="zoom-controls">
              <button onClick={() => setZoom((value) => Math.max(0.4, value - 0.1))}>−</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))}>＋</button>
              <button className="fit-button" onClick={fitDiagram}>Fit</button>
            </div>
          </div>

          <div
            className={`canvas-viewport ${connecting ? "is-connecting" : ""} ${modifierKeys.ctrl ? "ctrl-modifier" : ""} ${modifierKeys.shift ? "shift-modifier" : ""}`}
            ref={canvasRef}
            onPointerDown={beginPan}
            onWheel={handleWheel}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleCanvasDrop}
          >
            <div className="diagram-surface" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
              <svg className="connection-layer" viewBox="0 0 2400 1600" aria-label="System connections">
                <defs>
                  <filter id="edgeGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                {project.connections.map((connection) => {
                  const active = activeRoute.includes(connection.id);
                  const selected = selection?.type === "connection" && selection.id === connection.id;
                  const routePoints = routeForConnection(connection);
                  const path = svgPath(routePoints);
                  const label = routeMidpoint(routePoints);
                  const accent = activeProcess?.color ?? capabilityConfig[connection.capability].color;
                  return (
                    <g
                      key={connection.id}
                      className={`edge ${active ? "active-route" : ""} ${selected ? "selected" : ""}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`Select ${connection.capability} ${connection.subtype} connection`}
                      onPointerDown={(event) => { event.stopPropagation(); setSelection({ type: "connection", id: connection.id }); }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelection({ type: "connection", id: connection.id });
                        }
                      }}
                    >
                      <path
                        className="edge-hit"
                        d={path}
                        onClick={(event) => {
                          if (!event.ctrlKey) return;
                          event.stopPropagation();
                          event.preventDefault();
                          const rect = canvasRef.current?.getBoundingClientRect();
                          if (!rect) return;
                          addBendPoint(connection, {
                            x: snap((event.clientX - rect.left - pan.x) / zoom),
                            y: snap((event.clientY - rect.top - pan.y) / zoom),
                          });
                          setSelection({ type: "connection", id: connection.id });
                        }}
                      />
                      <path className="edge-line" d={path} style={{ "--edge-color": active ? accent : capabilityConfig[connection.capability].color } as React.CSSProperties} />
                      {selected && routePoints.slice(1).map((point, segmentIndex) => {
                        const start = routePoints[segmentIndex];
                        return (
                          <line
                            key={`${connection.id}-segment-${segmentIndex}`}
                            className={`edge-segment-hit ${start.y === point.y ? "horizontal" : "vertical"}`}
                            x1={start.x}
                            y1={start.y}
                            x2={point.x}
                            y2={point.y}
                            onPointerDown={(event) => beginSegmentDrag(event, connection, segmentIndex, routePoints)}
                          />
                        );
                      })}
                      <g className="edge-label" transform={`translate(${label.x} ${label.y - 14})`}>
                        <rect x="-52" y="-12" width="104" height="24" rx="12" />
                        <text textAnchor="middle" dominantBaseline="middle">{connection.capability} · {connection.subtype}</text>
                      </g>
                      {selected && routePoints.slice(1, -1).map((point, pointIndex) => (
                        <circle
                          key={`${connection.id}-bend-${pointIndex}`}
                          className="bend-handle"
                          cx={point.x}
                          cy={point.y}
                          r="7"
                          role="button"
                          aria-label={`Move bend point ${pointIndex + 1}`}
                          onPointerDown={(event) => beginBendDrag(event, connection, pointIndex)}
                          onContextMenu={(event) => {
                            if (!event.ctrlKey) return;
                            event.preventDefault();
                            event.stopPropagation();
                            const remaining = routePoints.slice(1, -1).filter((_, index) => index !== pointIndex);
                            const source = routePoints[0];
                            const target = routePoints.at(-1)!;
                            saveRoute(connection, orthogonalRoutePoints(source, target, remaining));
                            showToast(`Bend point ${pointIndex + 1} removed.`);
                          }}
                        />
                      ))}
                      {active && isAnimating && (
                        <circle r="5" fill={accent} filter="url(#edgeGlow)">
                          <animateMotion dur="2.2s" repeatCount="indefinite" path={path} />
                        </circle>
                      )}
                    </g>
                  );
                })}
              </svg>

              {project.nodes.map((node) => {
                const inbound = node.ports.filter((port) => port.direction === "inbound");
                const outbound = node.ports.filter((port) => port.direction === "outbound");
                const selected = selection?.type === "node" && selection.id === node.id;
                const inActiveProcess = activeProcess?.checkpoints.includes(node.id) || activeRoute.some((edgeId) => {
                  const edge = project.connections.find((item) => item.id === edgeId);
                  return edge?.sourceNodeId === node.id || edge?.targetNodeId === node.id;
                });
                return (
                  <article
                    key={node.id}
                    className={`system-node ${selected ? "selected" : ""} ${inActiveProcess ? "process-node" : ""}`}
                    style={{ left: node.x, top: node.y, width: node.width, height: node.height, "--node-accent": node.color, "--process-accent": activeProcess?.color ?? node.color } as React.CSSProperties}
                    onPointerDown={(event) => beginNodeDrag(event, node)}
                  >
                    <div className="node-topline" />
                    <div className="node-header">
                      <div className="node-icon">{icons[node.kind]}</div>
                      <div><strong>{node.name}</strong><span>{primitiveLibrary.find((item) => item.kind === node.kind)?.name ?? "System"}</span></div>
                      <button aria-label={`More options for ${node.name}`}>•••</button>
                    </div>
                    <div className="capability-row">{node.capabilities.map((capability) => <span key={capability} style={{ "--cap": capabilityConfig[capability].color } as React.CSSProperties}>{capability}</span>)}</div>
                    <div className="port-column inbound">
                      {inbound.map((port) => <button key={port.id} className={`port ${connecting ? "target-ready" : ""}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => handlePortClick(node, port)} title={`${port.capability} ${port.subtype}`}><i style={{ "--port-color": capabilityConfig[port.capability].color } as React.CSSProperties} /><span>{port.name}</span></button>)}
                    </div>
                    <div className="port-column outbound">
                      {outbound.map((port) => <button key={port.id} className={`port ${connecting?.portId === port.id ? "source-active" : ""}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => handlePortClick(node, port)} title={`${port.capability} ${port.subtype}`}><span>{port.name}</span><i style={{ "--port-color": capabilityConfig[port.capability].color } as React.CSSProperties} /></button>)}
                    </div>
                    {selected && <button className="resize-handle" onPointerDown={(event) => beginResize(event, node)} aria-label={`Resize ${node.name}`} />}
                  </article>
                );
              })}

              {!project.nodes.length && (
                <div className="empty-canvas"><div>＋</div><h2>Build your connectivity map</h2><p>Drag a healthcare primitive from the object library to begin.</p></div>
              )}
            </div>

            <div className="minimap">
              <div className="minimap-label">MAP</div>
              {project.nodes.map((node) => <i key={node.id} style={{ left: `${Math.min(88, node.x / 18)}%`, top: `${Math.min(78, node.y / 12)}%`, background: node.color }} />)}
              <div className="minimap-window" />
            </div>
            <div className="canvas-hint">Scroll to pan · ⌘ scroll to zoom · Snap {GRID}px</div>
          </div>

          <div className={`process-tray ${processOpen ? "open" : ""}`}>
            <button className="tray-toggle" onClick={() => setProcessOpen((value) => !value)}><span>Data flow processes</span><b>{project.processes.length}</b><i>{processOpen ? "⌄" : "⌃"}</i></button>
            {processOpen && (
              <div className="process-content">
                <div className="process-tabs">
                  {project.processes.map((process) => (
                    <button key={process.id} className={activeProcessId === process.id ? "active" : ""} onClick={() => { setActiveProcessId(process.id); setSelection({ type: "process", id: process.id }); }}><i style={{ background: process.color }} />{process.name}</button>
                  ))}
                  <button className="add-process" onClick={addProcess}>＋</button>
                </div>
                {activeProcess && (
                  <div className="process-summary">
                    <button className={`play-button ${isAnimating ? "playing" : ""}`} onClick={() => setIsAnimating((value) => !value)}>{isAnimating ? "Ⅱ" : "▶"}</button>
                    <div className="process-copy"><strong>{activeProcess.name}</strong><span>{activeProcess.description}</span></div>
                    <div className="route-points">
                      {activeProcess.checkpoints.map((nodeId, index) => <span key={`${nodeId}-${index}`}>{project.nodes.find((node) => node.id === nodeId)?.name ?? "Missing point"}{index < activeProcess.checkpoints.length - 1 && <i>→</i>}</span>)}
                    </div>
                    <div className={`route-status ${activeRoute.length ? "valid" : "invalid"}`}><i />{activeRoute.length ? `${activeRoute.length} connection${activeRoute.length === 1 ? "" : "s"} routed` : "No valid route"}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <aside className="properties-panel">
          <div className="properties-heading"><div><span className="eyebrow">Inspect</span><h2>Properties</h2></div>{selection && <button className="delete-button" onClick={removeSelected}>Delete</button>}</div>
          {!selection && <div className="properties-empty"><div>◇</div><h3>Nothing selected</h3><p>Select a system, connection, or process to inspect and edit its properties.</p></div>}

          {selectedNode && (
            <div className="property-content">
              <div className="selection-summary"><div className="large-object-icon" style={{ background: selectedNode.color }}>{icons[selectedNode.kind]}</div><div><span>SYSTEM OBJECT</span><strong>{selectedNode.name}</strong><small>{selectedNode.id}</small></div></div>
              <section className="property-section"><h3>General</h3><label>Name<input value={selectedNode.name} onChange={(event) => updateNode(selectedNode.id, { name: event.target.value })} /></label><label>Description<textarea rows={3} value={selectedNode.description} onChange={(event) => updateNode(selectedNode.id, { description: event.target.value })} /></label><div className="field-row"><label>Color<input className="color-field" type="color" value={selectedNode.color} onChange={(event) => updateNode(selectedNode.id, { color: event.target.value })} /></label><label>Object type<select value={selectedNode.kind} onChange={(event) => updateNode(selectedNode.id, { kind: event.target.value as PrimitiveKind })}>{primitiveLibrary.map((item) => <option key={item.kind} value={item.kind}>{item.name}</option>)}</select></label></div></section>
              <section className="property-section"><h3>Capabilities <span>{selectedNode.capabilities.length}</span></h3><div className="capability-picker">{(Object.keys(capabilityConfig) as Capability[]).map((capability) => { const enabled = selectedNode.capabilities.includes(capability); return <button key={capability} className={enabled ? "enabled" : ""} style={{ "--cap": capabilityConfig[capability].color } as React.CSSProperties} onClick={() => updateNode(selectedNode.id, { capabilities: enabled ? selectedNode.capabilities.filter((item) => item !== capability) : [...selectedNode.capabilities, capability] })}><i />{capability}<b>{enabled ? "✓" : "+"}</b></button>; })}</div></section>
              <section className="property-section ports-section"><h3>Ports <span>{selectedNode.ports.length}</span></h3>{selectedNode.ports.map((port) => <div className="port-property" key={port.id}><i style={{ background: capabilityConfig[port.capability].color }} /><div><strong>{port.name}</strong><span>{port.direction} · {port.capability} {port.subtype}</span></div><button onClick={() => updateNode(selectedNode.id, { ports: selectedNode.ports.filter((item) => item.id !== port.id) })}>×</button></div>)}
                <div className="add-port-box"><div className="field-row"><label>Direction<select value={portDraft.direction} onChange={(event) => setPortDraft((current) => ({ ...current, direction: event.target.value as Direction }))}><option value="inbound">Inbound</option><option value="outbound">Outbound</option></select></label><label>Protocol<select value={portDraft.capability} onChange={(event) => { const capability = event.target.value as Capability; setPortDraft((current) => ({ ...current, capability, subtype: capabilityConfig[capability].subtypes[0] })); }}>{selectedNode.capabilities.map((capability) => <option key={capability}>{capability}</option>)}</select></label></div><label>Subtype<select value={portDraft.subtype} onChange={(event) => setPortDraft((current) => ({ ...current, subtype: event.target.value }))}>{capabilityConfig[portDraft.capability].subtypes.map((subtype) => <option key={subtype}>{subtype}</option>)}</select></label><label>Port label<input placeholder="Optional friendly name" value={portDraft.name} onChange={(event) => setPortDraft((current) => ({ ...current, name: event.target.value }))} /></label><button className="button secondary full" onClick={addPort}>＋ Add connection point</button></div>
              </section>
            </div>
          )}

          {selectedConnection && (
            <div className="property-content">
              <div className="selection-summary"><div className="large-object-icon connection-icon">↗</div><div><span>CONNECTION</span><strong>{selectedConnection.capability} · {selectedConnection.subtype}</strong><small>{selectedConnection.id}</small></div></div>
              <section className="property-section"><h3>Semantic definition</h3><div className="semantic-lock"><i style={{ background: capabilityConfig[selectedConnection.capability].color }} /><div><span>Protocol & subtype</span><strong>{selectedConnection.capability} / {selectedConnection.subtype}</strong></div><b>Locked by ports</b></div><label>Data being carried<input value={selectedConnection.dataType} onChange={(event) => updateConnection(selectedConnection.id, { dataType: event.target.value })} /></label><label>Operational description<textarea rows={4} value={selectedConnection.description} onChange={(event) => updateConnection(selectedConnection.id, { description: event.target.value })} /></label></section>
              <section className="property-section"><h3>Endpoints</h3><div className="endpoint"><span>FROM</span><strong>{project.nodes.find((node) => node.id === selectedConnection.sourceNodeId)?.name}</strong><small>{project.nodes.find((node) => node.id === selectedConnection.sourceNodeId)?.ports.find((port) => port.id === selectedConnection.sourcePortId)?.name}</small></div><div className="endpoint"><span>TO</span><strong>{project.nodes.find((node) => node.id === selectedConnection.targetNodeId)?.name}</strong><small>{project.nodes.find((node) => node.id === selectedConnection.targetNodeId)?.ports.find((port) => port.id === selectedConnection.targetPortId)?.name}</small></div></section>
              <section className="property-section route-section">
                <h3>Route points <span>{selectedConnection.bendPoints?.length ?? 0}</span></h3>
                <p className="helper-copy">Every 90° corner has a handle, including automatic routes. Drag a handle to reshape the corner or drag between handles to move a whole segment. Ctrl+click adds a point; Ctrl+right-click removes one.</p>
                {(selectedConnection.bendPoints ?? []).map((point, pointIndex) => (
                  <div className="route-point" key={`${selectedConnection.id}-property-${pointIndex}`}>
                    <b>{pointIndex + 1}</b>
                    <span>X {point.x} · Y {point.y}</span>
                    <button
                      aria-label={`Remove bend point ${pointIndex + 1}`}
                      onClick={() => updateConnection(selectedConnection.id, {
                        bendPoints: selectedConnection.bendPoints?.filter((_, index) => index !== pointIndex),
                      })}
                    >×</button>
                  </div>
                ))}
                <div className="route-actions">
                  <button className="button ghost" disabled={!selectedConnection.bendPoints?.length} onClick={() => updateConnection(selectedConnection.id, { bendPoints: [] })}>Reset</button>
                </div>
              </section>
            </div>
          )}

          {selectedProcess && (
            <div className="property-content">
              <div className="selection-summary"><div className="large-object-icon process-icon">◎</div><div><span>DATA FLOW PROCESS</span><strong>{selectedProcess.name}</strong><small>{selectedProcess.id}</small></div></div>
              <section className="property-section"><h3>Operational definition</h3><label>Process name<input value={selectedProcess.name} onChange={(event) => updateProcess(selectedProcess.id, { name: event.target.value })} /></label><label>Description<textarea rows={4} value={selectedProcess.description} onChange={(event) => updateProcess(selectedProcess.id, { description: event.target.value })} /></label><label>Flow color<input className="color-field" type="color" value={selectedProcess.color} onChange={(event) => updateProcess(selectedProcess.id, { color: event.target.value })} /></label></section>
              <section className="property-section"><h3>Process points <span>{selectedProcess.checkpoints.length}</span></h3><p className="helper-copy">The route is calculated across existing directed connections between each point.</p>{selectedProcess.checkpoints.map((nodeId, index) => <div className="checkpoint" key={`${nodeId}-${index}`}><b>{index + 1}</b><div><strong>{project.nodes.find((node) => node.id === nodeId)?.name ?? "Missing system"}</strong><span>{index === 0 ? "Start" : index === selectedProcess.checkpoints.length - 1 ? "Finish" : "Checkpoint"}</span></div><button onClick={() => updateProcess(selectedProcess.id, { checkpoints: selectedProcess.checkpoints.filter((_, itemIndex) => itemIndex !== index) })}>×</button></div>)}<label>Add point<select defaultValue="" onChange={(event) => { addCheckpoint(event.target.value); event.target.value = ""; }}><option value="" disabled>Choose a system…</option>{project.nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select></label><button className="button secondary full" onClick={() => { setActiveProcessId(selectedProcess.id); setIsAnimating(true); }}>▶ Calculate & animate route</button></section>
            </div>
          )}
        </aside>
      </div>

      {toast && <div className="toast"><span>i</span>{toast}<button onClick={() => setToast(null)}>×</button></div>}

      {libraryOpen && (
        <div className="modal-backdrop" onPointerDown={(event) => event.target === event.currentTarget && setLibraryOpen(false)}>
          <div className="modal library-modal"><div className="modal-header"><div><span className="eyebrow">Reusable assets</span><h2>Object library manager</h2><p>Build a project-independent library of healthcare system primitives.</p></div><button onClick={() => setLibraryOpen(false)}>×</button></div><div className="modal-body"><div className="template-grid">{allLibraryItems.map((item) => <div className="template-card" key={item.id}><div className="library-icon" style={{ "--accent": item.color } as React.CSSProperties}>{icons[item.kind]}</div><strong>{item.name}</strong><span>{item.description}</span><div>{item.capabilities.map((capability) => <i key={capability}>{capability}</i>)}</div>{project.customLibrary.some((custom) => custom.id === item.id) && <button onClick={() => setProject((current) => ({ ...current, customLibrary: current.customLibrary.filter((custom) => custom.id !== item.id) }))}>Remove</button>}</div>)}</div><div className="template-builder"><h3>Create custom object</h3><p>Start with a primitive, then configure the instance on your canvas.</p><label>Object name<input placeholder="e.g. Cardiology Archive" value={newTemplateName} onChange={(event) => setNewTemplateName(event.target.value)} /></label><label>Starting primitive<select value={newTemplateKind} onChange={(event) => setNewTemplateKind(event.target.value as PrimitiveKind)}>{primitiveLibrary.map((item) => <option key={item.kind} value={item.kind}>{item.name}</option>)}</select></label><button className="button primary full" onClick={createTemplate}>Create object template</button><hr /><button className="button secondary full" onClick={() => downloadJson(project.customLibrary, "careflow-object-library.json")}>Export custom library</button><button className="button ghost full" onClick={() => libraryInputRef.current?.click()}>Import library JSON</button><input ref={libraryInputRef} type="file" accept="application/json" hidden onChange={(event) => event.target.files?.[0] && importLibrary(event.target.files[0])} /></div></div></div>
        </div>
      )}

      {newProjectOpen && (
        <div className="modal-backdrop" onPointerDown={(event) => event.target === event.currentTarget && setNewProjectOpen(false)}>
          <div className="modal project-modal"><div className="modal-header"><div><span className="eyebrow">Project workflow</span><h2>Create or open a project</h2><p>Projects are saved locally and can be moved as JSON files.</p></div><button onClick={() => setNewProjectOpen(false)}>×</button></div><div className="project-modal-body"><div className="new-project-form"><label>Project name<input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} /></label><label>Project description<textarea rows={4} placeholder="What systems and workflows will this diagram describe?" value={newProjectDescription} onChange={(event) => setNewProjectDescription(event.target.value)} /></label><button className="button primary full" onClick={() => { setProject(blankProject(newProjectName.trim() || "Untitled project", newProjectDescription)); setSelection(null); setActiveProcessId(null); setNewProjectOpen(false); }}>Create empty project</button></div><div className="project-options"><button onClick={() => { setProject(createDemoProject()); setSelection({ type: "node", id: "app-1" }); setActiveProcessId("proc-order"); setNewProjectOpen(false); }}><span>✦</span><div><strong>Load PACS example</strong><small>Explore a complete order and image workflow.</small></div></button><button onClick={() => fileInputRef.current?.click()}><span>↥</span><div><strong>Open JSON project</strong><small>Continue work from an exported file.</small></div></button><div className="workflow-steps">{["Describe project", "Choose objects", "Build diagram", "Connect ports", "Animate processes"].map((step, index) => <div key={step}><b>{index + 1}</b><span>{step}</span></div>)}</div></div></div></div>
        </div>
      )}
    </main>
  );
}
