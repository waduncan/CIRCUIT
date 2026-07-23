import { useCallback, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { Point, Project, SelectionRef } from "../model/types";

type Rect = { x: number; y: number; width: number; height: number };

type Options = {
  canvasRef: RefObject<HTMLDivElement | null>;
  toCanvasPoint: (client: Point, viewport: DOMRect) => Point;
  project: Project;
  replaceRefs: (refs: SelectionRef[]) => void;
};

// Rubber-band multi-selection on empty canvas (#10). Draws a rectangle in viewport pixels and, on
// release, selects every node and container whose box intersects it (in canvas space).
export function useMarquee({ canvasRef, toCanvasPoint, project, replaceRefs }: Options) {
  const [rect, setRect] = useState<Rect | null>(null);

  const beginMarquee = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = canvasRef.current?.getBoundingClientRect();
    if (!viewport) return;
    const startLocal = { x: event.clientX - viewport.left, y: event.clientY - viewport.top };
    const startCanvas = toCanvasPoint({ x: event.clientX, y: event.clientY }, viewport);
    let moved = false;

    const move = (moveEvent: PointerEvent) => {
      const local = { x: moveEvent.clientX - viewport.left, y: moveEvent.clientY - viewport.top };
      if (!moved && Math.hypot(local.x - startLocal.x, local.y - startLocal.y) < 3) return;
      moved = true;
      setRect({ x: Math.min(startLocal.x, local.x), y: Math.min(startLocal.y, local.y), width: Math.abs(local.x - startLocal.x), height: Math.abs(local.y - startLocal.y) });
    };

    const up = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setRect(null);
      if (!moved) return;
      const endCanvas = toCanvasPoint({ x: upEvent.clientX, y: upEvent.clientY }, viewport);
      const box = { x: Math.min(startCanvas.x, endCanvas.x), y: Math.min(startCanvas.y, endCanvas.y), width: Math.abs(endCanvas.x - startCanvas.x), height: Math.abs(endCanvas.y - startCanvas.y) };
      const intersects = (o: { x: number; y: number; width: number; height: number }) => o.x < box.x + box.width && o.x + o.width > box.x && o.y < box.y + box.height && o.y + o.height > box.y;
      const refs: SelectionRef[] = [
        ...project.containers.filter(intersects).map((container) => ({ type: "container" as const, id: container.id })),
        ...project.nodes.filter(intersects).map((node) => ({ type: "node" as const, id: node.id })),
      ];
      replaceRefs(refs);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [canvasRef, toCanvasPoint, project, replaceRefs]);

  return { marquee: rect, beginMarquee };
}
