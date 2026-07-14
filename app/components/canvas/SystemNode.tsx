import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { capabilityConfig, icons, primitiveLibrary } from "../../model/catalog";
import type { DataFlowProcess, Port, Project, SystemNode as SystemNodeModel } from "../../model/types";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "../ui/popover";
import { MdMoreHoriz } from "react-icons/md";

export type SystemNodeProps = {
  project: Project;
  node: SystemNodeModel;
  selected: boolean;
  inActiveProcess: boolean;
  connecting: { nodeId: string; portId: string } | null;
  activeProcess?: DataFlowProcess;
  onBeginNodeDrag: (event: ReactPointerEvent, node: SystemNodeModel) => void;
  onBeginResize: (event: ReactPointerEvent, node: SystemNodeModel) => void;
  onPortClick: (node: SystemNodeModel, port: Port) => void;
  onBeginPortDrag: (event: ReactPointerEvent<HTMLElement>, node: SystemNodeModel, port: Port) => void;
  onBeginPortResize: (event: ReactPointerEvent<HTMLElement>, node: SystemNodeModel, port: Port) => void;
};

export function SystemNode({ project, node, selected, inActiveProcess, connecting, activeProcess, onBeginNodeDrag, onBeginResize, onPortClick, onBeginPortDrag, onBeginPortResize }: SystemNodeProps) {
  return (
    <article
      className={`system-node ${node.kind === "nestable" ? "nested-node" : ""} ${node.nestedParentId ? "nested-child" : ""} ${project.presentation === "clean" ? "clean-view" : "detailed-view"} ${selected ? "selected" : ""} ${inActiveProcess ? "process-node" : ""}`}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height, "--node-accent": node.color, "--process-accent": activeProcess?.color ?? node.color } as CSSProperties}
      onPointerDown={(event) => onBeginNodeDrag(event, node)}
    >
      <div className="node-topline" />
      {node.kind === "nestable"
        ? <div className="nested-node-header"><span>Nested group</span><strong>{node.name}</strong><small>{project.nodes.filter((item) => item.nestedParentId === node.id).length} contained systems · shared external ports</small></div>
        : project.presentation === "clean"
          ? <div className="clean-node-body">
            <strong>{node.name}</strong>
            <Popover>
              <PopoverTrigger>
                <button className="rounded-md cursor:default hover:text-foreground hover:bg-gray-200 ">
                  <MdMoreHoriz size="24px" />
                </button>
              </PopoverTrigger>
              <PopoverContent>
                <PopoverHeader>
                  <PopoverTitle>{node.name}</PopoverTitle>
                </PopoverHeader>
                <div className="popover-details">
                  <div className="capability-row">{node.capabilities.map((capability) => <span key={capability} style={{ "--cap": capabilityConfig[capability].color } as CSSProperties}>{capability}</span>)}</div>
                  {node.composite && <div className="popover-composite-body">
                      {node.composite.sections.map((section) => <section className={`composite-section ${section.kind}`} key={section.id}>
                        <h4>{section.title}</h4>
                        {section.kind === "fields" && <dl>{section.fields.map((field) => <div key={field.id}><dt>{field.label}</dt><dd>{field.value || "—"}</dd></div>)}</dl>}
                        {section.kind === "endpoints" && <div className="composite-endpoints">{section.endpoints.map((endpoint) => <div key={endpoint.id}><strong>{endpoint.name}</strong><span>{endpoint.address}</span><small>{endpoint.details}</small></div>)}</div>}
                      </section>)}
                      {node.composite.footer && <footer>{node.composite.footer}</footer>}
                    </div>}
                </div>
            </PopoverContent>
          </Popover>
            </div>
          : <>
    <div className={`node-header ${node.composite ? "composite-header" : ""}`}>
      <div className="node-icon">{node.composite?.logoText || icons[node.kind]}</div>
      <div><strong>{node.name}</strong><span>{node.composite?.headerLabel || primitiveLibrary.find((item) => item.kind === node.kind)?.name || "System"}</span></div>
     
    
  
    </div>
    <div className="capability-row">{node.capabilities.map((capability) => <span key={capability} style={{ "--cap": capabilityConfig[capability].color } as CSSProperties}>{capability}</span>)}</div>
    {node.composite && <div className="composite-body">
      {node.composite.sections.map((section) => <section className={`composite-section ${section.kind}`} key={section.id}>
        <h4>{section.title}</h4>
        {section.kind === "fields" && <dl>{section.fields.map((field) => <div key={field.id}><dt>{field.label}</dt><dd>{field.value || "—"}</dd></div>)}</dl>}
        {section.kind === "endpoints" && <div className="composite-endpoints">{section.endpoints.map((endpoint) => <div key={endpoint.id}><strong>{endpoint.name}</strong><span>{endpoint.address}</span><small>{endpoint.details}</small></div>)}</div>}
      </section>)}
      {node.composite.footer && <footer>{node.composite.footer}</footer>}
    </div>}</>
}
{
  node.ports.filter((port) => !node.nestedParentId || project.connections.some((connection) => connection.sourcePortId === port.id || connection.targetPortId === port.id)).map((port) => {
    const side = port.side ?? (port.direction === "inbound" ? "left" : "right");
    const sameSide = node.ports.filter((item) => (item.side ?? (item.direction === "inbound" ? "left" : "right")) === side);
    const index = sameSide.findIndex((item) => item.id === port.id);
    const position = `${(port.offset ?? (index + 1) / (sameSide.length + 1)) * 100}%`;
    const style: CSSProperties & { "--port-color": string } = { "--port-color": capabilityConfig[port.capability].color, width: port.width ?? 92, height: port.height ?? 34, ...(side === "left" || side === "right" ? { top: position } : { left: position }) };
    return <button key={port.id} className={`port node-port side-${side} ${connecting ? "target-ready" : ""} ${connecting?.portId === port.id ? "source-active" : ""}`} style={style} onPointerDown={(event) => { if (!selected) event.currentTarget.dataset.selectOnly = "true"; onBeginPortDrag(event, node, port); }} onClick={(event) => { if (event.currentTarget.dataset.selectOnly) { delete event.currentTarget.dataset.selectOnly; return; } if (!event.currentTarget.dataset.suppressClick) onPortClick(node, port); }} title={`${port.capability} ${port.subtype}`}><span className="port-copy"><strong>{port.name}</strong>{port.secondaryIdentifier && <small>{port.secondaryIdentifier}</small>}</span><i />{selected && <span className="port-resize-handle" onPointerDown={(event) => onBeginPortResize(event, node, port)} />}</button>;
  })
}
{ selected && <button className="resize-handle" onPointerDown={(event) => onBeginResize(event, node)} aria-label={`Resize ${node.name}`} /> }
    </article >
  );
}
