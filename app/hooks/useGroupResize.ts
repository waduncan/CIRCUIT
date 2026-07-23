import { useCallback, type PointerEvent as ReactPointerEvent } from "react";
import { movablesFromRefs, resizeMoves, selectionBounds, type ArrangeMove } from "../model/arrange";
import { createId } from "../model/project";
import type { Project, SelectionRef } from "../model/types";

type Options = {
  project: Project;
  selectedRefs: SelectionRef[];
  zoom: number;
  moveObjects: (moves: ArrangeMove[], coalesceKey?: string) => void;
};

// Group resize (#10 phase 3): a handle at the selection's bottom-right corner scales the whole
// selection about its top-left, preserving relative layout. Applied via the objects.arrange command
// (which now carries width/height), so it is a single undo step.
export function useGroupResize({ project, selectedRefs, zoom, moveObjects }: Options) {
  const bounds = selectionBounds(movablesFromRefs(project, selectedRefs));

  const beginResize = useCallback((event: ReactPointerEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const startBoxes = movablesFromRefs(project, selectedRefs);
    const start = selectionBounds(startBoxes);
    if (!start || !start.width || !start.height) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const gestureKey = createId("group-resize");
    const move = (moveEvent: PointerEvent) => {
      const scaleX = (start.width + (moveEvent.clientX - startX) / zoom) / start.width;
      const scaleY = (start.height + (moveEvent.clientY - startY) / zoom) / start.height;
      moveObjects(resizeMoves(startBoxes, start, scaleX, scaleY), gestureKey);
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [project, selectedRefs, zoom, moveObjects]);

  return { bounds, beginResize };
}
