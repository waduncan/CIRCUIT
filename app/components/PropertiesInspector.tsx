import type { CSSProperties, Dispatch, SetStateAction } from "react";
import { capabilityConfig, icons, primitiveLibrary } from "../model/catalog";
import type { Capability, Connection, DataFlowProcess, DiagramContainer, Direction, PortDraft, PrimitiveKind, Project, Selection, SystemNode } from "../model/types";

type PropertiesInspectorProps = {
  project: Project;
  selection: Selection;
  portDraft: PortDraft;
  setPortDraft: Dispatch<SetStateAction<PortDraft>>;
  onDelete: () => void;
  onAddPort: () => void;
  onAddCheckpoint: (nodeId: string) => void;
  onActivateProcess: (processId: string) => void;
  onUpdateNode: (id: string, patch: Partial<SystemNode>, coalesceKey?: string) => void;
  onUpdateContainer: (id: string, patch: Partial<DiagramContainer>, coalesceKey?: string) => void;
  onUpdateConnection: (id: string, patch: Partial<Connection>, coalesceKey?: string) => void;
  onUpdateProcess: (id: string, patch: Partial<DataFlowProcess>, coalesceKey?: string) => void;
};

export function PropertiesInspector({
  project,
  selection,
  portDraft,
  setPortDraft,
  onDelete,
  onAddPort,
  onAddCheckpoint,
  onActivateProcess,
  onUpdateNode,
  onUpdateContainer,
  onUpdateConnection,
  onUpdateProcess,
}: PropertiesInspectorProps) {
  const selectedContainer = selection?.type === "container" ? project.containers.find((container) => container.id === selection.id) : undefined;
  const selectedNode = selection?.type === "node" ? project.nodes.find((node) => node.id === selection.id) : undefined;
  const selectedConnection = selection?.type === "connection" ? project.connections.find((connection) => connection.id === selection.id) : undefined;
  const selectedProcess = selection?.type === "process" ? project.processes.find((process) => process.id === selection.id) : undefined;

  return (
    <aside className="properties-panel">
      <div className="properties-heading"><div><span className="eyebrow">Inspect</span><h2>Properties</h2></div>{selection && <button className="delete-button" onClick={onDelete}>Delete</button>}</div>
      {!selection && <div className="properties-empty"><div>◇</div><h3>Nothing selected</h3><p>Select a system, container, connection, or process to inspect and edit its properties.</p></div>}

      {selectedContainer && (
        <div className="property-content">
          <div className="selection-summary"><div className="large-object-icon container-icon" style={{ background: selectedContainer.color }}>▣</div><div><span>{selectedContainer.kind.toUpperCase()} CONTAINER</span><strong>{selectedContainer.name}</strong><small>{selectedContainer.id}</small></div></div>
          <section className="property-section"><h3>Location</h3><label>Name<input value={selectedContainer.name} onChange={(event) => onUpdateContainer(selectedContainer.id, { name: event.target.value }, `container-name:${selectedContainer.id}`)} /></label><label>Description<textarea rows={3} value={selectedContainer.description} onChange={(event) => onUpdateContainer(selectedContainer.id, { description: event.target.value }, `container-desc:${selectedContainer.id}`)} /></label><div className="field-row"><label>Type<select value={selectedContainer.kind} onChange={(event) => onUpdateContainer(selectedContainer.id, { kind: event.target.value as DiagramContainer["kind"] })}><option value="logical">Logical</option><option value="physical">Physical</option></select></label><label>Color<input className="color-field" type="color" value={selectedContainer.color} onChange={(event) => onUpdateContainer(selectedContainer.id, { color: event.target.value }, `container-color:${selectedContainer.id}`)} /></label></div><label>Fill opacity <span className="value-label">{Math.round(selectedContainer.opacity * 100)}%</span><input type="range" min="0.04" max="0.35" step="0.01" value={selectedContainer.opacity} onChange={(event) => onUpdateContainer(selectedContainer.id, { opacity: Number(event.target.value) }, `container-opacity:${selectedContainer.id}`)} /></label></section>
          <section className="property-section"><h3>Geometry</h3><div className="field-row"><label>X<input type="number" value={selectedContainer.x} onChange={(event) => onUpdateContainer(selectedContainer.id, { x: Number(event.target.value) }, `container-x:${selectedContainer.id}`)} /></label><label>Y<input type="number" value={selectedContainer.y} onChange={(event) => onUpdateContainer(selectedContainer.id, { y: Number(event.target.value) }, `container-y:${selectedContainer.id}`)} /></label></div><div className="field-row"><label>Width<input type="number" min="240" value={selectedContainer.width} onChange={(event) => onUpdateContainer(selectedContainer.id, { width: Math.max(240, Number(event.target.value)) }, `container-width:${selectedContainer.id}`)} /></label><label>Height<input type="number" min="160" value={selectedContainer.height} onChange={(event) => onUpdateContainer(selectedContainer.id, { height: Math.max(160, Number(event.target.value)) }, `container-height:${selectedContainer.id}`)} /></label></div></section>
          <section className="property-section"><h3>Contained systems <span>{project.nodes.filter((node) => node.containerId === selectedContainer.id).length}</span></h3><p className="helper-copy">Membership updates automatically when a system is moved fully inside or outside this container.</p>{project.nodes.filter((node) => node.containerId === selectedContainer.id).map((node) => <div className="container-member" key={node.id}><i style={{ background: node.color }} /><span>{node.name}</span></div>)}</section>
        </div>
      )}

      {selectedNode && (
        <div className="property-content">
          <div className="selection-summary"><div className="large-object-icon" style={{ background: selectedNode.color }}>{icons[selectedNode.kind]}</div><div><span>SYSTEM OBJECT</span><strong>{selectedNode.name}</strong><small>{selectedNode.id}</small></div></div>
          <section className="property-section"><h3>General</h3><label>Name<input value={selectedNode.name} onChange={(event) => onUpdateNode(selectedNode.id, { name: event.target.value }, `node-name:${selectedNode.id}`)} /></label><label>Description<textarea rows={3} value={selectedNode.description} onChange={(event) => onUpdateNode(selectedNode.id, { description: event.target.value }, `node-desc:${selectedNode.id}`)} /></label><div className="field-row"><label>Color<input className="color-field" type="color" value={selectedNode.color} onChange={(event) => onUpdateNode(selectedNode.id, { color: event.target.value }, `node-color:${selectedNode.id}`)} /></label><label>Object type<select value={selectedNode.kind} onChange={(event) => onUpdateNode(selectedNode.id, { kind: event.target.value as PrimitiveKind })}>{primitiveLibrary.map((item) => <option key={item.kind} value={item.kind}>{item.name}</option>)}</select></label></div><label>Container<select value={selectedNode.containerId ?? ""} onChange={(event) => onUpdateNode(selectedNode.id, { containerId: event.target.value || undefined })}><option value="">No container</option>{project.containers.map((container) => <option key={container.id} value={container.id}>{container.name}</option>)}</select></label></section>
          <section className="property-section"><h3>Capabilities <span>{selectedNode.capabilities.length}</span></h3><div className="capability-picker">{(Object.keys(capabilityConfig) as Capability[]).map((capability) => { const enabled = selectedNode.capabilities.includes(capability); return <button key={capability} className={enabled ? "enabled" : ""} style={{ "--cap": capabilityConfig[capability].color } as CSSProperties} onClick={() => onUpdateNode(selectedNode.id, { capabilities: enabled ? selectedNode.capabilities.filter((item) => item !== capability) : [...selectedNode.capabilities, capability] })}><i />{capability}<b>{enabled ? "✓" : "+"}</b></button>; })}</div></section>
          <section className="property-section ports-section"><h3>Ports <span>{selectedNode.ports.length}</span></h3>{selectedNode.ports.map((port) => <div className="port-property" key={port.id}><i style={{ background: capabilityConfig[port.capability].color }} /><div><strong>{port.name}</strong><span>{port.direction} · {port.capability} {port.subtype}</span></div><button onClick={() => onUpdateNode(selectedNode.id, { ports: selectedNode.ports.filter((item) => item.id !== port.id) })}>×</button></div>)}
            <div className="add-port-box"><div className="field-row"><label>Direction<select value={portDraft.direction} onChange={(event) => setPortDraft((current) => ({ ...current, direction: event.target.value as Direction }))}><option value="inbound">Inbound</option><option value="outbound">Outbound</option></select></label><label>Protocol<select value={portDraft.capability} onChange={(event) => { const capability = event.target.value as Capability; setPortDraft((current) => ({ ...current, capability, subtype: capabilityConfig[capability].subtypes[0] })); }}>{selectedNode.capabilities.map((capability) => <option key={capability}>{capability}</option>)}</select></label></div><label>Subtype<select value={portDraft.subtype} onChange={(event) => setPortDraft((current) => ({ ...current, subtype: event.target.value }))}>{capabilityConfig[portDraft.capability].subtypes.map((subtype) => <option key={subtype}>{subtype}</option>)}</select></label><label>Port label<input placeholder="Optional friendly name" value={portDraft.name} onChange={(event) => setPortDraft((current) => ({ ...current, name: event.target.value }))} /></label><button className="button secondary full" onClick={onAddPort}>＋ Add connection point</button></div>
          </section>
        </div>
      )}

      {selectedConnection && (
        <div className="property-content">
          <div className="selection-summary"><div className="large-object-icon connection-icon">↗</div><div><span>CONNECTION</span><strong>{selectedConnection.capability} · {selectedConnection.subtype}</strong><small>{selectedConnection.id}</small></div></div>
          <section className="property-section"><h3>Semantic definition</h3><div className="semantic-lock"><i style={{ background: capabilityConfig[selectedConnection.capability].color }} /><div><span>Protocol & subtype</span><strong>{selectedConnection.capability} / {selectedConnection.subtype}</strong></div><b>Locked by ports</b></div><label>Data being carried<input value={selectedConnection.dataType} onChange={(event) => onUpdateConnection(selectedConnection.id, { dataType: event.target.value }, `conn-data:${selectedConnection.id}`)} /></label><label>Operational description<textarea rows={4} value={selectedConnection.description} onChange={(event) => onUpdateConnection(selectedConnection.id, { description: event.target.value }, `conn-desc:${selectedConnection.id}`)} /></label></section>
          <section className="property-section"><h3>Endpoints</h3><div className="endpoint"><span>FROM</span><strong>{project.nodes.find((node) => node.id === selectedConnection.sourceNodeId)?.name}</strong><small>{project.nodes.find((node) => node.id === selectedConnection.sourceNodeId)?.ports.find((port) => port.id === selectedConnection.sourcePortId)?.name}</small></div><div className="endpoint"><span>TO</span><strong>{project.nodes.find((node) => node.id === selectedConnection.targetNodeId)?.name}</strong><small>{project.nodes.find((node) => node.id === selectedConnection.targetNodeId)?.ports.find((port) => port.id === selectedConnection.targetPortId)?.name}</small></div></section>
          <section className="property-section route-section">
            <h3>Route points <span>{selectedConnection.bendPoints?.length ?? 0}</span></h3>
            <p className="helper-copy">Every 90° corner has a handle, including automatic routes. Drag a handle to reshape the corner or drag between handles to move a whole segment. Ctrl+click adds a point; Ctrl+right-click removes one.</p>
            {(selectedConnection.bendPoints ?? []).map((point, pointIndex) => <div className="route-point" key={`${selectedConnection.id}-property-${pointIndex}`}><b>{pointIndex + 1}</b><span>X {point.x} · Y {point.y}</span><button aria-label={`Remove bend point ${pointIndex + 1}`} onClick={() => onUpdateConnection(selectedConnection.id, { bendPoints: selectedConnection.bendPoints?.filter((_, index) => index !== pointIndex) })}>×</button></div>)}
            <div className="route-actions"><button className="button ghost" disabled={!selectedConnection.bendPoints?.length} onClick={() => onUpdateConnection(selectedConnection.id, { bendPoints: [] })}>Reset</button></div>
          </section>
        </div>
      )}

      {selectedProcess && (
        <div className="property-content">
          <div className="selection-summary"><div className="large-object-icon process-icon">◎</div><div><span>DATA FLOW PROCESS</span><strong>{selectedProcess.name}</strong><small>{selectedProcess.id}</small></div></div>
          <section className="property-section"><h3>Operational definition</h3><label>Process name<input value={selectedProcess.name} onChange={(event) => onUpdateProcess(selectedProcess.id, { name: event.target.value }, `proc-name:${selectedProcess.id}`)} /></label><label>Description<textarea rows={4} value={selectedProcess.description} onChange={(event) => onUpdateProcess(selectedProcess.id, { description: event.target.value }, `proc-desc:${selectedProcess.id}`)} /></label><label>Flow color<input className="color-field" type="color" value={selectedProcess.color} onChange={(event) => onUpdateProcess(selectedProcess.id, { color: event.target.value }, `proc-color:${selectedProcess.id}`)} /></label></section>
          <section className="property-section"><h3>Process points <span>{selectedProcess.checkpoints.length}</span></h3><p className="helper-copy">The route is calculated across existing directed connections between each point.</p>{selectedProcess.checkpoints.map((nodeId, index) => <div className="checkpoint" key={`${nodeId}-${index}`}><b>{index + 1}</b><div><strong>{project.nodes.find((node) => node.id === nodeId)?.name ?? "Missing system"}</strong><span>{index === 0 ? "Start" : index === selectedProcess.checkpoints.length - 1 ? "Finish" : "Checkpoint"}</span></div><button onClick={() => onUpdateProcess(selectedProcess.id, { checkpoints: selectedProcess.checkpoints.filter((_, itemIndex) => itemIndex !== index) })}>×</button></div>)}<label>Add point<select defaultValue="" onChange={(event) => { onAddCheckpoint(event.target.value); event.target.value = ""; }}><option value="" disabled>Choose a system…</option>{project.nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select></label><button className="button secondary full" onClick={() => onActivateProcess(selectedProcess.id)}>▶ Calculate & animate route</button></section>
        </div>
      )}
    </aside>
  );
}
