// Print-quality PDF export with no third-party dependency: render the export SVG into a hidden
// iframe carrying @page rules, then invoke the browser's own print dialog where the user chooses
// "Save as PDF". The SVG's viewBox + preserveAspectRatio letterbox-fits content to the page, so
// nothing is clipped and text stays vector-sharp. Supports a single page (fit-to-diagram or a
// preset sheet) and multi-page tiling that splits the diagram into a grid of pages to assemble.

export type PageSize = "Letter" | "A4" | "A3" | "Tabloid" | "Fit" | "Custom";
export type Orientation = "portrait" | "landscape";
export type Paged = Exclude<PageSize, "Fit">;

export type PrintOptions = {
  pageSize: PageSize;
  orientation: Orientation;
  marginIn: number;
  customIn?: [number, number]; // sheet width/height in inches when pageSize is "Custom"
  tilePagesWide?: number; // when > 0 and pageSize is paged, tile across this many columns
};

// Portrait dimensions in inches.
const PAGE_INCHES: Record<Exclude<Paged, "Custom">, [number, number]> = {
  Letter: [8.5, 11],
  A4: [8.27, 11.69],
  A3: [11.69, 16.54],
  Tabloid: [11, 17],
};

export function svgPixelSize(svg: string): { width: number; height: number } {
  const width = Number(/(?:^|\s)width="(\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? 800);
  const height = Number(/(?:^|\s)height="(\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? 600);
  return { width, height };
}

// Physical sheet size in inches. Custom sheets are taken verbatim (their explicit width/height
// already encode orientation); presets are swapped for landscape.
export function pageInches(pageSize: Paged, orientation: Orientation, customIn?: [number, number]): [number, number] {
  if (pageSize === "Custom") {
    const [w, h] = customIn ?? [24, 36];
    return [Math.max(1, w), Math.max(1, h)];
  }
  const [pw, ph] = PAGE_INCHES[pageSize];
  return orientation === "landscape" ? [ph, pw] : [pw, ph];
}

// Printable area of a sheet after margins, in inches.
export function printableInches(pageSize: Paged, orientation: Orientation, marginIn: number, customIn?: [number, number]): [number, number] {
  const [w, h] = pageInches(pageSize, orientation, customIn);
  return [Math.max(1, w - marginIn * 2), Math.max(1, h - marginIn * 2)];
}

// Grid of tiles that covers a diagram at a given "pages wide", preserving aspect ratio so each
// tile's slice matches the page's printable aspect (no stretching) and tiles abut edge-to-edge.
export function tileGrid(
  diagramW: number,
  diagramH: number,
  printableW: number,
  printableH: number,
  pagesWide: number,
): { cols: number; rows: number; tileW: number; tileH: number } {
  const cols = Math.max(1, Math.floor(pagesWide));
  const tileW = diagramW / cols;
  const tileH = tileW * (printableH / printableW);
  const rows = Math.max(1, Math.ceil(diagramH / tileH));
  return { cols, rows, tileW, tileH };
}

// Re-open an SVG string with a fresh viewBox and CSS size, stripping the baked-in width/height.
function reframeSvg(svg: string, viewBox: string, styleCss: string): string {
  const gt = svg.indexOf(">");
  const open = svg
    .slice(0, gt + 1)
    .replace(/\swidth="[^"]*"/, "")
    .replace(/\sheight="[^"]*"/, "")
    .replace(/\sviewBox="[^"]*"/, "")
    .replace(/\spreserveAspectRatio="[^"]*"/, "")
    .replace(/<svg/, `<svg viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" style="${styleCss}"`);
  return open + svg.slice(gt + 1);
}

// A page-sized tile. Explicit width/height + box-sizing + overflow:hidden guarantees exactly one
// physical page per tile, so nothing spills onto interleaved blank pages. preserveAspectRatio on
// the inner SVG (width/height 100%) centres the content — no flexbox, which some engines mis-page.
function tile(inner: string, wIn: string, hIn: string, padIn: number, extra = ""): string {
  return `<div class="tile" style="width:${wIn}in;height:${hIn}in;padding:${padIn}in;">${inner}${extra}</div>`;
}

function buildPages(svg: string, options: PrintOptions): { page: string; body: string } {
  const { width, height } = svgPixelSize(svg);
  const svgStyle = "width:100%;height:100%;display:block;";

  if (options.pageSize === "Fit") {
    const wIn = (width / 96).toFixed(2);
    const hIn = (height / 96).toFixed(2);
    const inner = reframeSvg(svg, `0 0 ${width} ${height}`, svgStyle);
    return { page: `size: ${wIn}in ${hIn}in; margin: 0;`, body: tile(inner, wIn, hIn, 0) };
  }

  const [pageW, pageH] = pageInches(options.pageSize, options.orientation, options.customIn);
  const [printW, printH] = printableInches(options.pageSize, options.orientation, options.marginIn, options.customIn);
  const page = `size: ${pageW}in ${pageH}in; margin: 0;`;
  const pagesWide = options.tilePagesWide ?? 0;

  if (pagesWide < 1) {
    // Single preset page: fit the whole diagram into the printable area (letterboxed).
    const inner = reframeSvg(svg, `0 0 ${width} ${height}`, svgStyle);
    return { page, body: tile(inner, String(pageW), String(pageH), options.marginIn) };
  }

  // Tiled: one page per grid cell, aspect-preserved so cells abut cleanly.
  const { cols, rows, tileW, tileH } = tileGrid(width, height, printW, printH, pagesWide);
  const tiles: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const viewBox = `${(c * tileW).toFixed(2)} ${(r * tileH).toFixed(2)} ${tileW.toFixed(2)} ${tileH.toFixed(2)}`;
      const inner = `<div class="crop">${reframeSvg(svg, viewBox, svgStyle)}</div>`;
      const label = `<span class="tile-label">R${r + 1}·C${c + 1} (of ${rows}×${cols})</span>`;
      tiles.push(tile(inner, String(pageW), String(pageH), options.marginIn, label));
    }
  }
  return { page, body: tiles.join("") };
}

export function printSvgDocument(svg: string, options: PrintOptions): void {
  const { page, body } = buildPages(svg, options);

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { ${page} }
    html, body { margin: 0; padding: 0; }
    .tile { box-sizing: border-box; overflow: hidden; position: relative; break-after: page; page-break-after: always; }
    .tile:last-child { break-after: auto; page-break-after: auto; }
    .tile > svg { width: 100%; height: 100%; display: block; }
    .crop { width: 100%; height: 100%; box-sizing: border-box; border: 1px dashed #c8d2dc; overflow: hidden; }
    .crop > svg { width: 100%; height: 100%; display: block; }
    .tile-label { position: absolute; right: 4px; bottom: 3px; font: 700 8px system-ui, sans-serif; color: #94a3b2; }
  </style></head><body>${body}</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed; right:0; bottom:0; width:0; height:0; border:0; visibility:hidden;";
  document.body.appendChild(iframe);

  const cleanup = () => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); };
  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) { cleanup(); return; }
    win.focus();
    win.print();
    window.setTimeout(cleanup, 1000);
  };

  const doc = iframe.contentWindow?.document;
  if (!doc) { cleanup(); return; }
  doc.open();
  doc.write(html);
  doc.close();
}
