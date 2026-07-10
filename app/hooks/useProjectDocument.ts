import { useCallback, useEffect, useState } from "react";
import { applyProjectCommand, type ProjectCommand } from "../model/commands";
import { createDemoProject, migrateProjectDocument, STORAGE_KEY } from "../model/project";
import type { Project } from "../model/types";

export function useProjectDocument() {
  const [project, setProject] = useState<Project>(() => createDemoProject());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: unknown = JSON.parse(saved);
        const migrated = migrateProjectDocument(parsed);
        if (migrated) setProject(migrated);
      } catch {
        // Retain the demo when local data is invalid.
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...project, updatedAt: new Date().toISOString() }));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [project, hydrated]);

  const dispatch = useCallback((command: ProjectCommand) => {
    setProject((current) => applyProjectCommand(current, command));
  }, []);

  return { project, setProject, dispatch, hydrated };
}
