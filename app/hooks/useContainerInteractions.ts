import type { PointerEvent as ReactPointerEvent } from "react";
import { createId, snap } from "../model/project";
import type { ArrangeMove } from "../model/arrange";
import { groupDragContext, resolveGroupDrag, type Guide } from "../model/guides";
import type { DiagramContainer, Project, SelectionRef } from "../model/types";

type ContainerInteractionOptions = {
  project: Project;
  zoom: number;
  selectAtPointer: (ref: SelectionRef, additive: boolean) => SelectionRef[];
  moveObjects: (moves: ArrangeMove[], coalesceKey?: string) => void;
  onGuides: (guides: Guide[]) => void;
  updateContainer: (id: string, patch: Partial<DiagramContainer>, coalesceKey?: string) => void;
};

export function useContainerInteractions({ project, zoom, selectAtPointer, moveObjects, onGuides, updateContainer }: ContainerInteractionOptions) {
  const beginContainerDrag = (event: ReactPointerEvent<HTMLElement>, container: DiagramContainer) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    event.stopPropagation();
    event.preventDefault();
    const additive = event.shiftKey || event.ctrlKey || event.metaKey;
    const group = selectAtPointer({ type: "container", id: container.id }, additive);
    if (additive) return;
    const { origins, bounds, candidates } = groupDragContext(project, group);
    const anchor = origins.find((origin) => origin.ref.type === "container" && origin.ref.id === container.id) ?? origins[0];
    const snapToGrid = project.canvas.snapToGrid !== false;
    const startX = event.clientX;
    const startY = event.clientY;
    const gestureKey = createId("group-drag");
    const move = (moveEvent: PointerEvent) => {
      const { dx, dy, guides } = resolveGroupDrag({ anchor, groupBounds: bounds, rawDx: (moveEvent.clientX - startX) / zoom, rawDy: (moveEvent.clientY - startY) / zoom, candidates, zoom, snapToGrid });
      onGuides(guides);
      moveObjects(origins.map((origin) => ({ type: origin.ref.type, id: origin.ref.id, x: origin.x + dx, y: origin.y + dy })), gestureKey);
    };
    const up = () => { onGuides([]); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const beginContainerResize = (event: ReactPointerEvent<HTMLButtonElement>, container: DiagramContainer) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const gestureKey = createId("container-resize");
    const move = (moveEvent: PointerEvent) => updateContainer(container.id, { width: Math.max(240, snap(container.width + (moveEvent.clientX - startX) / zoom)), height: Math.max(160, snap(container.height + (moveEvent.clientY - startY) / zoom)) }, gestureKey);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return { beginContainerDrag, beginContainerResize };
}
