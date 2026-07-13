import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { ExportDialog } from "./components/ExportDialog";
import { PropertiesInspector } from "./components/PropertiesInspector";
import { ConnectionLayer } from "./components/canvas/ConnectionLayer";
import { SystemNodeLayer } from "./components/canvas/SystemNodeLayer";
import { useProjectDocument } from "./hooks/useProjectDocument";
import { useCanvasViewport } from "./hooks/useCanvasViewport";
import { useEditorInteraction } from "./hooks/useEditorInteraction";
import { useDiagramInteractions } from "./hooks/useDiagramInteractions";
import { capabilityConfig, icons, primitiveLibrary } from "./model/catalog";
import { blankProject, calculateProcessRoute, connectionSubtype, createDemoProject, createId, GRID, migrateProjectDocument, portsAreCompatible, snap } from "./model/project";
import { orthogonalRoutePoints } from "./model/routing";
import type { Connection, DataFlowProcess as Process, LibraryItem, Port, PortDraft, PrimitiveKind, SystemNode } from "./model/types";
import { downloadJson } from "./utils/download";

export default function DiagramApp() {
  const { project, setProject, dispatch } = useProjectDocument();
  const { selection, setSelection, connecting, setConnecting, modifierKeys } = useEditorInteraction();
  const { zoom, setZoom, pan, beginPan, handleWheel, fitDiagram, toCanvasPoint } = useCanvasViewport(project.nodes, () => setSelection(null));
  const [toast, setToast] = useState<string | null>(null);
  const [activeProcessId, setActiveProcessId] = useState<string | null>("proc-order");
  const [isAnimating, setIsAnimating] = useState(true);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [processOpen, setProcessOpen] = useState(true);
  const [newProjectName, setNewProjectName] = useState("New healthcare integration");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateKind, setNewTemplateKind] = useState<PrimitiveKind>("application");
  const [portDraft, setPortDraft] = useState<PortDraft>({ direction: "inbound", capability: "HL7", subtype: "ADT", name: "" });
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const allLibraryItems = useMemo(() => [...primitiveLibrary, ...project.customLibrary], [project.customLibrary]);
  const selectedNode = selection?.type === "node" ? project.nodes.find((node) => node.id === selection.id) : undefined;
  const selectedProcess = selection?.type === "process" ? project.processes.find((process) => process.id === selection.id) : undefined;
  const activeProcess = project.processes.find((process) => process.id === activeProcessId);
  const activeRoute = useMemo(() => activeProcess ? calculateProcessRoute(project, activeProcess.checkpoints) : [], [project, activeProcess]);

  useEffect(() => {
    if (!selectedNode || !selectedNode.capabilities.length || selectedNode.capabilities.includes(portDraft.capability)) return;
    const capability = selectedNode.capabilities[0];
    setPortDraft((current) => ({ ...current, capability, subtype: capabilityConfig[capability].subtypes[0] }));
  }, [selectedNode, portDraft.capability]);

  const updateNode = useCallback((nodeId: string, patch: Partial<SystemNode>) => {
    dispatch({ type: "node.update", id: nodeId, patch });
  }, [dispatch]);

  const updateConnection = useCallback((connectionId: string, patch: Partial<Connection>) => {
    dispatch({ type: "connection.update", id: connectionId, patch });
  }, [dispatch]);

  const updateProcess = useCallback((processId: string, patch: Partial<Process>) => {
    dispatch({ type: "process.update", id: processId, patch });
  }, [dispatch]);

  const showToast = (message: string) => setToast(message);
  const { saveRoute, addBendPoint, beginBendDrag, beginSegmentDrag, beginNodeDrag, beginResize } = useDiagramInteractions({ project, zoom, setSelection, updateNode, updateConnection, showToast });

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
      id: createId("connection"), sourceNodeId: sourceNode.id, sourcePortId: sourcePort.id, targetNodeId: node.id, targetPortId: port.id,
      capability: sourcePort.capability, subtype: connectionSubtype(sourcePort, port), dataType: "Unassigned data", description: "",
    };
    dispatch({ type: "connection.add", connection });
    setConnecting(null);
    setSelection({ type: "connection", id: connection.id });
    showToast(`${connection.capability} ${connection.subtype} connection created.`);
  };

  const addNodeFromLibrary = (item: LibraryItem, x = 480, y = 360) => {
    const node: SystemNode = { id: createId("node"), name: item.name, kind: item.kind, description: item.description, x: snap(x), y: snap(y), width: 224, height: 176, color: item.color, capabilities: [...item.capabilities], ports: [] };
    dispatch({ type: "node.add", node });
    setSelection({ type: "node", id: node.id });
    showToast(`${node.name} added. Add ports from Properties.`);
  };

  const handleCanvasDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const libraryId = event.dataTransfer.getData("application/x-careflow-library");
    const item = allLibraryItems.find((entry) => entry.id === libraryId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!item || !rect) return;
    const point = toCanvasPoint({ x: event.clientX, y: event.clientY }, rect);
    addNodeFromLibrary(item, point.x, point.y);
  };

  const addPort = () => {
    if (!selectedNode) return;
    if (!selectedNode.capabilities.includes(portDraft.capability)) {
      showToast(`Enable ${portDraft.capability} before adding this port.`);
      return;
    }
    const port: Port = {
      id: createId("port"),
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
    dispatch({ type: "selection.delete", selection });
    setSelection(null);
    showToast("Removed from the project.");
  };

  const importProject = async (file: File) => {
    try {
      const parsed = migrateProjectDocument(JSON.parse(await file.text()));
      if (!parsed) throw new Error();
      setProject(parsed);
      setSelection(null);
      showToast(`${parsed.name} opened.`);
    } catch { showToast("That file is not a valid CareFlow project."); }
  };

  const importLibrary = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as LibraryItem[];
      if (!Array.isArray(parsed)) throw new Error();
      dispatch({ type: "library.replace", items: parsed });
      showToast(`${parsed.length} custom objects imported.`);
    } catch { showToast("That file is not a valid object library."); }
  };

  const createTemplate = () => {
    const name = newTemplateName.trim();
    if (!name) return;
    const source = primitiveLibrary.find((item) => item.kind === newTemplateKind)!;
    const item: LibraryItem = { ...source, id: createId("template"), name, description: `Custom ${source.name.toLowerCase()}` };
    dispatch({ type: "library.add", item });
    setNewTemplateName("");
    showToast(`${name} added to your custom library.`);
  };

  const addProcess = () => {
    const process: Process = { id: createId("process"), name: "New process", description: "Describe the operational workflow.", checkpoints: [], color: "#2f6df6" };
    dispatch({ type: "process.add", process });
    setSelection({ type: "process", id: process.id });
    setActiveProcessId(process.id);
    setProcessOpen(true);
  };

  const addCheckpoint = (nodeId: string) => {
    if (!selectedProcess || !nodeId) return;
    updateProcess(selectedProcess.id, { checkpoints: [...selectedProcess.checkpoints, nodeId] });
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
          <button className="button ghost" onClick={() => setExportOpen(true)}>Export</button>
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
              <ConnectionLayer
                project={project}
                selection={selection}
                activeRoute={activeRoute}
                activeProcess={activeProcess}
                isAnimating={isAnimating}
                canvasRef={canvasRef}
                pan={pan}
                zoom={zoom}
                onSelect={(connectionId) => setSelection({ type: "connection", id: connectionId })}
                onAddBend={addBendPoint}
                onBeginBendDrag={beginBendDrag}
                onBeginSegmentDrag={beginSegmentDrag}
                onRemoveBend={(connection, pointIndex, routePoints) => {
                  const remaining = routePoints.slice(1, -1).filter((_, index) => index !== pointIndex);
                  saveRoute(connection, orthogonalRoutePoints(routePoints[0], routePoints.at(-1)!, remaining));
                  showToast(`Bend point ${pointIndex + 1} removed.`);
                }}
              />
              <SystemNodeLayer project={project} selection={selection} connecting={connecting} activeRoute={activeRoute} activeProcess={activeProcess} onBeginNodeDrag={beginNodeDrag} onBeginResize={beginResize} onPortClick={handlePortClick} />
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

        <PropertiesInspector
          project={project}
          selection={selection}
          portDraft={portDraft}
          setPortDraft={setPortDraft}
          onDelete={removeSelected}
          onAddPort={addPort}
          onAddCheckpoint={addCheckpoint}
          onActivateProcess={(processId) => { setActiveProcessId(processId); setIsAnimating(true); }}
          onUpdateNode={updateNode}
          onUpdateConnection={updateConnection}
          onUpdateProcess={updateProcess}
        />
      </div>

      {toast && <div className="toast"><span>i</span>{toast}<button onClick={() => setToast(null)}>×</button></div>}

      {libraryOpen && (
        <div className="modal-backdrop" onPointerDown={(event) => event.target === event.currentTarget && setLibraryOpen(false)}>
          <div className="modal library-modal"><div className="modal-header"><div><span className="eyebrow">Reusable assets</span><h2>Object library manager</h2><p>Build a project-independent library of healthcare system primitives.</p></div><button onClick={() => setLibraryOpen(false)}>×</button></div><div className="modal-body"><div className="template-grid">{allLibraryItems.map((item) => <div className="template-card" key={item.id}><div className="library-icon" style={{ "--accent": item.color } as React.CSSProperties}>{icons[item.kind]}</div><strong>{item.name}</strong><span>{item.description}</span><div>{item.capabilities.map((capability) => <i key={capability}>{capability}</i>)}</div>{project.customLibrary.some((custom) => custom.id === item.id) && <button onClick={() => dispatch({ type: "library.remove", id: item.id })}>Remove</button>}</div>)}</div><div className="template-builder"><h3>Create custom object</h3><p>Start with a primitive, then configure the instance on your canvas.</p><label>Object name<input placeholder="e.g. Cardiology Archive" value={newTemplateName} onChange={(event) => setNewTemplateName(event.target.value)} /></label><label>Starting primitive<select value={newTemplateKind} onChange={(event) => setNewTemplateKind(event.target.value as PrimitiveKind)}>{primitiveLibrary.map((item) => <option key={item.kind} value={item.kind}>{item.name}</option>)}</select></label><button className="button primary full" onClick={createTemplate}>Create object template</button><hr /><button className="button secondary full" onClick={() => downloadJson(project.customLibrary, "careflow-object-library.json")}>Export custom library</button><button className="button ghost full" onClick={() => libraryInputRef.current?.click()}>Import library JSON</button><input ref={libraryInputRef} type="file" accept="application/json" hidden onChange={(event) => event.target.files?.[0] && importLibrary(event.target.files[0])} /></div></div></div>
        </div>
      )}

      {newProjectOpen && (
        <div className="modal-backdrop" onPointerDown={(event) => event.target === event.currentTarget && setNewProjectOpen(false)}>
          <div className="modal project-modal"><div className="modal-header"><div><span className="eyebrow">Project workflow</span><h2>Create or open a project</h2><p>Projects are saved locally and can be moved as JSON files.</p></div><button onClick={() => setNewProjectOpen(false)}>×</button></div><div className="project-modal-body"><div className="new-project-form"><label>Project name<input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} /></label><label>Project description<textarea rows={4} placeholder="What systems and workflows will this diagram describe?" value={newProjectDescription} onChange={(event) => setNewProjectDescription(event.target.value)} /></label><button className="button primary full" onClick={() => { setProject(blankProject(newProjectName.trim() || "Untitled project", newProjectDescription)); setSelection(null); setActiveProcessId(null); setNewProjectOpen(false); }}>Create empty project</button></div><div className="project-options"><button onClick={() => { setProject(createDemoProject()); setSelection({ type: "node", id: "app-1" }); setActiveProcessId("proc-order"); setNewProjectOpen(false); }}><span>✦</span><div><strong>Load PACS example</strong><small>Explore a complete order and image workflow.</small></div></button><button onClick={() => fileInputRef.current?.click()}><span>↥</span><div><strong>Open JSON project</strong><small>Continue work from an exported file.</small></div></button><div className="workflow-steps">{["Describe project", "Choose objects", "Build diagram", "Connect ports", "Animate processes"].map((step, index) => <div key={step}><b>{index + 1}</b><span>{step}</span></div>)}</div></div></div></div>
        </div>
      )}
      {exportOpen && <ExportDialog project={project} onClose={() => setExportOpen(false)} onToast={showToast} />}
    </main>
  );
}
