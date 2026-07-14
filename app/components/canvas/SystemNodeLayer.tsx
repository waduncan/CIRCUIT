import type { PointerEvent as ReactPointerEvent } from "react";
import { intersectsBounds, nodeBounds } from "../../model/viewport";
import { getProjectObject } from "../../model/projectObject";
import type { Bounds, DataFlowProcess, Port, Project, Selection, SystemNode } from "../../model/types";
import { SystemNode as SystemNodeRenderer } from "./SystemNode";

type SystemNodeLayerProps = {
  project: Project;
  selection: Selection;
  connecting: { nodeId: string; portId: string } | null;
  activeRoute: string[];
  activeProcess?: DataFlowProcess;
  viewportBounds: Bounds;
  onBeginNodeDrag: (event: ReactPointerEvent, node: SystemNode) => void;
  onBeginResize: (event: ReactPointerEvent, node: SystemNode) => void;
  onPortClick: (node: SystemNode, port: Port) => void;
  onBeginPortDrag: (event: ReactPointerEvent<HTMLElement>, node: SystemNode, port: Port) => void;
  onBeginPortResize: (event: ReactPointerEvent<HTMLElement>, node: SystemNode, port: Port) => void;
};

export function SystemNodeLayer({ project, selection, connecting, activeRoute, activeProcess, viewportBounds, onBeginNodeDrag, onBeginResize, onPortClick, onBeginPortDrag, onBeginPortResize }: SystemNodeLayerProps) {
  return (
    <>
      {[...project.nodes].sort((a, b) => (a.kind === "nestable" ? -1 : 0) - (b.kind === "nestable" ? -1 : 0)).map((node) => {
        const selected = selection?.type === "node" && selection.id === node.id;
        const inActiveProcess = Boolean(activeProcess?.checkpoints.includes(node.id) || activeRoute.some((edgeId) => {
          const edge = getProjectObject(project, "connection", edgeId);
          return edge?.sourceNodeId === node.id || edge?.targetNodeId === node.id;
        }));
        if (!selected && !inActiveProcess && !intersectsBounds(nodeBounds(node), viewportBounds)) return null;
        return <SystemNodeRenderer key={node.id} project={project} node={node} selected={selected} inActiveProcess={inActiveProcess} connecting={connecting} activeProcess={activeProcess} onBeginNodeDrag={onBeginNodeDrag} onBeginResize={onBeginResize} onPortClick={onPortClick} onBeginPortDrag={onBeginPortDrag} onBeginPortResize={onBeginPortResize} />;
      })}
      {!project.nodes.length && <div className="empty-canvas"><div>＋</div><h2>Build your connectivity map</h2><p>Drag a healthcare primitive from the object library to begin.</p></div>}
    </>
  );
}
