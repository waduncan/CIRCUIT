import { useMemo, useState, type ChangeEvent, type CSSProperties, type RefObject } from "react";
import { icons, primitiveLibrary } from "../model/catalog";
import type { LibraryItem, PrimitiveKind } from "../model/types";

interface ObjectLibraryViewProps {
  items: LibraryItem[];
  customItems: LibraryItem[];
  newTemplateName: string;
  newTemplateKind: PrimitiveKind;
  libraryInputRef: RefObject<HTMLInputElement | null>;
  onTemplateNameChange: (name: string) => void;
  onTemplateKindChange: (kind: PrimitiveKind) => void;
  onCreateTemplate: () => void;
  onRemoveTemplate: (id: string) => void;
  onExportLibrary: () => void;
  onImportLibrary: (file: File) => void;
  onReturnToDiagram: () => void;
}

export function ObjectLibraryView({ items, customItems, newTemplateName, newTemplateKind, libraryInputRef, onTemplateNameChange, onTemplateKindChange, onCreateTemplate, onRemoveTemplate, onExportLibrary, onImportLibrary, onReturnToDiagram }: ObjectLibraryViewProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredItems = useMemo(() => normalizedQuery
    ? items.filter((item) => [item.name, item.description, item.kind, ...item.capabilities].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)))
    : items, [items, normalizedQuery]);
  const customIds = useMemo(() => new Set(customItems.map((item) => item.id)), [customItems]);

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onImportLibrary(file);
    event.target.value = "";
  };

  return (
    <section className="object-library-view" aria-labelledby="object-library-title">
      <div className="library-view-header">
        <div><span className="eyebrow">Reusable assets</span><h1 id="object-library-title">Object library</h1><p>Create and manage the objects available to this project.</p></div>
        <button className="button secondary" onClick={onReturnToDiagram}>Return to diagram</button>
      </div>
      <div className="library-view-content">
        <div className="library-catalog">
          <div className="library-catalog-toolbar">
            <label className="library-view-search">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search objects, capabilities, or types" aria-label="Search object library" /></label>
            <span>{filteredItems.length} of {items.length} objects</span>
          </div>
          {filteredItems.length ? <div className="template-grid library-view-grid">{filteredItems.map((item) => (
            <article className="template-card" key={item.id}>
              <div className="library-icon" style={{ "--accent": item.color } as CSSProperties}>{icons[item.kind]}</div>
              <strong>{item.name}</strong><span>{item.description}</span>
              <div>{item.capabilities.map((capability) => <i key={capability}>{capability}</i>)}</div>
              {customIds.has(item.id) && <button onClick={() => onRemoveTemplate(item.id)} aria-label={`Remove ${item.name}`}>Remove</button>}
            </article>
          ))}</div> : <div className="library-empty"><strong>No objects found</strong><span>Try a different search term.</span></div>}
        </div>
        <aside className="template-builder library-view-builder">
          <span className="eyebrow">Build</span><h2>Create custom object</h2><p>Start from a primitive, then configure each instance after adding it to the diagram.</p>
          <label>Object name<input placeholder="e.g. Cardiology Archive" value={newTemplateName} onChange={(event) => onTemplateNameChange(event.target.value)} /></label>
          <label>Starting primitive<select value={newTemplateKind} onChange={(event) => onTemplateKindChange(event.target.value as PrimitiveKind)}>{primitiveLibrary.map((item) => <option key={item.kind} value={item.kind}>{item.name}</option>)}</select></label>
          <button className="button primary full" disabled={!newTemplateName.trim()} onClick={onCreateTemplate}>Create object template</button>
          <hr /><h3>Library data</h3><p>Move your project-specific custom objects between browsers using JSON.</p>
          <button className="button secondary full" onClick={onExportLibrary}>Export custom library</button>
          <button className="button ghost full" onClick={() => libraryInputRef.current?.click()}>Import library JSON</button>
          <input ref={libraryInputRef} type="file" accept="application/json" hidden onChange={handleImport} />
        </aside>
      </div>
    </section>
  );
}
