import type { AlignEdge, DistributeAxis } from "../model/arrange";

type SelectionActionsProps = {
  count: number;
  onAlign: (edge: AlignEdge) => void;
  onDistribute: (axis: DistributeAxis) => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

const ALIGN: Array<{ edge: AlignEdge; glyph: string; label: string }> = [
  { edge: "left", glyph: "⇤", label: "Align left" },
  { edge: "hcenter", glyph: "⇔", label: "Align horizontal centers" },
  { edge: "right", glyph: "⇥", label: "Align right" },
  { edge: "top", glyph: "⤒", label: "Align top" },
  { edge: "vcenter", glyph: "⇕", label: "Align vertical centers" },
  { edge: "bottom", glyph: "⤓", label: "Align bottom" },
];

// Floating toolbar for multi-object arrange (#10). Shown only when 2+ movable objects are selected.
export function SelectionActions({ count, onAlign, onDistribute, onDuplicate, onDelete }: SelectionActionsProps) {
  if (count < 2) return null;
  return (
    <div className="selection-actions" role="toolbar" aria-label="Arrange selection">
      <span className="selection-count">{count} selected</span>
      <span className="selection-actions-sep" />
      {ALIGN.map(({ edge, glyph, label }) => (
        <button key={edge} className="selection-action" onClick={() => onAlign(edge)} aria-label={label} title={label}>{glyph}</button>
      ))}
      <span className="selection-actions-sep" />
      <button className="selection-action" onClick={() => onDistribute("horizontal")} aria-label="Distribute horizontally" title="Distribute horizontally" disabled={count < 3}>⋯</button>
      <button className="selection-action" onClick={() => onDistribute("vertical")} aria-label="Distribute vertically" title="Distribute vertically" disabled={count < 3}>⋮</button>
      <span className="selection-actions-sep" />
      <button className="selection-action" onClick={onDuplicate} aria-label="Duplicate selection" title="Duplicate (Ctrl+D)">⧉</button>
      <button className="selection-action danger" onClick={onDelete} aria-label="Delete selection" title="Delete (Del)">🗑</button>
    </div>
  );
}
