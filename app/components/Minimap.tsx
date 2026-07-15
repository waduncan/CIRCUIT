import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { boundsFromContainers, boundsFromNodes, expandBounds, unionBounds } from "../model/viewport";
import type { CanvasSettings, DiagramContainer, Point, SystemNode } from "../model/types";

type MinimapProps = {
  nodes: SystemNode[];
  containers: DiagramContainer[];
  canvas: CanvasSettings;
  pan: Point;
  zoom: number;
  viewportRef: RefObject<HTMLDivElement | null>;
  panTo: (center: Point) => void;
};

const PAD = 8;
// Cap the dots drawn so a very large document doesn't create thousands of nodes; the map stays a
// faithful overview without one element per shape past this point.
const MAX_DOTS = 400;

// Accurate document minimap for issue #13. Geometry is derived every render from the real node and
// container bounds (so it stays correct after the document is resized) and the live pan/zoom, and it
// only calls panTo — it never mutates the document.
export function Minimap({ nodes, containers, canvas, pan, zoom, viewportRef, panTo }: MinimapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 122, h: 76 });
  const [vp, setVp] = useState({ w: 1, h: 1 });

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    const update = () => setSize({ w: element.clientWidth, h: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const update = () => setVp({ w: element.clientWidth, h: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [viewportRef]);

  const innerW = Math.max(1, size.w - PAD * 2);
  const innerH = Math.max(1, size.h - PAD * 2);
  const viewRect = { x: -pan.x / zoom, y: -pan.y / zoom, width: vp.w / zoom, height: vp.h / zoom };
  const base = canvas.mode === "bounded"
    ? { x: 0, y: 0, width: canvas.width, height: canvas.height }
    : expandBounds(unionBounds(boundsFromNodes(nodes), boundsFromContainers(containers)), 80);
  // Union in the viewport so the "you are here" window is always visible, even when panned into empty
  // space on an infinite canvas.
  const docBounds = unionBounds(base, viewRect);
  const drawable = docBounds.width > 0 && docBounds.height > 0;
  const scale = drawable ? Math.min(innerW / docBounds.width, innerH / docBounds.height) : 1;
  const offX = PAD + (innerW - docBounds.width * scale) / 2;
  const offY = PAD + (innerH - docBounds.height * scale) / 2;
  const mapLeft = (x: number) => offX + (x - docBounds.x) * scale;
  const mapTop = (y: number) => offY + (y - docBounds.y) * scale;

  const navigateFromEvent = (clientX: number, clientY: number) => {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect || !scale) return;
    const cx = (clientX - rect.left - offX) / scale + docBounds.x;
    const cy = (clientY - rect.top - offY) / scale + docBounds.y;
    panTo({ x: cx, y: cy });
  };

  const beginNavigate = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault();
    navigateFromEvent(event.clientX, event.clientY);
    const move = (moveEvent: PointerEvent) => navigateFromEvent(moveEvent.clientX, moveEvent.clientY);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const dots = nodes.length > MAX_DOTS ? nodes.slice(0, MAX_DOTS) : nodes;

  return (
    <div className="minimap" ref={mapRef} onPointerDown={beginNavigate} title="Click or drag to navigate">
      <div className="minimap-label">MAP</div>
      {drawable && containers.map((container) => (
        <span key={container.id} className="minimap-area" style={{ left: mapLeft(container.x), top: mapTop(container.y), width: Math.max(3, container.width * scale), height: Math.max(3, container.height * scale), background: container.color } as CSSProperties} />
      ))}
      {drawable && dots.map((node) => (
        <i key={node.id} style={{ left: mapLeft(node.x), top: mapTop(node.y), width: Math.max(2, node.width * scale), height: Math.max(2, node.height * scale), background: node.color } as CSSProperties} />
      ))}
      {drawable && (
        <div className="minimap-window" style={{ left: mapLeft(viewRect.x), top: mapTop(viewRect.y), width: Math.max(6, viewRect.width * scale), height: Math.max(6, viewRect.height * scale) }} />
      )}
    </div>
  );
}
