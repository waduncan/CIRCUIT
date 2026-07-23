import { snap } from "./project";
import type { Bounds, Project, SelectionRef } from "./types";

// Smart alignment guides + snapping for dragging (#10 phase 3). Pure geometry: given the moving
// bounding box and the other objects' boxes, it snaps the drag to a nearby edge/center and reports
// the guide lines to draw. Threshold is in canvas units, so callers pass px/zoom to stay accurate
// at any zoom level.

export type Guide = { axis: "x" | "y"; position: number; from: number; to: number };

const xLines = (b: Bounds) => [b.x, b.x + b.width / 2, b.x + b.width];
const yLines = (b: Bounds) => [b.y, b.y + b.height / 2, b.y + b.height];

type Best = { diff: number; adjust: number; position: number; box: Bounds | null };

function nearest(movingLines: number[], candidate: Bounds, candidateLines: number[], current: Best, threshold: number): Best {
  let best = current;
  for (const m of movingLines) {
    for (const c of candidateLines) {
      const diff = Math.abs(m - c);
      if (diff <= threshold && diff < best.diff) best = { diff, adjust: c - m, position: c, box: candidate };
    }
  }
  return best;
}

// Snap the moving box to the closest candidate edge/center on each axis; returns the adjustment to
// apply to the moving box plus the guide lines for the matched axes.
export function snapToGuides(moving: Bounds, candidates: Bounds[], threshold: number): { dx: number; dy: number; guides: Guide[] } {
  let bestX: Best = { diff: threshold + 1, adjust: 0, position: 0, box: null };
  let bestY: Best = { diff: threshold + 1, adjust: 0, position: 0, box: null };
  const mX = xLines(moving);
  const mY = yLines(moving);
  for (const candidate of candidates) {
    bestX = nearest(mX, candidate, xLines(candidate), bestX, threshold);
    bestY = nearest(mY, candidate, yLines(candidate), bestY, threshold);
  }
  const dx = bestX.box ? bestX.adjust : 0;
  const dy = bestY.box ? bestY.adjust : 0;
  const guides: Guide[] = [];
  if (bestX.box) guides.push({ axis: "x", position: bestX.position, from: Math.min(moving.y + dy, bestX.box.y), to: Math.max(moving.y + dy + moving.height, bestX.box.y + bestX.box.height) });
  if (bestY.box) guides.push({ axis: "y", position: bestY.position, from: Math.min(moving.x + dx, bestY.box.x), to: Math.max(moving.x + dx + moving.width, bestY.box.x + bestY.box.width) });
  return { dx, dy, guides };
}

// Resolve a group drag: prefer snapping to an alignment guide; otherwise grid-snap the anchor (unless
// snapping is disabled). `anchor` is the grabbed object's original position so grid snap matches the
// single-object feel. Returns the final delta to apply to the whole group and the guides to render.
export function resolveGroupDrag(params: {
  anchor: { x: number; y: number };
  groupBounds: Bounds;
  rawDx: number;
  rawDy: number;
  candidates: Bounds[];
  zoom: number;
  snapToGrid: boolean;
}): { dx: number; dy: number; guides: Guide[] } {
  const { anchor, groupBounds, rawDx, rawDy, candidates, zoom, snapToGrid } = params;
  const proposed = { ...groupBounds, x: groupBounds.x + rawDx, y: groupBounds.y + rawDy };
  const guideSnap = snapToGuides(proposed, candidates, 6 / zoom);
  const hasX = guideSnap.guides.some((g) => g.axis === "x");
  const hasY = guideSnap.guides.some((g) => g.axis === "y");
  const dx = hasX ? rawDx + guideSnap.dx : snapToGrid ? snap(anchor.x + rawDx) - anchor.x : rawDx;
  const dy = hasY ? rawDy + guideSnap.dy : snapToGrid ? snap(anchor.y + rawDy) - anchor.y : rawDy;
  return { dx, dy, guides: guideSnap.guides };
}

export type DragOrigin = { ref: SelectionRef; x: number; y: number; width: number; height: number };

// Resolve the moving group's origins + bounding box and the other objects' boxes (guide candidates)
// once at drag start, so the per-move handler stays cheap. Shared by node and container drags.
export function groupDragContext(project: Project, group: SelectionRef[]): { origins: DragOrigin[]; bounds: Bounds; candidates: Bounds[] } {
  const origins = group.flatMap((ref): DragOrigin[] => {
    const object = ref.type === "node" ? project.nodes.find((n) => n.id === ref.id) : project.containers.find((c) => c.id === ref.id);
    return object ? [{ ref, x: object.x, y: object.y, width: object.width, height: object.height }] : [];
  });
  const minX = Math.min(...origins.map((o) => o.x));
  const minY = Math.min(...origins.map((o) => o.y));
  const maxX = Math.max(...origins.map((o) => o.x + o.width));
  const maxY = Math.max(...origins.map((o) => o.y + o.height));
  const bounds: Bounds = origins.length ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : { x: 0, y: 0, width: 0, height: 0 };
  const groupIds = new Set(group.map((ref) => `${ref.type}:${ref.id}`));
  const toBounds = (o: { x: number; y: number; width: number; height: number }): Bounds => ({ x: o.x, y: o.y, width: o.width, height: o.height });
  const candidates: Bounds[] = [
    ...project.nodes.filter((n) => !groupIds.has(`node:${n.id}`)).map(toBounds),
    ...project.containers.filter((c) => !groupIds.has(`container:${c.id}`)).map(toBounds),
  ];
  return { origins, bounds, candidates };
}
