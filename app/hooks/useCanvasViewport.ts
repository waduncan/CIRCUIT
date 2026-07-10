import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import { boundsFromNodes, expandBounds } from "../model/viewport";
import type { Bounds, CanvasSettings, Point, SystemNode } from "../model/types";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const VIEWPORT_OVERSCAN = 320;

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

export function screenToCanvasPoint(client: Point, viewport: DOMRect, pan: Point, zoom: number): Point {
  return { x: (client.x - viewport.left - pan.x) / zoom, y: (client.y - viewport.top - pan.y) / zoom };
}

type CanvasViewportOptions = {
  nodes: SystemNode[];
  canvas: CanvasSettings;
  onClearSelection: () => void;
};

export function useCanvasViewport({ nodes, canvas, onClearSelection }: CanvasViewportOptions) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ zoom: 0.82, pan: { x: 20, y: 20 } as Point });
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const updateSize = () => setViewportSize({ width: element.clientWidth, height: element.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const zoomAt = useCallback((client: Point, requestedZoom: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    setView((current) => {
      const nextZoom = clampZoom(requestedZoom);
      const local = { x: client.x - rect.left, y: client.y - rect.top };
      const canvasPoint = { x: (local.x - current.pan.x) / current.zoom, y: (local.y - current.pan.y) / current.zoom };
      return { zoom: nextZoom, pan: { x: local.x - canvasPoint.x * nextZoom, y: local.y - canvasPoint.y * nextZoom } };
    });
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    zoomAt({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, view.zoom * factor);
  }, [view.zoom, zoomAt]);

  const beginPan = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget && !(event.target as HTMLElement).classList.contains("diagram-surface")) return;
    onClearSelection();
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = view.pan;
    const move = (moveEvent: PointerEvent) => setView((current) => ({ ...current, pan: { x: initial.x + moveEvent.clientX - startX, y: initial.y + moveEvent.clientY - startY } }));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [onClearSelection, view.pan]);

  const handleWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      zoomAt({ x: event.clientX, y: event.clientY }, view.zoom * Math.exp(-event.deltaY * 0.0015));
    } else {
      setView((current) => ({ ...current, pan: { x: current.pan.x - event.deltaX, y: current.pan.y - event.deltaY } }));
    }
  }, [view.zoom, zoomAt]);

  const fitBounds = useCallback((bounds: Bounds) => {
    if (!bounds.width && !bounds.height) return;
    const padding = 64;
    const width = Math.max(bounds.width, 1);
    const height = Math.max(bounds.height, 1);
    const zoom = clampZoom(Math.min((viewportSize.width - padding * 2) / width, (viewportSize.height - padding * 2) / height));
    setView({
      zoom,
      pan: {
        x: (viewportSize.width - width * zoom) / 2 - bounds.x * zoom,
        y: (viewportSize.height - height * zoom) / 2 - bounds.y * zoom,
      },
    });
  }, [viewportSize]);

  const resetView = useCallback(() => setView({ zoom: 1, pan: { x: 40, y: 40 } }), []);

  const fitDocument = useCallback(() => {
    if (canvas.mode === "infinite" && !nodes.length) {
      resetView();
      return;
    }
    const bounds = canvas.mode === "bounded"
      ? { x: 0, y: 0, width: canvas.width, height: canvas.height }
      : expandBounds(boundsFromNodes(nodes), 160);
    fitBounds(bounds);
  }, [canvas, fitBounds, nodes, resetView]);

  const toCanvasPoint = useCallback((client: Point, viewport: DOMRect) => screenToCanvasPoint(client, viewport, view.pan, view.zoom), [view]);

  const viewportBounds = useMemo(() => expandBounds({
    x: -view.pan.x / view.zoom,
    y: -view.pan.y / view.zoom,
    width: viewportSize.width / view.zoom,
    height: viewportSize.height / view.zoom,
  }, VIEWPORT_OVERSCAN / view.zoom), [view, viewportSize]);

  return {
    viewportRef,
    zoom: view.zoom,
    pan: view.pan,
    viewportBounds,
    beginPan,
    handleWheel,
    fitBounds,
    fitDocument,
    resetView,
    zoomIn: () => zoomBy(1.2),
    zoomOut: () => zoomBy(1 / 1.2),
    toCanvasPoint,
  };
}
