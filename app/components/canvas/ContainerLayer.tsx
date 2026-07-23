import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { containerBounds } from "../../model/containers";
import { intersectsBounds } from "../../model/viewport";
import type { Bounds, DiagramContainer, Selection } from "../../model/types";

type ContainerLayerProps = {
  containers: DiagramContainer[];
  selection: Selection;
  editing: boolean;
  viewportBounds: Bounds;
  isSelected: (type: "node" | "container", id: string) => boolean;
  onBeginDrag: (event: ReactPointerEvent<HTMLElement>, container: DiagramContainer) => void;
  onBeginResize: (event: ReactPointerEvent<HTMLButtonElement>, container: DiagramContainer) => void;
};

export function ContainerLayer({ containers, selection, editing, viewportBounds, isSelected, onBeginDrag, onBeginResize }: ContainerLayerProps) {
  return (
    <section className={`container-layer ${editing ? "editing" : ""}`} aria-label="Diagram containers">
      {containers.map((container) => {
        const selected = isSelected("container", container.id) || (selection?.type === "container" && selection.id === container.id);
        if (!selected && !intersectsBounds(containerBounds(container), viewportBounds)) return null;
        return (
          <article
            className={`diagram-container ${selected ? "selected" : ""}`}
            key={container.id}
            style={{ left: container.x, top: container.y, width: container.width, height: container.height, "--container-color": container.color, "--container-opacity": container.opacity } as CSSProperties}
            onPointerDown={(event) => { if (!editing) return; onBeginDrag(event, container); }}
          >
            <div className="container-title"><span>{container.kind}</span><strong>{container.name}</strong></div>
            {editing && selected && <button className="container-resize" aria-label={`Resize ${container.name}`} onPointerDown={(event) => onBeginResize(event, container)} />}
          </article>
        );
      })}
    </section>
  );
}
