import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { resultBounds, resultSelection, searchProject, type SearchResult } from "../model/search";
import { expandBounds } from "../model/viewport";
import type { Bounds, Project, Selection } from "../model/types";

type DocumentNavigationOptions = {
  project: Project;
  setSelection: Dispatch<SetStateAction<Selection>>;
  fitBounds: (bounds: Bounds) => void;
};

// Owns document-search + focus state for issue #13, keeping the shell thin. Focusing a result only
// changes selection and the viewport (fitBounds) — it never dispatches a command, so navigation
// cannot alter document geometry.
export function useDocumentNavigation({ project, setSelection, fitBounds }: DocumentNavigationOptions) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => searchProject(project, query), [project, query]);
  useEffect(() => { setActiveIndex(0); }, [query]);

  const focusResult = useCallback((result: SearchResult) => {
    setSelection(resultSelection(result));
    const bounds = resultBounds(project, result);
    if (bounds && (bounds.width || bounds.height)) fitBounds(expandBounds(bounds, 80));
  }, [project, setSelection, fitBounds]);

  const focusIndex = useCallback((index: number) => {
    if (!results.length) return;
    const next = (index + results.length) % results.length;
    setActiveIndex(next);
    focusResult(results[next]);
  }, [results, focusResult]);

  const next = useCallback(() => focusIndex(activeIndex + 1), [focusIndex, activeIndex]);
  const previous = useCallback(() => focusIndex(activeIndex - 1), [focusIndex, activeIndex]);
  const focusActive = useCallback(() => { if (results[activeIndex]) focusResult(results[activeIndex]); }, [results, activeIndex, focusResult]);

  const openSearch = useCallback(() => setOpen(true), []);
  const closeSearch = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return { open, openSearch, closeSearch, query, setQuery, results, activeIndex, setActiveIndex, focusResult, focusActive, next, previous };
}
