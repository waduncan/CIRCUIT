import { useCallback, useEffect, useState } from "react";
import { applyProjectCommand, type ProjectCommand } from "../model/commands";
import { createDemoProject, migrateProjectDocument, STORAGE_KEY } from "../model/project";
import type { Project } from "../model/types";

// Number of undo steps retained. Snapshots are cheap (structural sharing via the
// immutable command reducer), but cap history so long sessions can't grow unbounded.
const HISTORY_LIMIT = 100;

// `pendingKey` identifies the gesture/edit that produced the current `present`. When a new
// update carries the same key it continues that gesture (a drag, a color slider, a typed word)
// and replaces `present` in place instead of adding a step — so one gesture is one undo.
type History = { past: Project[]; present: Project; future: Project[]; pendingKey?: string };

function commit(history: History, next: Project, coalesceKey?: string): History {
  if (next === history.present) return history;
  if (coalesceKey !== undefined && coalesceKey === history.pendingKey) {
    return { ...history, present: next };
  }
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    pendingKey: coalesceKey,
  };
}

export function useProjectDocument() {
  const [history, setHistory] = useState<History>(() => ({ past: [], present: createDemoProject(), future: [] }));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: unknown = JSON.parse(saved);
        const migrated = migrateProjectDocument(parsed);
        // A restored document is the starting point of the session, not an undoable edit.
        if (migrated) setHistory({ past: [], present: migrated, future: [] });
      } catch {
        // Retain the demo when local data is invalid.
      }
    }
    setHydrated(true);
  }, []);

  const project = history.present;

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...project, updatedAt: new Date().toISOString() }));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [project, hydrated]);

  // `coalesceKey` groups a continuous gesture (drag, slider, typed word) into a single undo step.
  const dispatch = useCallback((command: ProjectCommand, coalesceKey?: string) => {
    setHistory((current) => commit(current, applyProjectCommand(current.present, command), coalesceKey));
  }, []);

  // Opening, creating, or loading a document is a new-document boundary that resets history.
  const setProject = useCallback((next: Project) => {
    setHistory({ past: [], present: next, future: [] });
  }, []);

  const undo = useCallback(() => {
    setHistory((current) => {
      if (!current.past.length) return current;
      const previous = current.past[current.past.length - 1];
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
        pendingKey: undefined,
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((current) => {
      if (!current.future.length) return current;
      const [next, ...rest] = current.future;
      return {
        past: [...current.past, current.present],
        present: next,
        future: rest,
        pendingKey: undefined,
      };
    });
  }, []);

  // Keyboard history shortcuts. Skipped while typing so native text undo keeps working.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) { event.preventDefault(); undo(); }
      else if ((key === "z" && event.shiftKey) || key === "y") { event.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  return {
    project,
    setProject,
    dispatch,
    hydrated,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
