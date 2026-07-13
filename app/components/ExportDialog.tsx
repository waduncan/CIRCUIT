import { useMemo, useState } from "react";
import { diagramBounds, exportDiagramSvg, type ExportBackground } from "../model/exportSvg";
import type { Project } from "../model/types";
import { downloadJson, downloadSvg } from "../utils/download";
import { printableInches, printSvgDocument, svgPixelSize, tileGrid, type Orientation, type Paged, type PageSize } from "../utils/printDocument";

type ExportDialogProps = {
  project: Project;
  onClose: () => void;
  onToast: (message: string) => void;
};

const PAGE_SIZES: PageSize[] = ["Fit", "Letter", "A4", "A3", "Tabloid", "Custom"];
const PAGE_LABEL: Record<PageSize, string> = { Fit: "Fit to diagram (single page)", Letter: "Letter", A4: "A4", A3: "A3", Tabloid: "Tabloid", Custom: "Custom (oversized)" };

export function ExportDialog({ project, onClose, onToast }: ExportDialogProps) {
  const [format, setFormat] = useState<"svg" | "pdf" | "json">("pdf");
  const [background, setBackground] = useState<ExportBackground>("white");
  const [includeTitle, setIncludeTitle] = useState(true);
  const [includeLegend, setIncludeLegend] = useState(true);
  const [pageSize, setPageSize] = useState<PageSize>("Fit");
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [marginIn, setMarginIn] = useState(0.4);
  const [tiled, setTiled] = useState(false);
  const [pagesWide, setPagesWide] = useState(2);
  const [customW, setCustomW] = useState(36);
  const [customH, setCustomH] = useState(24);

  const svg = useMemo(
    () => exportDiagramSvg(project, { background, includeTitle, includeLegend }),
    [project, background, includeTitle, includeLegend],
  );

  const slug = project.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "diagram";
  const bounds = diagramBounds(project);
  const aspect = (bounds.maxX - bounds.minX) / Math.max(1, bounds.maxY - bounds.minY);
  const paged = pageSize !== "Fit";
  const wideWarning = format === "pdf" && paged && !tiled && aspect > 1.4 && orientation === "portrait";
  const customIn: [number, number] = [customW, customH];
  const grid = paged && tiled
    ? (() => {
        const { width, height } = svgPixelSize(svg);
        const [pw, ph] = printableInches(pageSize as Paged, orientation, marginIn, customIn);
        return tileGrid(width, height, pw, ph, pagesWide);
      })()
    : null;

  const handleExport = () => {
    if (format === "svg") { downloadSvg(svg, `${slug}.svg`); onToast("SVG exported."); onClose(); return; }
    if (format === "json") { downloadJson(project, `${slug}.json`); onToast("Project JSON exported."); onClose(); return; }
    printSvgDocument(svg, { pageSize, orientation, marginIn, customIn, tilePagesWide: paged && tiled ? pagesWide : 0 });
    onToast(grid ? `Opening print — ${grid.cols * grid.rows} pages to assemble.` : "Opening print dialog — choose “Save as PDF”.");
  };

  return (
    <div className="modal-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal export-modal">
        <div className="modal-header">
          <div><span className="eyebrow">Share</span><h2>Export diagram</h2><p>Vector output — text and lines stay sharp at any size. No cloud services used.</p></div>
          <button onClick={onClose} aria-label="Close export">×</button>
        </div>
        <div className="export-body">
          <div className="export-preview" aria-label="Export preview" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="export-controls">
            <label>Format
              <select value={format} onChange={(event) => setFormat(event.target.value as typeof format)}>
                <option value="pdf">PDF (print)</option>
                <option value="svg">SVG (vector file)</option>
                <option value="json">Project JSON</option>
              </select>
            </label>

            {format !== "json" && (
              <>
                <label>Background
                  <select value={background} onChange={(event) => setBackground(event.target.value as ExportBackground)}>
                    <option value="white">White</option>
                    <option value="transparent">Transparent</option>
                  </select>
                </label>
                <label className="export-check"><input type="checkbox" checked={includeTitle} onChange={(event) => setIncludeTitle(event.target.checked)} />Title block</label>
                <label className="export-check"><input type="checkbox" checked={includeLegend} onChange={(event) => setIncludeLegend(event.target.checked)} />Legend</label>
              </>
            )}

            {format === "pdf" && (
              <>
                <label>Page size
                  <select value={pageSize} onChange={(event) => setPageSize(event.target.value as PageSize)}>
                    {PAGE_SIZES.map((size) => <option key={size} value={size}>{PAGE_LABEL[size]}</option>)}
                  </select>
                </label>
                {paged && (
                  <>
                    {pageSize === "Custom" ? (
                      <div className="field-row">
                        <label>Width (in)
                          <input type="number" min={1} max={200} step={0.5} value={customW} onChange={(event) => setCustomW(Math.max(1, Number(event.target.value) || 1))} />
                        </label>
                        <label>Height (in)
                          <input type="number" min={1} max={200} step={0.5} value={customH} onChange={(event) => setCustomH(Math.max(1, Number(event.target.value) || 1))} />
                        </label>
                      </div>
                    ) : (
                      <label>Orientation
                        <select value={orientation} onChange={(event) => setOrientation(event.target.value as Orientation)}>
                          <option value="landscape">Landscape</option>
                          <option value="portrait">Portrait</option>
                        </select>
                      </label>
                    )}
                    <label>Margin (in)
                      <input type="number" min={0} max={2} step={0.1} value={marginIn} onChange={(event) => setMarginIn(Math.max(0, Number(event.target.value) || 0))} />
                    </label>
                    <label className="export-check"><input type="checkbox" checked={tiled} onChange={(event) => setTiled(event.target.checked)} />Tile across multiple pages (poster)</label>
                    {tiled && (
                      <>
                        <label>Pages wide
                          <select value={pagesWide} onChange={(event) => setPagesWide(Number(event.target.value))}>
                            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </label>
                        {grid && <p className="export-hint">Prints <b>{grid.cols} × {grid.rows} = {grid.cols * grid.rows} pages</b> to trim and tape together. Each is labelled R·C.</p>}
                      </>
                    )}
                  </>
                )}
                {wideWarning && <p className="export-warn">This diagram is wide — Landscape, tiling, or “Fit to diagram” will use the sheet better (portrait leaves large empty bands).</p>}
                <p className="export-hint">PDF uses your browser’s print dialog. Choose <b>Save as PDF</b> as the destination.</p>
              </>
            )}

            <button className="button primary full" onClick={handleExport}>
              {format === "pdf" ? "Print to PDF…" : format === "svg" ? "Download SVG" : "Download JSON"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
