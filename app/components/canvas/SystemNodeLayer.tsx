import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { capabilityConfig, icons, primitiveLibrary } from "../../model/catalog";
import type { DataFlowProcess, Port, Project, Selection, SystemNode } from "../../model/types";

type SystemNodeLayerProps = {
  project: Project;
  selection: Selection;
  connecting: { nodeId: string; portId: string } | null;
  activeRoute: string[];
  activeProcess?: DataFlowProcess;
  onBeginNodeDrag: (event: ReactPointerEvent, node: SystemNode) => void;
  onBeginResize: (event: ReactPointerEvent, node: SystemNode) => void;
  onPortClick: (node: SystemNode, port: Port) => void;
};

export function SystemNodeLayer({ project, selection, connecting, activeRoute, activeProcess, onBeginNodeDrag, onBeginResize, onPortClick }: SystemNodeLayerProps) {
  return (
    <>
      {project.nodes.map((node) => {
        const inbound = node.ports.filter((port) => port.direction === "inbound");
        const outbound = node.ports.filter((port) => port.direction === "outbound");
        const selected = selection?.type === "node" && selection.id === node.id;
        const inActiveProcess = Boolean(activeProcess?.checkpoints.includes(node.id) || activeRoute.some((edgeId) => {
          const edge = project.connections.find((item) => item.id === edgeId);
          return edge?.sourceNodeId === node.id || edge?.targetNodeId === node.id;
        }));
        return (
          <article
            key={node.id}
            className={`system-node ${selected ? "selected" : ""} ${inActiveProcess ? "process-node" : ""}`}
            style={{ left: node.x, top: node.y, width: node.width, height: node.height, "--node-accent": node.color, "--process-accent": activeProcess?.color ?? node.color } as CSSProperties}
            onPointerDown={(event) => onBeginNodeDrag(event, node)}
          >
            <div className="node-topline" />
            <div className="node-header">
              <div className="node-icon">{icons[node.kind]}</div>
              <div><strong>{node.name}</strong><span>{primitiveLibrary.find((item) => item.kind === node.kind)?.name ?? "System"}</span></div>
              <button aria-label={`More options for ${node.name}`}>•••</button>
            </div>
            <div className="capability-row">{node.capabilities.map((capability) => <span key={capability} style={{ "--cap": capabilityConfig[capability].color } as CSSProperties}>{capability}</span>)}</div>
            <div className="port-column inbound">{inbound.map((port) => <button key={port.id} className={`port ${connecting ? "target-ready" : ""}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => onPortClick(node, port)} title={`${port.capability} ${port.subtype}`}><i style={{ "--port-color": capabilityConfig[port.capability].color } as CSSProperties} /><span>{port.name}</span></button>)}</div>
            <div className="port-column outbound">{outbound.map((port) => <button key={port.id} className={`port ${connecting?.portId === port.id ? "source-active" : ""}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => onPortClick(node, port)} title={`${port.capability} ${port.subtype}`}><span>{port.name}</span><i style={{ "--port-color": capabilityConfig[port.capability].color } as CSSProperties} /></button>)}</div>
            {selected && <button className="resize-handle" onPointerDown={(event) => onBeginResize(event, node)} aria-label={`Resize ${node.name}`} />}
          </article>
        );
      })}
      {!project.nodes.length && <div className="empty-canvas"><div>＋</div><h2>Build your connectivity map</h2><p>Drag a healthcare primitive from the object library to begin.</p></div>}
    </>
  );
}
