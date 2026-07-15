import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from "react";
import { capabilityConfig } from "../../model/catalog";
import { connectionRoute, pointAlongRoute, svgPath } from "../../model/routing";
import { snap } from "../../model/project";
import { boundsFromPoints, intersectsBounds } from "../../model/viewport";
import type { Bounds, Connection, ConnectionLabel, DataFlowProcess, Point, Project, Selection } from "../../model/types";

type ConnectionLayerProps = {
  project: Project;
  selection: Selection;
  activeRoute: string[];
  activeProcess?: DataFlowProcess;
  isAnimating: boolean;
  canvasRef: RefObject<HTMLDivElement | null>;
  pan: Point;
  zoom: number;
  renderBounds: Bounds;
  viewportBounds: Bounds;
  preview?: { points: Point[]; invalid: boolean; color: string } | null;
  onSelect: (connectionId: string) => void;
  onAddBend: (connection: Connection, point: Point) => void;
  onBeginBendDrag: (event: ReactPointerEvent<SVGCircleElement>, connection: Connection, pointIndex: number) => void;
  onBeginSegmentDrag: (event: ReactPointerEvent<SVGLineElement>, connection: Connection, segmentIndex: number, route: Point[]) => void;
  onRemoveBend: (connection: Connection, pointIndex: number, route: Point[]) => void;
  onUpdateConnection: (connectionId: string, patch: Partial<Connection>, coalesceKey?: string) => void;
};

function routeCrossings(route: Point[], other: Point[]): Point[] {
  const result: Point[] = [];
  for (let a = 0; a < route.length - 1; a += 1) for (let b = 0; b < other.length - 1; b += 1) {
    const p1 = route[a], p2 = route[a + 1], q1 = other[b], q2 = other[b + 1];
    const pVertical = p1.x === p2.x, qVertical = q1.x === q2.x;
    if (pVertical === qVertical) continue;
    const vertical = pVertical ? [p1, p2] : [q1, q2];
    const horizontal = pVertical ? [q1, q2] : [p1, p2];
    const point = { x: vertical[0].x, y: horizontal[0].y };
    const within = point.y > Math.min(vertical[0].y, vertical[1].y) && point.y < Math.max(vertical[0].y, vertical[1].y) && point.x > Math.min(horizontal[0].x, horizontal[1].x) && point.x < Math.max(horizontal[0].x, horizontal[1].x);
    if (within && !result.some((item) => item.x === point.x && item.y === point.y)) result.push(point);
  }
  return result;
}

export function ConnectionLayer({
  project,
  selection,
  activeRoute,
  activeProcess,
  isAnimating,
  canvasRef,
  pan,
  zoom,
  renderBounds,
  viewportBounds,
  preview,
  onSelect,
  onAddBend,
  onBeginBendDrag,
  onBeginSegmentDrag,
  onRemoveBend,
  onUpdateConnection,
}: ConnectionLayerProps) {
  const orderedConnections = [...project.connections].sort((a, b) => (a.routing?.zIndex ?? 0) - (b.routing?.zIndex ?? 0));
  const orderedRoutes = orderedConnections.map((connection) => connectionRoute(project, connection));
  return (
    <svg className="connection-layer" style={{ left: renderBounds.x, top: renderBounds.y, width: renderBounds.width, height: renderBounds.height }} viewBox={`${renderBounds.x} ${renderBounds.y} ${renderBounds.width} ${renderBounds.height}`} aria-label="System connections">
      <defs>
        <filter id="edgeGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <marker id="connectionArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M 0 0 L 8 4 L 0 8 z" fill="context-stroke" /></marker>
      </defs>
      {orderedConnections.map((connection, connectionIndex) => {
        const active = activeRoute.includes(connection.id);
        const selected = selection?.type === "connection" && selection.id === connection.id;
        const routePoints = connectionRoute(project, connection);
        if (!selected && !active && !intersectsBounds(boundsFromPoints(routePoints), viewportBounds)) return null;
        const path = svgPath(routePoints);
        const accent = activeProcess?.color ?? capabilityConfig[connection.capability].color;
        const style = connection.style ?? { lineStyle: "solid", width: 2.4, opacity: 0.72, arrowStyle: "none" };
        const labels = connection.labels ?? [];
        const crossings = orderedRoutes.slice(0, connectionIndex).flatMap((otherRoute) => routeCrossings(routePoints, otherRoute));
        return (
          <g
            key={connection.id}
            className={`edge ${active ? "active-route" : ""} ${selected ? "selected" : ""}`}
            role="button"
            tabIndex={0}
            aria-label={`Select ${connection.capability} ${connection.subtype} connection`}
            onPointerDown={(event) => { event.stopPropagation(); onSelect(connection.id); }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(connection.id);
              }
            }}
          >
            <path
              className="edge-hit"
              d={path}
              onClick={(event) => {
                if (!event.ctrlKey) return;
                event.stopPropagation();
                event.preventDefault();
                const rect = canvasRef.current?.getBoundingClientRect();
                if (!rect) return;
                onAddBend(connection, {
                  x: snap((event.clientX - rect.left - pan.x) / zoom),
                  y: snap((event.clientY - rect.top - pan.y) / zoom),
                });
                onSelect(connection.id);
              }}
            />
            <path className="edge-line" d={path} markerStart={style.arrowStyle === "start" || style.arrowStyle === "both" ? "url(#connectionArrow)" : undefined} markerEnd={style.arrowStyle === "end" || style.arrowStyle === "both" ? "url(#connectionArrow)" : undefined} style={{ "--edge-color": active ? accent : (style.color || capabilityConfig[connection.capability].color), "--edge-width": style.width, "--edge-opacity": style.opacity, "--edge-dash": style.lineStyle === "dashed" ? "10 7" : style.lineStyle === "dotted" ? "2 6" : "none" } as CSSProperties} />
            {crossings.map((point, index) => <g key={`${connection.id}-crossing-${index}`} className={`connection-crossing ${connection.routing?.crossingStyle ?? "bridge"}`}><circle cx={point.x} cy={point.y} r="6" />{connection.routing?.crossingStyle === "no-connect" && <path d={`M ${point.x - 3} ${point.y - 3} L ${point.x + 3} ${point.y + 3} M ${point.x + 3} ${point.y - 3} L ${point.x - 3} ${point.y + 3}`} />}</g>)}
            {(connection.routing?.trunkPoints ?? []).map((point, index) => <circle key={`${connection.id}-junction-${index}`} className={`connection-junction ${selected ? "editable" : ""}`} cx={point.x + (connection.routing?.parallelOffset ?? 0)} cy={point.y + (connection.routing?.parallelOffset ?? 0)} r={selected ? 6 : 4} onPointerDown={(event) => {
              if (!selected) return;
              event.preventDefault(); event.stopPropagation();
              const startX = event.clientX, startY = event.clientY;
              const trunkPoints = connection.routing?.trunkPoints ?? [];
              const gestureKey = `bus-trunk:${connection.routing?.busId ?? connection.id}:${index}`;
              const move = (moveEvent: PointerEvent) => onUpdateConnection(connection.id, { routing: { ...connection.routing!, trunkPoints: trunkPoints.map((item, itemIndex) => itemIndex === index ? { x: snap(point.x + (moveEvent.clientX - startX) / zoom), y: snap(point.y + (moveEvent.clientY - startY) / zoom) } : item) } }, gestureKey);
              const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
              window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
            }} />)}
            {selected && routePoints.slice(1).map((point, segmentIndex) => {
              const start = routePoints[segmentIndex];
              return <line key={`${connection.id}-segment-${segmentIndex}`} className={`edge-segment-hit ${start.y === point.y ? "horizontal" : "vertical"}`} x1={start.x} y1={start.y} x2={point.x} y2={point.y} onPointerDown={(event) => onBeginSegmentDrag(event, connection, segmentIndex, routePoints)} />;
            })}
            {labels.map((connectionLabel: ConnectionLabel) => {
              const anchor = pointAlongRoute(routePoints, connectionLabel.position, connectionLabel.anchor === "segment" ? connectionLabel.segmentIndex ?? 0 : undefined);
              const x = anchor.x + connectionLabel.offsetX;
              const y = anchor.y + connectionLabel.offsetY;
              const halfWidth = Math.max(24, connectionLabel.text.length * 3.2 + 9);
              return <g key={connectionLabel.id} className={`edge-label ${selected ? "editable" : ""}`} transform={`translate(${x} ${y}) rotate(${connectionLabel.rotation})`} onPointerDown={(event) => {
                if (!selected) return;
                event.preventDefault(); event.stopPropagation();
                const startX = event.clientX; const startY = event.clientY;
                const startOffset = { x: connectionLabel.offsetX, y: connectionLabel.offsetY };
                const gestureKey = `connection-label:${connectionLabel.id}`;
                const move = (moveEvent: PointerEvent) => onUpdateConnection(connection.id, { labels: labels.map((item) => item.id === connectionLabel.id ? { ...item, offsetX: startOffset.x + (moveEvent.clientX - startX) / zoom, offsetY: startOffset.y + (moveEvent.clientY - startY) / zoom } : item) }, gestureKey);
                const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
                window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
              }}>
                {connectionLabel.background && <rect x={-halfWidth} y="-12" width={halfWidth * 2} height="24" rx="6" />}
                <text textAnchor="middle" dominantBaseline="middle">{connectionLabel.text}</text>
              </g>;
            })}
            {selected && routePoints.slice(1, -1).map((point, pointIndex) => (
              <circle
                key={`${connection.id}-bend-${pointIndex}`}
                className="bend-handle"
                cx={point.x}
                cy={point.y}
                r="7"
                role="button"
                aria-label={`Move bend point ${pointIndex + 1}`}
                onPointerDown={(event) => onBeginBendDrag(event, connection, pointIndex)}
                onContextMenu={(event) => {
                  if (!event.ctrlKey) return;
                  event.preventDefault();
                  event.stopPropagation();
                  onRemoveBend(connection, pointIndex, routePoints);
                }}
              />
            ))}
            {active && isAnimating && <circle r="5" fill={accent} filter="url(#edgeGlow)"><animateMotion dur="2.2s" repeatCount="indefinite" path={path} /></circle>}
          </g>
        );
      })}
      {preview && <path className={`connection-preview ${preview.invalid ? "invalid" : ""}`} d={svgPath(preview.points)} style={{ "--preview-color": preview.color } as CSSProperties} />}
    </svg>
  );
}
