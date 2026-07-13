import type { CanvasSettings } from "../model/types";

type CanvasToolbarProps = {
  canvas: CanvasSettings;
  zoom: number;
  connecting: boolean;
  containerEditing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canFitSelection: boolean;
  onSelect: () => void;
  onPan: () => void;
  onConnect: () => void;
  onAddProcess: () => void;
  onToggleContainers: () => void;
  onAddContainer: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onUpdateCanvas: (patch: Partial<CanvasSettings>) => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFitDocument: () => void;
  onFitSelection: () => void;
  onResetView: () => void;
};

export function CanvasToolbar(props: CanvasToolbarProps) {
  const { canvas, zoom, connecting, containerEditing, canUndo, canRedo, canFitSelection } = props;
  return (
    <div className="canvas-toolbar">
      <div className="tool-group">
        <button className={`tool ${!containerEditing ? "active" : ""}`} onClick={props.onSelect} aria-label="Select tool">↖</button>
        <button className="tool" onClick={props.onPan} aria-label="Pan tool">✋</button>
        <span className="tool-separator" />
        <button className={`tool ${connecting ? "active-connect" : ""}`} onClick={props.onConnect} aria-label="Connect tool">↗</button>
        <button className="tool" onClick={props.onAddProcess} aria-label="Add process">◎</button>
        <button className={`tool container-tool ${containerEditing ? "active" : ""}`} onClick={props.onToggleContainers} aria-label="Edit containers" title="Container editing mode">▣</button>
        {containerEditing && <button className="tool" onClick={props.onAddContainer} aria-label="Add container" title="Add container">＋</button>}
        <span className="tool-separator" />
        <button className="tool" onClick={props.onUndo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">↺</button>
        <button className="tool" onClick={props.onRedo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Y)">↻</button>
      </div>
      <div className="canvas-crumb"><span>Logical Diagram</span><b>/</b><strong>Primary View</strong></div>
      <div className="canvas-config">
        <select aria-label="Canvas mode" value={canvas.mode} onChange={(event) => props.onUpdateCanvas({ mode: event.target.value as CanvasSettings["mode"] })}><option value="bounded">Bounded</option><option value="infinite">Infinite</option></select>
        {canvas.mode === "bounded" && <><input aria-label="Canvas width" type="number" min="640" step="100" value={canvas.width} onChange={(event) => props.onUpdateCanvas({ width: Math.max(1, Number(event.target.value)) })} onBlur={() => props.onUpdateCanvas({ width: Math.max(640, canvas.width) })} /><span>×</span><input aria-label="Canvas height" type="number" min="480" step="100" value={canvas.height} onChange={(event) => props.onUpdateCanvas({ height: Math.max(1, Number(event.target.value)) })} onBlur={() => props.onUpdateCanvas({ height: Math.max(480, canvas.height) })} /></>}
      </div>
      <div className="zoom-controls">
        <button onClick={props.onZoomOut} aria-label="Zoom out">−</button><span>{Math.round(zoom * 100)}%</span><button onClick={props.onZoomIn} aria-label="Zoom in">＋</button>
        <button className="fit-button" onClick={props.onFitDocument} title="Fit document">Doc</button><button className="fit-button" disabled={!canFitSelection} onClick={props.onFitSelection} title="Fit selection">Sel</button><button className="fit-button" onClick={props.onResetView} title="Reset to 100%">1:1</button>
      </div>
    </div>
  );
}
