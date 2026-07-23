import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { ProjectCommand } from "../model/commands";
import { alignMoves, distributeMoves, movablesFromRefs, type AlignEdge, type DistributeAxis } from "../model/arrange";
import { cloneMovables } from "../model/clipboard";
import type { Project, Selection, SelectionRef } from "../model/types";

type Options = {
  project: Project;
  selection: Selection;
  setSelection: Dispatch<SetStateAction<Selection>>;
  dispatch: (command: ProjectCommand, coalesceKey?: string) => void;
  showToast: (message: string) => void;
};

const same = (a: SelectionRef, b: SelectionRef) => a.type === b.type && a.id === b.id;

// Multi-selection set + arrange/duplicate/delete for movable objects (nodes + containers), issue #10.
// The single `selection` still drives the properties inspector; this set drives group operations and
// stays in sync with it.
export function useSelectionSet({ project, selection, setSelection, dispatch, showToast }: Options) {
  const [selectedRefs, setSelectedRefs] = useState<SelectionRef[]>([]);

  const isSelected = useCallback((type: SelectionRef["type"], id: string) => selectedRefs.some((ref) => ref.type === type && ref.id === id), [selectedRefs]);

  // Keep the set consistent when the primary selection changes elsewhere (single-click via the drag
  // handlers, a connection/process selection, or a clear).
  useEffect(() => {
    if (!selection || selection.type === "connection" || selection.type === "process") {
      setSelectedRefs((prev) => (prev.length ? [] : prev));
      return;
    }
    const ref: SelectionRef = { type: selection.type, id: selection.id };
    setSelectedRefs((prev) => (prev.some((item) => same(item, ref)) ? prev : [ref]));
  }, [selection]);

  // Pointer-down selection. Returns the refs that should move together for this gesture.
  const selectAtPointer = useCallback((ref: SelectionRef, additive: boolean): SelectionRef[] => {
    if (additive) {
      const has = selectedRefs.some((item) => same(item, ref));
      const next = has ? selectedRefs.filter((item) => !same(item, ref)) : [...selectedRefs, ref];
      setSelectedRefs(next);
      setSelection(next.length ? (has ? next[next.length - 1] : ref) : null);
      return next;
    }
    // No modifier: if the grabbed object is already part of a multi-selection, keep the group.
    if (selectedRefs.length > 1 && selectedRefs.some((item) => same(item, ref))) {
      setSelection(ref);
      return selectedRefs;
    }
    setSelectedRefs([ref]);
    setSelection(ref);
    return [ref];
  }, [selectedRefs, setSelection]);

  const replaceRefs = useCallback((refs: SelectionRef[]) => {
    setSelectedRefs(refs);
    setSelection(refs.length ? refs[refs.length - 1] : null);
  }, [setSelection]);

  const align = useCallback((edge: AlignEdge) => {
    const moves = alignMoves(movablesFromRefs(project, selectedRefs), edge);
    if (moves.length) dispatch({ type: "objects.arrange", moves });
  }, [project, selectedRefs, dispatch]);

  const distribute = useCallback((axis: DistributeAxis) => {
    const moves = distributeMoves(movablesFromRefs(project, selectedRefs), axis);
    if (moves.length) dispatch({ type: "objects.arrange", moves });
  }, [project, selectedRefs, dispatch]);

  const duplicate = useCallback(() => {
    if (!selectedRefs.length) return;
    const clone = cloneMovables(project, selectedRefs, { x: 32, y: 32 });
    if (!clone.refs.length) return;
    dispatch({ type: "objects.add", nodes: clone.nodes, containers: clone.containers });
    setSelectedRefs(clone.refs);
    setSelection(clone.refs[clone.refs.length - 1] ?? null);
    showToast(`Duplicated ${clone.refs.length} object${clone.refs.length === 1 ? "" : "s"}.`);
  }, [project, selectedRefs, dispatch, setSelection, showToast]);

  const removeSelected = useCallback(() => {
    if (selectedRefs.length) {
      dispatch({ type: "objects.delete", refs: selectedRefs });
      setSelectedRefs([]);
      setSelection(null);
      showToast(`Removed ${selectedRefs.length} object${selectedRefs.length === 1 ? "" : "s"}.`);
    } else if (selection && (selection.type === "connection" || selection.type === "process")) {
      dispatch({ type: "selection.delete", selection });
      setSelection(null);
      showToast("Removed from the project.");
    }
  }, [selectedRefs, selection, dispatch, setSelection, showToast]);

  const selectAll = useCallback(() => {
    replaceRefs([
      ...project.containers.map((container) => ({ type: "container" as const, id: container.id })),
      ...project.nodes.map((node) => ({ type: "node" as const, id: node.id })),
    ]);
  }, [project, replaceRefs]);

  // Editing shortcuts — ignored while a form field is focused.
  useEffect(() => {
    const isTyping = () => {
      const element = document.activeElement as HTMLElement | null;
      return !!element && (element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.tagName === "SELECT" || element.isContentEditable);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping()) return;
      const mod = event.ctrlKey || event.metaKey;
      if ((event.key === "Delete" || event.key === "Backspace") && (selectedRefs.length || selection)) { event.preventDefault(); removeSelected(); }
      else if (mod && event.key.toLowerCase() === "d") { event.preventDefault(); duplicate(); }
      else if (mod && event.key.toLowerCase() === "a") { event.preventDefault(); selectAll(); }
      else if (event.key === "Escape" && selectedRefs.length) { setSelectedRefs([]); setSelection(null); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedRefs, selection, removeSelected, duplicate, selectAll, setSelection]);

  return { selectedRefs, count: selectedRefs.length, isSelected, selectAtPointer, replaceRefs, align, distribute, duplicate, removeSelected };
}
