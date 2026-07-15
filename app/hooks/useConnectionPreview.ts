import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { capabilityConfig } from "../model/catalog";
import { nearestConnectionPort } from "../model/connectionHitTest";
import { portsAreCompatible } from "../model/project";
import { getProjectObject } from "../model/projectObject";
import { orthogonalRoutePoints, portPosition } from "../model/routing";
import type { Point, Project } from "../model/types";

type ConnectingPort = { nodeId: string; portId: string } | null;
type PreviewPoint = { point: Point; target: { nodeId: string; portId: string } | null };

export function useConnectionPreview({ project, connecting, zoom, canvasRef, toCanvasPoint }: {
  project: Project;
  connecting: ConnectingPort;
  zoom: number;
  canvasRef: RefObject<HTMLDivElement | null>;
  toCanvasPoint: (point: Point, rect: DOMRect) => Point;
}) {
  const [previewPoint, setPreviewPoint] = useState<PreviewPoint | null>(null);
  useEffect(() => { if (!connecting) setPreviewPoint(null); }, [connecting]);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!connecting || !rect) return;
    const point = toCanvasPoint({ x: event.clientX, y: event.clientY }, rect);
    const target = nearestConnectionPort(project, point, 28 / zoom, connecting);
    setPreviewPoint({ point, target: target ? { nodeId: target.node.id, portId: target.port.id } : null });
  };

  const preview = useMemo(() => {
    if (!connecting || !previewPoint) return null;
    const source = getProjectObject(project, "port", connecting.portId);
    if (!source) return null;
    const target = previewPoint.target ? getProjectObject(project, "port", previewPoint.target.portId) : undefined;
    const sourcePoint = portPosition(project, connecting.nodeId, connecting.portId);
    const targetPoint = target && previewPoint.target ? portPosition(project, previewPoint.target.nodeId, previewPoint.target.portId) : previewPoint.point;
    return { points: target ? orthogonalRoutePoints(sourcePoint, targetPoint) : [sourcePoint, targetPoint], invalid: Boolean(target && !portsAreCompatible(source, target)), color: capabilityConfig[source.capability].color };
  }, [connecting, previewPoint, project]);

  return { preview, handlePointerMove, clearPreview: () => setPreviewPoint(null) };
}
