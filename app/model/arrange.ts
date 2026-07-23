import type { Bounds, DiagramContainer, Project, SelectionRef, SystemNode } from "./types";
import { getProjectObject } from "./projectObject";

// Pure alignment/distribution math for multi-object arrange (#10). Operates on resolved boxes and
// returns absolute-position moves for the `objects.arrange` command — it never mutates the project.

export type AlignEdge = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";
export type DistributeAxis = "horizontal" | "vertical";
export type ArrangeMove = { type: "node" | "container"; id: string; x: number; y: number };

type Box = { ref: SelectionRef; x: number; y: number; width: number; height: number };

export function movablesFromRefs(project: Project, refs: SelectionRef[]): Box[] {
  const boxes: Box[] = [];
  for (const ref of refs) {
    const object = ref.type === "node"
      ? getProjectObject(project, "node", ref.id) as SystemNode | undefined
      : getProjectObject(project, "container", ref.id) as DiagramContainer | undefined;
    if (object) boxes.push({ ref, x: object.x, y: object.y, width: object.width, height: object.height });
  }
  return boxes;
}

export function selectionBounds(boxes: Box[]): Bounds | null {
  if (!boxes.length) return null;
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Align every box to a shared edge/center of the selection's bounding box.
export function alignMoves(boxes: Box[], edge: AlignEdge): ArrangeMove[] {
  const bounds = selectionBounds(boxes);
  if (!bounds || boxes.length < 2) return [];
  return boxes.map((box) => {
    let { x, y } = box;
    switch (edge) {
      case "left": x = bounds.x; break;
      case "right": x = bounds.x + bounds.width - box.width; break;
      case "hcenter": x = bounds.x + bounds.width / 2 - box.width / 2; break;
      case "top": y = bounds.y; break;
      case "bottom": y = bounds.y + bounds.height - box.height; break;
      case "vcenter": y = bounds.y + bounds.height / 2 - box.height / 2; break;
    }
    return { type: box.ref.type, id: box.ref.id, x: Math.round(x), y: Math.round(y) };
  });
}

const MIN_SIZE = { node: { width: 192, height: 160 }, container: { width: 240, height: 160 } };

// Scale the whole selection about its top-left corner (group resize, #10 phase 3). The scale is
// clamped so no object drops below its minimum size, which keeps the layout proportional.
export function resizeMoves(boxes: Box[], bounds: Bounds, rawScaleX: number, rawScaleY: number): ArrangeMove[] {
  if (boxes.length < 1 || !bounds.width || !bounds.height) return [];
  const minScaleX = Math.max(...boxes.map((b) => MIN_SIZE[b.ref.type].width / b.width));
  const minScaleY = Math.max(...boxes.map((b) => MIN_SIZE[b.ref.type].height / b.height));
  const scaleX = Math.max(rawScaleX, minScaleX);
  const scaleY = Math.max(rawScaleY, minScaleY);
  return boxes.map((box) => ({
    type: box.ref.type,
    id: box.ref.id,
    x: Math.round(bounds.x + (box.x - bounds.x) * scaleX),
    y: Math.round(bounds.y + (box.y - bounds.y) * scaleY),
    width: Math.round(box.width * scaleX),
    height: Math.round(box.height * scaleY),
  }));
}

// Even edge-to-edge gaps between the boxes along one axis; the two extreme boxes stay put.
export function distributeMoves(boxes: Box[], axis: DistributeAxis): ArrangeMove[] {
  if (boxes.length < 3) return [];
  const horizontal = axis === "horizontal";
  const size = (b: Box) => (horizontal ? b.width : b.height);
  const pos = (b: Box) => (horizontal ? b.x : b.y);
  const sorted = [...boxes].sort((a, b) => pos(a) - pos(b));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = (pos(last) + size(last)) - pos(first);
  const totalSize = sorted.reduce((sum, b) => sum + size(b), 0);
  const gap = (span - totalSize) / (sorted.length - 1);
  let cursor = pos(first);
  return sorted.map((box) => {
    const target = Math.round(cursor);
    cursor += size(box) + gap;
    return horizontal
      ? { type: box.ref.type, id: box.ref.id, x: target, y: box.y }
      : { type: box.ref.type, id: box.ref.id, x: box.x, y: target };
  });
}
