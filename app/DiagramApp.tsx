import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { ExportDialog } from "./components/ExportDialog";
import { CanvasToolbar } from "./components/CanvasToolbar";
import { PropertiesInspector } from "./components/PropertiesInspector"; import { Switch } from "./components/ui/Switch";
import { ObjectLibraryView } from "./components/ObjectLibraryView";
import { ConnectionLayer } from "./components/canvas/ConnectionLayer";
import { ContainerLayer } from "./components/canvas/ContainerLayer";
import { SystemNodeLayer } from "./components/canvas/SystemNodeLayer";
import { useProjectDocument } from "./hooks/useProjectDocument";
import { useCanvasViewport } from "./hooks/useCanvasViewport";
import { useEditorInteraction } from "./hooks/useEditorInteraction";
import { useDiagramInteractions } from "./hooks/useDiagramInteractions"; import { getProjectObject } from "./model/projectObject";
import { useContainerInteractions } from "./hooks/useContainerInteractions";
import { capabilityConfig, icons, primitiveLibrary } from "./model/catalog";
import { cloneCompositeContent, compositeLibraryItems } from "./model/compositeTemplates";
import { blankProject, calculateProcessRoute, connectionSubtype, createDemoProject, createId, GRID, migrateProjectDocument, portsAreCompatible, snap, withConnectionDefaults } from "./model/project";
import { connectionRoute, orthogonalRoutePoints } from "./model/routing";
import { boundsFromContainers, boundsFromNodes, boundsFromPoints, expandBounds, gridBackgroundStyle, nodeBounds, unionBounds } from "./model/viewport";
import { containerBounds } from "./model/containers";
import type { Bounds, Connection, DataFlowProcess as Process, DiagramContainer, LibraryItem, Port, PortDraft, PrimitiveKind, SystemNode } from "./model/types";
import { downloadJson } from "./utils/download";
export default function DiagramApp() {
  const { project, setProject, dispatch, undo, redo, canUndo, canRedo } = useProjectDocument();
  const { selection, setSelection, connecting, setConnecting, modifierKeys } = useEditorInteraction();
  const [activeView, setActiveView] = useState<"diagram" | "library">("diagram");
  const { viewportRef: canvasRef, zoom, pan, viewportBounds, beginPan, handleWheel, fitBounds, fitDocument, resetView, zoomIn, zoomOut, toCanvasPoint } = useCanvasViewport({ nodes: project.nodes, containers: project.containers, canvas: project.canvas, active: activeView === "diagram", onClearSelection: () => setSelection(null) });
  const [toast, setToast] = useState<string | null>(null);
  const [activeProcessId, setActiveProcessId] = useState<string | null>("proc-order");
  const [isAnimating, setIsAnimating] = useState(true);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [processOpen, setProcessOpen] = useState(true);
  const [containerEditing, setContainerEditing] = useState(false);
  const [newProjectName, setNewProjectName] = useState("New healthcare integration");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateKind, setNewTemplateKind] = useState<PrimitiveKind>("application");
  const [portDraft, setPortDraft] = useState<PortDraft>({ direction: "inbound", capability: "HL7", subtype: "ADT", name: "", side: "left", secondaryIdentifier: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const allLibraryItems = useMemo(() => [...primitiveLibrary, ...compositeLibraryItems(project.nodeTemplates), ...project.customLibrary], [project.customLibrary, project.nodeTemplates]);
  const selectedNode = selection?.type === "node" ? getProjectObject(project, "node", selection.id) : undefined;
  const selectedProcess = selection?.type === "process" ? getProjectObject(project, "process", selection.id) : undefined;
  const activeProcess = getProjectObject(project, "process", activeProcessId);
  const activeRoute = useMemo(() => activeProcess ? calculateProcessRoute(project, activeProcess.checkpoints) : [], [project, activeProcess]);
  const contentBounds = useMemo(() => expandBounds(unionBounds(boundsFromNodes(project.nodes), boundsFromContainers(project.containers)), 400), [project.containers, project.nodes]);
  const renderBounds = useMemo<Bounds>(() => project.canvas.mode === "bounded"
    ? { x: 0, y: 0, width: project.canvas.width, height: project.canvas.height }
    : unionBounds(contentBounds, viewportBounds), [contentBounds, project.canvas, viewportBounds]);
  const selectionBounds = useMemo<Bounds | null>(() => {
    if (selection?.type === "container") {
      const container = getProjectObject(project, "container", selection.id);
      return container ? containerBounds(container) : null;
    }
    if (selection?.type === "node") {
      const node = getProjectObject(project, "node", selection.id);
      return node ? nodeBounds(node) : null;
    }
    if (selection?.type === "connection") {
      const connection = getProjectObject(project, "connection", selection.id);
      return connection ? boundsFromPoints(connectionRoute(project, connection)) : null;
    }
    if (selection?.type === "process") {
      const process = getProjectObject(project, "process", selection.id);
      return process ? boundsFromNodes(project.nodes.filter((node) => process.checkpoints.includes(node.id))) : null;
    }
    return null;
  }, [project, selection]);

  useEffect(() => {
    if (!selectedNode || !selectedNode.capabilities.length || selectedNode.capabilities.includes(portDraft.capability)) return;
    const capability = selectedNode.capabilities[0];
    setPortDraft((current) => ({ ...current, capability, subtype: capabilityConfig[capability].subtypes[0] }));
  }, [selectedNode, portDraft.capability]);
  const updateNode = useCallback((nodeId: string, patch: Partial<SystemNode>, coalesceKey?: string) => {
    dispatch({ type: "node.update", id: nodeId, patch }, coalesceKey);
  }, [dispatch]);
  const updateContainer = useCallback((containerId: string, patch: Partial<DiagramContainer>, coalesceKey?: string) => {
    dispatch({ type: "container.update", id: containerId, patch }, coalesceKey);
  }, [dispatch]);
  const updateConnection = useCallback((connectionId: string, patch: Partial<Connection>, coalesceKey?: string) => {
    const connection = getProjectObject(project, "connection", connectionId);
    if (connection?.routing?.busId && patch.routing?.trunkPoints) { dispatch({ type: "connection.bus.update", busId: connection.routing.busId, trunkPoints: patch.routing.trunkPoints }, coalesceKey); return; }
    dispatch({ type: "connection.update", id: connectionId, patch }, coalesceKey);
  }, [dispatch, project]);
  const updateProcess = useCallback((processId: string, patch: Partial<Process>, coalesceKey?: string) => {
    dispatch({ type: "process.update", id: processId, patch }, coalesceKey);
  }, [dispatch]);

  const showToast = (message: string) => setToast(message);
  const { saveRoute, addBendPoint, beginBendDrag, beginSegmentDrag, beginNodeDrag, beginResize, beginPortDrag, beginPortResize } = useDiagramInteractions({ project, zoom, setSelection, updateNode, updateConnection, showToast });
  const { beginContainerDrag, beginContainerResize } = useContainerInteractions({ zoom, setSelection, updateContainer });

  const addContainer = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const center = rect ? toCanvasPoint({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, rect) : { x: 480, y: 360 };
    const container: DiagramContainer = { id: createId("container"), name: "New location", description: "", kind: "logical", x: snap(center.x - 240), y: snap(center.y - 160), width: 480, height: 320, color: "#2f6df6", opacity: 0.1 };
    dispatch({ type: "container.add", container });
    setSelection({ type: "container", id: container.id });
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
    const sourceNode = getProjectObject(project, "node", connecting.nodeId);
    const sourcePort = getProjectObject(project, "port", connecting.portId);
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
    const connection: Connection = withConnectionDefaults({ id: createId("connection"), sourceNodeId: sourceNode.id, sourcePortId: sourcePort.id, targetNodeId: node.id, targetPortId: port.id,
      capability: sourcePort.capability, subtype: connectionSubtype(sourcePort, port), dataType: "Unassigned data", description: "",
    });
    dispatch({ type: "connection.add", connection });
    setConnecting(null);
    setSelection({ type: "connection", id: connection.id });
    showToast(`${connection.capability} ${connection.subtype} connection created.`);
  };

  const addNodeFromLibrary = (item: LibraryItem, x = 480, y = 360) => {
    const template = getProjectObject(project, "nodeTemplate", item.templateId);
    const nested = item.kind === "nestable", node: SystemNode = { id: createId("node"), name: nested ? "Modality group" : item.name, kind: item.kind, description: item.description, x: snap(x), y: snap(y), width: nested ? 560 : template?.defaultWidth ?? 224, height: nested ? 400 : template?.defaultHeight ?? 176, color: item.color, capabilities: [...item.capabilities], ports: [], composite: template ? cloneCompositeContent(template) : undefined };
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
      ...portDraft, width: 92, height: 34, offset: (selectedNode.ports.filter((item) => (item.side ?? (item.direction === "inbound" ? "left" : "right")) === portDraft.side).length + 1) / (selectedNode.ports.filter((item) => (item.side ?? (item.direction === "inbound" ? "left" : "right")) === portDraft.side).length + 2),
      name:
        portDraft.name.trim() ||
        `${portDraft.subtype} ${portDraft.direction === "inbound" ? "In" : "Out"}`,
    };
    updateNode(selectedNode.id, { ports: [...selectedNode.ports, port] });
    setPortDraft((current) => ({ ...current, name: "", secondaryIdentifier: "" }));
    showToast(`${port.capability} ${port.subtype} port added.`);
  };

  const removeSelected = () => {
    if (!selection) return;
    dispatch({ type: "selection.delete", selection });
    setSelection(null);
    showToast("Removed from the project.");
  };

  const duplicateNode = (node: SystemNode) => {
    const duplicate: SystemNode = {
      ...node,
      id: createId("node"),
      name: `${node.name} copy`,
      x: snap(node.x + 32),
      y: snap(node.y + 32),
      ports: node.ports.map((port) => ({ ...port, id: createId("port") })),
      composite: node.composite ? {
        ...node.composite,
        sections: node.composite.sections.map((section) => ({
          ...section,
          fields: section.fields.map((field) => ({ ...field, id: createId("field") })),
          endpoints: section.endpoints.map((endpoint) => ({ ...endpoint, id: createId("endpoint") })),
        })),
      } : undefined,
    };
    dispatch({ type: "node.add", node: duplicate });
    setSelection({ type: "node", id: duplicate.id });
    showToast(`${duplicate.name} created.`);
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
        <nav className="workspace-navigation" aria-label="Project views">
          <button className={activeView === "diagram" ? "active" : ""} aria-current={activeView === "diagram" ? "page" : undefined} onClick={() => setActiveView("diagram")}>Diagram</button>
          <button className={activeView === "library" ? "active" : ""} aria-current={activeView === "library" ? "page" : undefined} onClick={() => setActiveView("library")}>Object library</button>
        </nav>
        {activeView === "diagram" && <label className="presentation-toggle"><span>Clean</span><Switch checked={project.presentation === "detailed"} onCheckedChange={(checked) => dispatch({ type: "presentation.update", presentation: checked ? "detailed" : "clean" })} aria-label="Toggle detailed object view" /><span>Detailed</span></label>}
        <div className="topbar-actions">
          <button className="button ghost" onClick={() => fileInputRef.current?.click()}>Open JSON</button>
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={(event) => event.target.files?.[0] && importProject(event.target.files[0])} />
          <button className="button ghost" onClick={() => setExportOpen(true)}>Export</button>
          <button className="button primary" onClick={() => showToast("All changes are saved in this browser.")}><span className="status-dot" /> Saved</button>
        </div>
      </header>

      {activeView === "diagram" ? <div className="workspace">
        <aside className="library-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">Build</span><h2>Object library</h2></div>
            <button className="icon-button" onClick={() => setActiveView("library")} aria-label="Manage object library">⚙</button>
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
          <button className="manage-library" onClick={() => setActiveView("library")}>＋ Create custom object</button>
          <div className="tip-card"><span>TIP</span><p>Drag an object onto the canvas, then define its capabilities and ports in Properties.</p></div>
        </aside>

        <section className="canvas-column">
          <CanvasToolbar canvas={project.canvas} zoom={zoom} connecting={Boolean(connecting)} containerEditing={containerEditing} canUndo={canUndo} canRedo={canRedo} canFitSelection={Boolean(selectionBounds)} onSelect={() => { setContainerEditing(false); if (selection?.type === "container") setSelection(null); }} onPan={() => setConnecting(null)} onConnect={() => { setConnecting(null); showToast("Click an outbound port, then a compatible inbound port."); }} onAddProcess={addProcess} onToggleContainers={() => { setContainerEditing((value) => !value); setConnecting(null); setSelection(null); }} onAddContainer={addContainer} onUndo={undo} onRedo={redo} onUpdateCanvas={(patch) => dispatch({ type: "canvas.update", patch })} onZoomOut={zoomOut} onZoomIn={zoomIn} onFitDocument={fitDocument} onFitSelection={() => selectionBounds && fitBounds(selectionBounds)} onResetView={resetView} />

          <div
            className={`canvas-viewport ${connecting ? "is-connecting" : ""} ${containerEditing ? "container-editing" : ""} ${modifierKeys.ctrl ? "ctrl-modifier" : ""} ${modifierKeys.shift ? "shift-modifier" : ""} ${zoom < 0.6 ? "grid-hide-minor" : ""}`}
            ref={canvasRef}
            onPointerDown={beginPan}
            onWheel={handleWheel}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleCanvasDrop} style={gridBackgroundStyle(pan, zoom)}
          >
            <div className={`diagram-surface ${project.canvas.mode}`} style={{ width: Math.max(project.canvas.width, renderBounds.x + renderBounds.width), height: Math.max(project.canvas.height, renderBounds.y + renderBounds.height), transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
              <ContainerLayer containers={project.containers} selection={selection} editing={containerEditing} viewportBounds={viewportBounds} onSelect={(containerId) => setSelection({ type: "container", id: containerId })} onBeginDrag={beginContainerDrag} onBeginResize={beginContainerResize} />
              <ConnectionLayer
                project={project}
                selection={selection}
                activeRoute={activeRoute}
                activeProcess={activeProcess}
                isAnimating={isAnimating}
                canvasRef={canvasRef}
                pan={pan}
                zoom={zoom}
                renderBounds={renderBounds}
                viewportBounds={viewportBounds}
                onSelect={(connectionId) => setSelection({ type: "connection", id: connectionId })}
                onAddBend={addBendPoint}
                onBeginBendDrag={beginBendDrag}
                onBeginSegmentDrag={beginSegmentDrag}
                onRemoveBend={(connection, pointIndex, routePoints) => {
                  const remaining = routePoints.slice(1, -1).filter((_, index) => index !== pointIndex);
                  saveRoute(connection, orthogonalRoutePoints(routePoints[0], routePoints.at(-1)!, remaining));
                  showToast(`Bend point ${pointIndex + 1} removed.`);
                }}
                onUpdateConnection={updateConnection} />
              <SystemNodeLayer project={project} selection={selection} connecting={connecting} activeRoute={activeRoute} activeProcess={activeProcess} viewportBounds={viewportBounds} onBeginNodeDrag={beginNodeDrag} onBeginResize={beginResize} onPortClick={handlePortClick} onBeginPortDrag={beginPortDrag} onBeginPortResize={beginPortResize} />
            </div>

            <div className="minimap">
              <div className="minimap-label">MAP</div>
              {project.nodes.map((node) => <i key={node.id} style={{ left: `${Math.min(88, node.x / 18)}%`, top: `${Math.min(78, node.y / 12)}%`, background: node.color }} />)}
              <div className="minimap-window" />
            </div>
            <div className="canvas-hint">{containerEditing ? "Container mode · Drag or resize locations · " : "Scroll to pan · Ctrl+scroll to zoom at cursor · "}{project.canvas.mode === "infinite" ? "Infinite canvas" : `${project.canvas.width} × ${project.canvas.height}`} · Snap {GRID}px</div>
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
                      {activeProcess.checkpoints.map((nodeId, index) => <span key={`${nodeId}-${index}`}>{getProjectObject(project, "node", nodeId)?.name ?? "Missing point"}{index < activeProcess.checkpoints.length - 1 && <i>→</i>}</span>)}
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
          onDuplicateNode={duplicateNode}
          onAddCheckpoint={addCheckpoint}
          onActivateProcess={(processId) => { setActiveProcessId(processId); setIsAnimating(true); }}
          onUpdateNode={updateNode}
          onUpdateContainer={updateContainer}
          onUpdateConnection={updateConnection}
          onUpdateProcess={updateProcess}
        />
      </div> : <ObjectLibraryView items={allLibraryItems} customItems={project.customLibrary} newTemplateName={newTemplateName} newTemplateKind={newTemplateKind} libraryInputRef={libraryInputRef} onTemplateNameChange={setNewTemplateName} onTemplateKindChange={setNewTemplateKind} onCreateTemplate={createTemplate} onRemoveTemplate={(id) => dispatch({ type: "library.remove", id })} onExportLibrary={() => downloadJson(project.customLibrary, "careflow-object-library.json")} onImportLibrary={importLibrary} onReturnToDiagram={() => setActiveView("diagram")} />}

      {toast && <div className="toast"><span>i</span>{toast}<button onClick={() => setToast(null)}>×</button></div>}

      {newProjectOpen && (
        <div className="modal-backdrop" onPointerDown={(event) => event.target === event.currentTarget && setNewProjectOpen(false)}>
          <div className="modal project-modal"><div className="modal-header"><div><span className="eyebrow">Project workflow</span><h2>Create or open a project</h2><p>Projects are saved locally and can be moved as JSON files.</p></div><button onClick={() => setNewProjectOpen(false)}>×</button></div><div className="project-modal-body"><div className="new-project-form"><label>Project name<input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} /></label><label>Project description<textarea rows={4} placeholder="What systems and workflows will this diagram describe?" value={newProjectDescription} onChange={(event) => setNewProjectDescription(event.target.value)} /></label><button className="button primary full" onClick={() => { setProject(blankProject(newProjectName.trim() || "Untitled project", newProjectDescription)); setSelection(null); setActiveProcessId(null); setNewProjectOpen(false); }}>Create empty project</button></div><div className="project-options"><button onClick={() => { setProject(createDemoProject()); setSelection({ type: "node", id: "app-1" }); setActiveProcessId("proc-order"); setNewProjectOpen(false); }}><span>✦</span><div><strong>Load PACS example</strong><small>Explore a complete order and image workflow.</small></div></button><button onClick={() => fileInputRef.current?.click()}><span>↥</span><div><strong>Open JSON project</strong><small>Continue work from an exported file.</small></div></button><div className="workflow-steps">{["Describe project", "Choose objects", "Build diagram", "Connect ports", "Animate processes"].map((step, index) => <div key={step}><b>{index + 1}</b><span>{step}</span></div>)}</div></div></div></div>
        </div>
      )}
      {exportOpen && <ExportDialog project={project} onClose={() => setExportOpen(false)} onToast={showToast} />}
    </main>
  );
}
