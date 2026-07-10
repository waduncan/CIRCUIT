import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from "react";
import { capabilityConfig } from "../../model/catalog";
import { connectionRoute, routeMidpoint, svgPath } from "../../model/routing";
import { snap } from "../../model/project";
import { boundsFromPoints, intersectsBounds } from "../../model/viewport";
import type { Bounds, Connection, DataFlowProcess, Point, Project, Selection } from "../../model/types";

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
  onSelect: (connectionId: string) => void;
  onAddBend: (connection: Connection, point: Point) => void;
  onBeginBendDrag: (event: ReactPointerEvent<SVGCircleElement>, connection: Connection, pointIndex: number) => void;
  onBeginSegmentDrag: (event: ReactPointerEvent<SVGLineElement>, connection: Connection, segmentIndex: number, route: Point[]) => void;
  onRemoveBend: (connection: Connection, pointIndex: number, route: Point[]) => void;
};

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
  onSelect,
  onAddBend,
  onBeginBendDrag,
  onBeginSegmentDrag,
  onRemoveBend,
}: ConnectionLayerProps) {
  return (
    <svg className="connection-layer" style={{ left: renderBounds.x, top: renderBounds.y, width: renderBounds.width, height: renderBounds.height }} viewBox={`${renderBounds.x} ${renderBounds.y} ${renderBounds.width} ${renderBounds.height}`} aria-label="System connections">
      <defs>
        <filter id="edgeGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {project.connections.map((connection) => {
        const active = activeRoute.includes(connection.id);
        const selected = selection?.type === "connection" && selection.id === connection.id;
        const routePoints = connectionRoute(project, connection);
        if (!selected && !active && !intersectsBounds(boundsFromPoints(routePoints), viewportBounds)) return null;
        const path = svgPath(routePoints);
        const label = routeMidpoint(routePoints);
        const accent = activeProcess?.color ?? capabilityConfig[connection.capability].color;
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
            <path className="edge-line" d={path} style={{ "--edge-color": active ? accent : capabilityConfig[connection.capability].color } as CSSProperties} />
            {selected && routePoints.slice(1).map((point, segmentIndex) => {
              const start = routePoints[segmentIndex];
              return <line key={`${connection.id}-segment-${segmentIndex}`} className={`edge-segment-hit ${start.y === point.y ? "horizontal" : "vertical"}`} x1={start.x} y1={start.y} x2={point.x} y2={point.y} onPointerDown={(event) => onBeginSegmentDrag(event, connection, segmentIndex, routePoints)} />;
            })}
            <g className="edge-label" transform={`translate(${label.x} ${label.y - 14})`}>
              <rect x="-52" y="-12" width="104" height="24" rx="12" />
              <text textAnchor="middle" dominantBaseline="middle">{connection.capability} · {connection.subtype}</text>
            </g>
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
    </svg>
  );
}
