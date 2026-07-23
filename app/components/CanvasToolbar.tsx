import type { CanvasSettings } from "../model/types";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/app/components/ui/tooltip"

import { PiArrowUpRightBold, PiArrowUpLeftBold } from "react-icons/pi";


type CanvasToolbarProps = {
  canvas: CanvasSettings;
  zoom: number;
  connecting: boolean;
  panning: boolean;
  containerEditing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canFitSelection: boolean;
  breadcrumb: string[];
  snapToGrid: boolean;
  onToggleSnap: () => void;
  onFind: () => void;
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

function ToolbarTooltip({
  label,
  shortcut,
  children,
}: {
  label: string;
  shortcut?: string;
  children: React.ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>
        <span>{label}</span>
        {shortcut && <kbd>{shortcut}</kbd>}
      </TooltipContent>
    </Tooltip>
  );
}

export function CanvasToolbar(props: CanvasToolbarProps) {
  const { canvas, zoom, connecting, containerEditing, canUndo, canRedo, canFitSelection, panning, breadcrumb, snapToGrid } = props;
  return (
    <div className="canvas-toolbar">
      <div className="tool-group">

        <ToolbarTooltip label="Select" shortcut="V">
          <button className={`tool ${!containerEditing && !panning && !connecting ? "active" : ""}`} onClick={props.onSelect} aria-label="Select tool">
            <PiArrowUpLeftBold />
          </button>
        </ToolbarTooltip>

        <button className={`tool ${panning ? "active" : ""}`} onClick={props.onPan} aria-label="Pan tool">✋</button>

        <span className="tool-separator" />
        <ToolbarTooltip label="Connect" shortcut="C">
          <button className={`tool ${connecting ? "active-connect" : ""}`} onClick={props.onConnect} aria-label="Connect tool">
            <PiArrowUpRightBold />
          </button>
        </ToolbarTooltip>
        <button className="tool" onClick={props.onAddProcess} aria-label="Add process">◎</button>
        <button className={`tool container-tool ${containerEditing ? "active" : ""}`} onClick={props.onToggleContainers} aria-label="Edit containers" title="Container editing mode">▣</button>
        {containerEditing && <button className="tool" onClick={props.onAddContainer} aria-label="Add container" title="Add container">＋</button>}
        <span className="tool-separator" />
        <button className="tool" onClick={props.onUndo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">↺</button>
        <button className="tool" onClick={props.onRedo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Y)">↻</button>
        <span className="tool-separator" />
        <button className={`tool ${snapToGrid ? "active" : ""}`} onClick={props.onToggleSnap} aria-label="Toggle grid snapping" aria-pressed={snapToGrid} title={`Grid snapping: ${snapToGrid ? "on" : "off"}`}>⊞</button>
        <button className="tool" onClick={props.onFind} aria-label="Find in document" title="Find (Ctrl+F)">⌕</button>
      </div>
      <div className="canvas-crumb">{breadcrumb.length
        ? breadcrumb.map((crumb, index) => <span key={`${crumb}-${index}`}>{index > 0 && <b>/</b>}{index === breadcrumb.length - 1 ? <strong>{crumb}</strong> : crumb}</span>)
        : <><span>Logical Diagram</span><b>/</b><strong>Primary View</strong></>}</div>
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
