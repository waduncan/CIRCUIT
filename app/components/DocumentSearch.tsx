import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { selectionBreadcrumb, resultSelection, type SearchResult, type SearchResultType } from "../model/search";
import type { Project } from "../model/types";

type DocumentSearchProps = {
  project: Project;
  open: boolean;
  query: string;
  setQuery: (value: string) => void;
  results: SearchResult[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  focusResult: (result: SearchResult) => void;
  focusActive: () => void;
  next: () => void;
  previous: () => void;
  closeSearch: () => void;
};

const TYPE_LABEL: Record<SearchResultType, string> = { node: "Node", port: "Port", container: "Area", connection: "Link", process: "Flow" };

export function DocumentSearch({ project, open, query, setQuery, results, activeIndex, setActiveIndex, focusResult, focusActive, next, previous, closeSearch }: DocumentSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // "started" tracks whether the user has committed to a result yet, so the first Enter focuses the
  // top match and later Enters advance through matches.
  const [started, setStarted] = useState(false);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { setStarted(false); }, [query]);

  if (!open) return null;

  const commit = (result: SearchResult, index: number) => { setStarted(true); setActiveIndex(index); focusResult(result); };
  const active = results[activeIndex];
  const breadcrumb = active ? selectionBreadcrumb(project, resultSelection(active)) : [];

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!results.length) return;
      if (!started) { setStarted(true); focusActive(); }
      else if (event.shiftKey) previous();
      else next();
    } else if (event.key === "ArrowDown") { event.preventDefault(); setStarted(true); next(); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setStarted(true); previous(); }
    else if (event.key === "Escape") { event.preventDefault(); closeSearch(); }
  };

  return (
    <div className="doc-find" role="search">
      <div className="doc-find-bar">
        <span className="doc-find-icon" aria-hidden>⌕</span>
        <input
          ref={inputRef}
          className="doc-find-input"
          placeholder="Find nodes, ports, endpoints, containers…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Search document"
        />
        <span className="doc-find-count">{results.length ? `${activeIndex + 1} / ${results.length}` : query ? "No matches" : ""}</span>
        <button className="doc-find-step" onClick={previous} disabled={results.length < 2} aria-label="Previous match" title="Previous (Shift+Enter)">↑</button>
        <button className="doc-find-step" onClick={next} disabled={results.length < 2} aria-label="Next match" title="Next (Enter)">↓</button>
        <button className="doc-find-close" onClick={closeSearch} aria-label="Close search" title="Close (Esc)">×</button>
      </div>
      {started && breadcrumb.length > 0 && (
        <div className="doc-find-breadcrumb">{breadcrumb.map((crumb, index) => <span key={`${crumb}-${index}`}>{crumb}{index < breadcrumb.length - 1 && <b>/</b>}</span>)}</div>
      )}
      {query && (
        <ul className="doc-find-results" role="listbox">
          {results.map((result, index) => (
            <li key={`${result.type}-${result.id}`} role="option" aria-selected={index === activeIndex}>
              <button className={`doc-find-result ${index === activeIndex && started ? "active" : ""}`} onClick={() => commit(result, index)}>
                <span className={`doc-find-badge type-${result.type}`}>{TYPE_LABEL[result.type]}</span>
                <span className="doc-find-copy"><strong>{result.label}</strong><small>{result.sublabel}</small></span>
                <span className="doc-find-field">{result.field}</span>
              </button>
            </li>
          ))}
          {!results.length && <li className="doc-find-empty">Nothing matches “{query}”.</li>}
        </ul>
      )}
    </div>
  );
}
