import { useCallback, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from "react";
import { createId, snap } from "../model/project";
import { compactPoints, orthogonalRoutePoints, portPosition, portTilePosition } from "../model/routing";
import type { Connection, Point, Port, PortSide, Project, Selection, SystemNode } from "../model/types";

type DiagramInteractionOptions = {
  project: Project;
  zoom: number;
  setSelection: Dispatch<SetStateAction<Selection>>;
  updateNode: (id: string, patch: Partial<SystemNode>, coalesceKey?: string) => void;
  updateConnection: (id: string, patch: Partial<Connection>, coalesceKey?: string) => void;
  showToast: (message: string) => void;
};

export function useDiagramInteractions({ project, zoom, setSelection, updateNode, updateConnection, showToast }: DiagramInteractionOptions) {
  const getPortPosition = useCallback((nodeId: string, portId: string) => portPosition(project, nodeId, portId), [project.nodes]);

  const saveRoute = useCallback((connection: Connection, routePoints: Point[], coalesceKey?: string) => {
    updateConnection(connection.id, { bendPoints: compactPoints(routePoints).slice(1, -1) }, coalesceKey);
  }, [updateConnection]);

  const addBendPoint = useCallback((connection: Connection, point: Point) => {
    const source = getPortPosition(connection.sourceNodeId, connection.sourcePortId);
    const target = getPortPosition(connection.targetNodeId, connection.targetPortId);
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
  }, [getPortPosition, saveRoute]);

  const beginBendDrag = (event: ReactPointerEvent<SVGCircleElement>, connection: Connection, pointIndex: number) => {
    event.stopPropagation();
    if (event.button === 2) return;
    event.preventDefault();
    setSelection({ type: "connection", id: connection.id });
    const source = getPortPosition(connection.sourceNodeId, connection.sourcePortId);
    const target = getPortPosition(connection.targetNodeId, connection.targetPortId);
    const bendPoints = orthogonalRoutePoints(source, target, connection.bendPoints).slice(1, -1);
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
    const gestureKey = createId("bend-drag");
    const move = (moveEvent: PointerEvent) => {
      const movedBends = [...bendPoints];
      movedBends[pointIndex] = {
        x: snap(point.x + (moveEvent.clientX - startX) / zoom),
        y: snap(point.y + (moveEvent.clientY - startY) / zoom),
      };
      saveRoute(connection, orthogonalRoutePoints(source, target, movedBends), gestureKey);
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
    const gestureKey = createId("segment-drag");
    const move = (moveEvent: PointerEvent) => {
      const nextRoute = route.map((point) => ({ ...point }));
      const delta = horizontal ? snap((moveEvent.clientY - startClientY) / zoom) : snap((moveEvent.clientX - startClientX) / zoom);
      if (horizontal) {
        const y = start.y + delta;
        if (route.length === 2) nextRoute.splice(1, 0, { x: start.x, y }, { x: end.x, y });
        else if (segmentIndex === 0) nextRoute.splice(1, 1, { x: start.x, y }, { x: end.x, y });
        else if (segmentIndex === route.length - 2) { nextRoute[segmentIndex].y = y; nextRoute.splice(nextRoute.length - 1, 0, { x: end.x, y }); }
        else { nextRoute[segmentIndex].y = y; nextRoute[segmentIndex + 1].y = y; }
      } else {
        const x = start.x + delta;
        if (route.length === 2) nextRoute.splice(1, 0, { x, y: start.y }, { x, y: end.y });
        else if (segmentIndex === 0) nextRoute.splice(1, 1, { x, y: start.y }, { x, y: end.y });
        else if (segmentIndex === route.length - 2) { nextRoute[segmentIndex].x = x; nextRoute.splice(nextRoute.length - 1, 0, { x, y: end.y }); }
        else { nextRoute[segmentIndex].x = x; nextRoute[segmentIndex + 1].x = x; }
      }
      saveRoute(connection, nextRoute, gestureKey);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const beginNodeDrag = (event: ReactPointerEvent, node: SystemNode) => {
    if ((event.target as HTMLElement).closest("button, input, select")) return;
    event.stopPropagation();
    setSelection({ type: "node", id: node.id });
    const startX = event.clientX;
    const startY = event.clientY;
    const gestureKey = createId("node-drag");
    const move = (moveEvent: PointerEvent) => updateNode(node.id, { x: snap(node.x + (moveEvent.clientX - startX) / zoom), y: snap(node.y + (moveEvent.clientY - startY) / zoom) }, gestureKey);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const beginResize = (event: ReactPointerEvent, node: SystemNode) => {
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const gestureKey = createId("node-resize");
    const move = (moveEvent: PointerEvent) => updateNode(node.id, { width: Math.max(192, snap(node.width + (moveEvent.clientX - startX) / zoom)), height: Math.max(160, snap(node.height + (moveEvent.clientY - startY) / zoom)) }, gestureKey);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const beginPortDrag = (event: ReactPointerEvent<HTMLElement>, node: SystemNode, port: Port) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest(".port-resize-handle")) return;
    event.stopPropagation();
    const element = event.currentTarget;
    const startX = event.clientX; const startY = event.clientY;
    const origin = portTilePosition({ nodes: [node] }, node.id, port.id);
    const gestureKey = createId("port-drag");
    let moved = false;
    const move = (moveEvent: PointerEvent) => {
      const x = origin.x + (moveEvent.clientX - startX) / zoom;
      const y = origin.y + (moveEvent.clientY - startY) / zoom;
      moved ||= Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 3;
      if (!moved) return;
      const distances: Array<[PortSide, number]> = [["left", Math.abs(x - node.x)], ["right", Math.abs(x - node.x - node.width)], ["top", Math.abs(y - node.y)], ["bottom", Math.abs(y - node.y - node.height)]];
      const side = distances.sort((a, b) => a[1] - b[1])[0][0];
      const rawOffset = side === "left" || side === "right" ? (y - node.y) / node.height : (x - node.x) / node.width;
      const dimension = side === "left" || side === "right" ? node.height : node.width;
      const offset = Math.max(0.04, Math.min(0.96, snap(rawOffset * dimension) / dimension));
      updateNode(node.id, { ports: node.ports.map((item) => item.id === port.id ? { ...item, side, offset } : item) }, gestureKey);
    };
    const up = () => {
      if (moved) { element.dataset.suppressClick = "true"; window.setTimeout(() => delete element.dataset.suppressClick, 0); }
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  const beginPortResize = (event: ReactPointerEvent<HTMLElement>, node: SystemNode, port: Port) => {
    event.preventDefault(); event.stopPropagation();
    const startX = event.clientX; const startY = event.clientY;
    const startWidth = port.width ?? 92; const startHeight = port.height ?? 34;
    const gestureKey = createId("port-resize");
    const move = (moveEvent: PointerEvent) => updateNode(node.id, { ports: node.ports.map((item) => item.id === port.id ? { ...item, width: Math.max(56, snap(startWidth + (moveEvent.clientX - startX) / zoom)), height: Math.max(24, snap(startHeight + (moveEvent.clientY - startY) / zoom)) } : item) }, gestureKey);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  return { getPortPosition, saveRoute, addBendPoint, beginBendDrag, beginSegmentDrag, beginNodeDrag, beginResize, beginPortDrag, beginPortResize };
}
