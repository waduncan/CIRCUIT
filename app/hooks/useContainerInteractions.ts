import type { PointerEvent as ReactPointerEvent } from "react";
import { createId, snap } from "../model/project";
import type { ArrangeMove } from "../model/arrange";
import type { DiagramContainer, Project, SelectionRef } from "../model/types";

type ContainerInteractionOptions = {
  project: Project;
  zoom: number;
  selectAtPointer: (ref: SelectionRef, additive: boolean) => SelectionRef[];
  moveObjects: (moves: ArrangeMove[], coalesceKey?: string) => void;
  updateContainer: (id: string, patch: Partial<DiagramContainer>, coalesceKey?: string) => void;
};

export function useContainerInteractions({ project, zoom, selectAtPointer, moveObjects, updateContainer }: ContainerInteractionOptions) {
  const beginContainerDrag = (event: ReactPointerEvent<HTMLElement>, container: DiagramContainer) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    event.stopPropagation();
    event.preventDefault();
    const additive = event.shiftKey || event.ctrlKey || event.metaKey;
    const group = selectAtPointer({ type: "container", id: container.id }, additive);
    if (additive) return;
    const origins = group.flatMap((ref) => {
      const object = ref.type === "node" ? project.nodes.find((n) => n.id === ref.id) : project.containers.find((c) => c.id === ref.id);
      return object ? [{ ref, x: object.x, y: object.y }] : [];
    });
    const anchor = origins.find((origin) => origin.ref.type === "container" && origin.ref.id === container.id) ?? origins[0];
    const startX = event.clientX;
    const startY = event.clientY;
    const gestureKey = createId("group-drag");
    const move = (moveEvent: PointerEvent) => {
      const dx = anchor ? snap(anchor.x + (moveEvent.clientX - startX) / zoom) - anchor.x : 0;
      const dy = anchor ? snap(anchor.y + (moveEvent.clientY - startY) / zoom) - anchor.y : 0;
      moveObjects(origins.map((origin) => ({ type: origin.ref.type, id: origin.ref.id, x: origin.x + dx, y: origin.y + dy })), gestureKey);
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
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
