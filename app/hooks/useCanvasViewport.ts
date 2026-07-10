import { useCallback, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import type { Point, SystemNode } from "../model/types";

export function screenToCanvasPoint(client: Point, viewport: DOMRect, pan: Point, zoom: number): Point {
  return {
    x: (client.x - viewport.left - pan.x) / zoom,
    y: (client.y - viewport.top - pan.y) / zoom,
  };
}

export function useCanvasViewport(nodes: SystemNode[], onClearSelection: () => void) {
  const [zoom, setZoom] = useState(0.82);
  const [pan, setPan] = useState<Point>({ x: 20, y: 20 });

  const beginPan = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget && !(event.target as HTMLElement).classList.contains("diagram-surface")) return;
    onClearSelection();
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = pan;
    const move = (moveEvent: PointerEvent) => setPan({ x: initial.x + moveEvent.clientX - startX, y: initial.y + moveEvent.clientY - startY });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [onClearSelection, pan]);

  const handleWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      setZoom((current) => Math.min(1.5, Math.max(0.4, current - event.deltaY * 0.001)));
    } else {
      setPan((current) => ({ x: current.x - event.deltaX, y: current.y - event.deltaY }));
    }
  }, []);

  const fitDiagram = useCallback(() => {
    if (!nodes.length) {
      setZoom(0.82);
      setPan({ x: 40, y: 40 });
      return;
    }
    const minX = Math.min(...nodes.map((node) => node.x));
    const minY = Math.min(...nodes.map((node) => node.y));
    setZoom(0.82);
    setPan({ x: 70 - minX * 0.82, y: 90 - minY * 0.82 });
  }, [nodes]);

  const toCanvasPoint = useCallback((client: Point, viewport: DOMRect) => screenToCanvasPoint(client, viewport, pan, zoom), [pan, zoom]);

  return { zoom, setZoom, pan, setPan, beginPan, handleWheel, fitDiagram, toCanvasPoint };
}
