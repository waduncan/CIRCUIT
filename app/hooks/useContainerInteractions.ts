import type { Dispatch, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import { createId, snap } from "../model/project";
import type { DiagramContainer, Selection } from "../model/types";

type ContainerInteractionOptions = {
  zoom: number;
  setSelection: Dispatch<SetStateAction<Selection>>;
  updateContainer: (id: string, patch: Partial<DiagramContainer>, coalesceKey?: string) => void;
};

export function useContainerInteractions({ zoom, setSelection, updateContainer }: ContainerInteractionOptions) {
  const beginContainerDrag = (event: ReactPointerEvent<HTMLElement>, container: DiagramContainer) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    event.stopPropagation();
    event.preventDefault();
    setSelection({ type: "container", id: container.id });
    const startX = event.clientX;
    const startY = event.clientY;
    const gestureKey = createId("container-drag");
    const move = (moveEvent: PointerEvent) => updateContainer(container.id, { x: snap(container.x + (moveEvent.clientX - startX) / zoom), y: snap(container.y + (moveEvent.clientY - startY) / zoom) }, gestureKey);
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
