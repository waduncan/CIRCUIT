import { capabilityConfig, icons, primitiveLibrary } from "./catalog";
import { connectionRoute, pointAlongRoute, portPosition, portTilePosition, svgPath } from "./routing";
import type { Capability, DiagramContainer, Project, SystemNode } from "./types";

// Pure, dependency-free renderer that serialises a Project into a standalone SVG document.
// Text is emitted as real <text> (stays sharp and selectable, never rasterised) and geometry
// mirrors the on-canvas editor so exports match what the user sees. Used for SVG download and,
// via the browser print path, for print-quality PDF.

export type ExportBackground = "white" | "transparent";

export type ExportSvgOptions = {
  background?: ExportBackground;
  padding?: number;
  includeTitle?: boolean;
  includeLegend?: boolean;
};

const FONT_STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const TITLE_BAND = 64;
const LEGEND_ROW = 22;

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Rough monospace-ish width estimate so long labels can be trimmed to fit their box.
function truncate(text: string, maxWidth: number, fontSize: number): string {
  const charWidth = fontSize * 0.62;
  const maxChars = Math.max(1, Math.floor(maxWidth / charWidth));
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(1, maxChars - 1))}…`;
}

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

function includePoint(bounds: Bounds, x: number, y: number): void {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
}

export function diagramBounds(project: Project): Bounds {
  const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const container of project.containers) {
    includePoint(bounds, container.x, container.y - 32);
    includePoint(bounds, container.x + container.width, container.y + container.height);
  }
  for (const node of project.nodes) {
    includePoint(bounds, node.x, node.y);
    includePoint(bounds, node.x + node.width, node.y + node.height);
    for (const port of node.ports) {
      const position = portTilePosition(project, node.id, port.id);
      includePoint(bounds, position.x - (port.width ?? 92) / 2 - 8, position.y - (port.height ?? 34) / 2 - 8);
      includePoint(bounds, position.x + (port.width ?? 92) / 2 + 8, position.y + (port.height ?? 34) / 2 + 8);
    }
  }
  for (const connection of project.connections) {
    const route = connectionRoute(project, connection);
    for (const point of route) includePoint(bounds, point.x, point.y);
    for (const label of connection.labels ?? []) {
      const anchor = pointAlongRoute(route, label.position, label.anchor === "segment" ? label.segmentIndex ?? 0 : undefined);
      includePoint(bounds, anchor.x + label.offsetX - 70, anchor.y + label.offsetY - 18);
      includePoint(bounds, anchor.x + label.offsetX + 70, anchor.y + label.offsetY + 18);
    }
  }
  if (!Number.isFinite(bounds.minX)) return { minX: 0, minY: 0, maxX: 400, maxY: 300 };
  return bounds;
}

function renderContainer(container: DiagramContainer): string {
  return [
    `<rect x="${container.x}" y="${container.y}" width="${container.width}" height="${container.height}" rx="12" fill="${esc(container.color)}" fill-opacity="${container.opacity}" stroke="${esc(container.color)}" stroke-opacity="0.62" stroke-width="2"/>`,
    `<text x="${container.x + 8}" y="${container.y - 12}" font-size="10" font-weight="800" letter-spacing="0.8" fill="${esc(container.color)}" fill-opacity="0.72">${esc(container.kind.toUpperCase())}</text>`,
    `<text x="${container.x + 68}" y="${container.y - 12}" font-size="12" font-weight="800" fill="${esc(container.color)}">${esc(container.name)}</text>`,
  ].join("");
}

function renderNode(node: SystemNode, project: Project): string {
  const presentation = project.presentation;
  const subtitle = node.composite?.headerLabel || primitiveLibrary.find((item) => item.kind === node.kind)?.name || "System";
  const parts: string[] = [];
  // Card + accent topline.
  parts.push(node.kind === "nestable" ? `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="8" fill="${esc(node.color)}" fill-opacity="0.05" stroke="${esc(node.color)}" stroke-width="2"/>` : presentation === "clean" ? `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="10" fill="${esc(node.color)}" fill-opacity="0.07" stroke="${esc(node.color)}" stroke-opacity="0.38"/>` : `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="10" fill="#ffffff" stroke="#ccd7e0"/>`);
  parts.push(`<rect x="${node.x + 10}" y="${node.y}" width="${node.width - 20}" height="4" rx="1.5" fill="${esc(node.color)}"/>`);
  if (node.kind === "nestable") {
    parts.push(`<rect x="${node.x}" y="${node.y}" width="${node.width}" height="36" fill="${esc(node.color)}" fill-opacity="0.12"/>`);
    parts.push(`<text x="${node.x + 12}" y="${node.y + 22}" font-size="12" font-weight="700" fill="#405468">${esc(truncate(node.name, node.width - 24, 12))}</text>`);
  } else if (presentation === "clean") {
    parts.push(`<text x="${node.x + node.width / 2}" y="${node.y + node.height / 2}" font-size="14" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="#30465b">${esc(truncate(node.name, node.width - 40, 14))}</text>`);
  } else {
  // Header: icon tile, name, subtitle.
  parts.push(`<rect x="${node.x + 12}" y="${node.y + 12}" width="38" height="38" rx="9" fill="${esc(node.color)}" fill-opacity="0.10" stroke="${esc(node.color)}" stroke-opacity="0.25"/>`);
  parts.push(`<text x="${node.x + 31}" y="${node.y + 37}" font-size="${node.composite ? 10 : 17}" font-weight="700" text-anchor="middle" fill="${esc(node.color)}">${esc(node.composite?.logoText || icons[node.kind])}</text>`);
  const textLeft = node.x + 59;
  const nameWidth = node.width - 59 - 16;
  parts.push(`<text x="${textLeft}" y="${node.y + 31}" font-size="12" font-weight="700" fill="#1f2d3a">${esc(truncate(node.name, nameWidth, 12))}</text>`);
  parts.push(`<text x="${textLeft}" y="${node.y + 46}" font-size="10" fill="#8794a1">${esc(truncate(subtitle, nameWidth, 10))}</text>`);
  // Capability chips.
  let chipX = node.x + 12;
  const chipY = node.y + 60;
  for (const capability of node.capabilities) {
    const color = capabilityConfig[capability].color;
    const chipW = capability.length * 6.2 + 12;
    if (chipX + chipW > node.x + node.width - 8) break;
    parts.push(`<rect x="${chipX}" y="${chipY}" width="${chipW.toFixed(1)}" height="18" rx="9" fill="${esc(color)}" fill-opacity="0.10" stroke="${esc(color)}" stroke-opacity="0.22"/>`);
    parts.push(`<text x="${(chipX + chipW / 2).toFixed(1)}" y="${chipY + 13}" font-size="10" font-weight="800" text-anchor="middle" fill="${esc(color)}">${esc(capability)}</text>`);
    chipX += chipW + 4;
  }
  parts.push(`<line x1="${node.x + 12}" y1="${node.y + 80}" x2="${node.x + node.width - 12}" y2="${node.y + 80}" stroke="#edf1f4"/>`);
  if (node.composite) {
    let contentY = node.y + 99;
    const contentBottom = node.y + node.height - (node.composite.footer ? 24 : 8);
    for (const section of node.composite.sections) {
      if (contentY + 18 > contentBottom) break;
      parts.push(`<text x="${node.x + 12}" y="${contentY}" font-size="10" font-weight="800" letter-spacing="0.4" fill="${esc(node.color)}">${esc(section.title.toUpperCase())}</text>`);
      contentY += 14;
      if (section.kind === "fields") {
        const columnWidth = (node.width - 30) / 2;
        section.fields.forEach((field, index) => {
          const column = index % 2;
          const row = Math.floor(index / 2);
          const x = node.x + 12 + column * (columnWidth + 6);
          const y = contentY + row * 27;
          if (y + 20 > contentBottom) return;
          parts.push(`<text x="${x}" y="${y}" font-size="10" fill="#83919f">${esc(truncate(field.label, columnWidth, 10))}</text>`);
          parts.push(`<text x="${x}" y="${y + 12}" font-size="10" font-weight="700" fill="#30465b">${esc(truncate(field.value || "—", columnWidth, 10))}</text>`);
        });
        contentY += Math.ceil(section.fields.length / 2) * 27 + 5;
      } else {
        for (const endpoint of section.endpoints) {
          if (contentY + 21 > contentBottom) break;
          parts.push(`<rect x="${node.x + 12}" y="${contentY - 10}" width="${node.width - 24}" height="20" rx="4" fill="#f8fafc" stroke="#e3e9ee"/>`);
          parts.push(`<text x="${node.x + 18}" y="${contentY + 4}" font-size="10" font-weight="700" fill="#30465b">${esc(truncate(endpoint.name, 70, 10))}</text>`);
          parts.push(`<text x="${node.x + 94}" y="${contentY + 4}" font-size="10" fill="#425b73">${esc(truncate(endpoint.address, 94, 10))}</text>`);
          parts.push(`<text x="${node.x + node.width - 12}" y="${contentY + 4}" font-size="10" text-anchor="end" fill="#8493a1">${esc(truncate(endpoint.details, 72, 10))}</text>`);
          contentY += 23;
        }
      }
    }
    if (node.composite.footer) {
      parts.push(`<rect x="${node.x}" y="${node.y + node.height - 22}" width="${node.width}" height="22" rx="0" fill="${esc(node.color)}" fill-opacity="0.06"/>`);
      parts.push(`<text x="${node.x + 12}" y="${node.y + node.height - 7}" font-size="10" font-weight="700" fill="#6f8192">${esc(truncate(node.composite.footer, node.width - 24, 10))}</text>`);
    }
  }
  }
  // Port tiles straddle the node boundary; the connection anchor sits on the outside edge.
  const localProject = { nodes: [node] };
  for (const port of node.ports.filter((port) => !node.nestedParentId || project.connections.some((connection) => connection.sourcePortId === port.id || connection.targetPortId === port.id))) {
    const pos = portTilePosition(localProject, node.id, port.id);
    const color = capabilityConfig[port.capability].color;
    const side = port.side ?? (port.direction === "inbound" ? "left" : "right");
    const width = port.width ?? 92; const height = port.height ?? 34;
    const tileX = pos.x - width / 2; const tileY = pos.y - height / 2;
    const anchorX = side === "left" ? tileX : side === "right" ? tileX + width : pos.x;
    const anchorY = side === "top" ? tileY : side === "bottom" ? tileY + height : pos.y;
    const label = truncate(port.name, width - 12, 10);
    parts.push(`<rect x="${tileX.toFixed(1)}" y="${tileY.toFixed(1)}" width="${width}" height="${height}" rx="5" fill="${esc(color)}" fill-opacity="0.12" stroke="${esc(color)}" stroke-width="1.5"/>`);
    parts.push(`<text x="${pos.x.toFixed(1)}" y="${(pos.y + (port.secondaryIdentifier ? -2 : 4)).toFixed(1)}" font-size="10" font-weight="700" text-anchor="middle" fill="#43586c">${esc(label)}</text>`);
    if (port.secondaryIdentifier) parts.push(`<text x="${pos.x.toFixed(1)}" y="${(pos.y + 10).toFixed(1)}" font-size="10" text-anchor="middle" fill="#718397">${esc(truncate(port.secondaryIdentifier, width - 12, 10))}</text>`);
    parts.push(`<circle cx="${anchorX.toFixed(1)}" cy="${anchorY.toFixed(1)}" r="6" fill="${esc(color)}" stroke="#ffffff" stroke-width="2"/>`);
  }
  return parts.join("");
}

function renderConnection(project: Project, connectionId: string): string {
  const connection = project.connections.find((item) => item.id === connectionId)!;
  const route = connectionRoute(project, connection);
  const path = svgPath(route);
  const style = connection.style ?? { lineStyle: "solid", width: 2.4, opacity: .72, arrowStyle: "none" };
  const color = style.color || capabilityConfig[connection.capability].color;
  const dash = style.lineStyle === "dashed" ? ` stroke-dasharray="10 7"` : style.lineStyle === "dotted" ? ` stroke-dasharray="2 6"` : "";
  const markers = `${style.arrowStyle === "start" || style.arrowStyle === "both" ? ` marker-start="url(#exportConnectionArrow)"` : ""}${style.arrowStyle === "end" || style.arrowStyle === "both" ? ` marker-end="url(#exportConnectionArrow)"` : ""}`;
  const parts = [`<path d="${path}" fill="none" stroke="${esc(color)}" stroke-width="${style.width}" stroke-opacity="${style.opacity}" stroke-linecap="square" stroke-linejoin="round"${dash}${markers}/>`];
  for (const label of connection.labels ?? []) {
    const anchor = pointAlongRoute(route, label.position, label.anchor === "segment" ? label.segmentIndex ?? 0 : undefined);
    const halfW = Math.max(24, label.text.length * 3.2 + 9);
    parts.push(`<g transform="translate(${(anchor.x + label.offsetX).toFixed(1)} ${(anchor.y + label.offsetY).toFixed(1)}) rotate(${label.rotation})">`);
    if (label.background) parts.push(`<rect x="${-halfW}" y="-12" width="${halfW * 2}" height="24" rx="6" fill="#ffffff" fill-opacity="0.96" stroke="#dce4ea"/>`);
    parts.push(`<text x="0" y="0" font-size="10" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="#516578">${esc(label.text)}</text></g>`);
  }
  return parts.join("");
}

function renderLegend(project: Project, x: number, y: number, width: number): string {
  const used: Capability[] = (Object.keys(capabilityConfig) as Capability[]).filter((capability) =>
    project.connections.some((connection) => connection.capability === capability) ||
    project.nodes.some((node) => node.capabilities.includes(capability)),
  );
  if (!used.length) return "";
  const parts: string[] = [`<text x="${x}" y="${y}" font-size="10" font-weight="800" fill="#516578">LEGEND</text>`];
  let itemX = x;
  const itemY = y + LEGEND_ROW;
  for (const capability of used) {
    const color = capabilityConfig[capability].color;
    parts.push(`<rect x="${itemX}" y="${itemY - 9}" width="12" height="12" rx="3" fill="${esc(color)}"/>`);
    parts.push(`<text x="${itemX + 18}" y="${itemY + 1}" font-size="10" fill="#516578">${esc(capability)}</text>`);
    itemX += Math.min(width, 60 + capability.length * 6);
  }
  return parts.join("");
}

export function exportDiagramSvg(project: Project, options: ExportSvgOptions = {}): string {
  const { background = "white", padding = 48, includeTitle = true, includeLegend = true } = options;
  const bounds = diagramBounds(project);
  const titleBand = includeTitle ? TITLE_BAND : 0;
  const legendBand = includeLegend ? LEGEND_ROW * 2 : 0;
  const contentW = bounds.maxX - bounds.minX;
  const contentH = bounds.maxY - bounds.minY;
  const totalW = Math.round(contentW + padding * 2);
  const totalH = Math.round(contentH + padding * 2 + titleBand + legendBand);
  const offsetX = padding - bounds.minX;
  const offsetY = padding + titleBand - bounds.minY;

  const layers: string[] = [];
  if (background === "white") layers.push(`<rect x="0" y="0" width="${totalW}" height="${totalH}" fill="#ffffff"/>`);
  if (includeTitle) {
    layers.push(`<text x="${padding}" y="${padding - 8}" font-size="20" font-weight="800" fill="#1f2d3a">${esc(project.name)}</text>`);
    const subtitle = `${project.nodes.length} systems · ${project.connections.length} connections`;
    layers.push(`<text x="${padding}" y="${padding + 14}" font-size="10" fill="#8794a1">${esc(subtitle)}</text>`);
  }
  layers.push(`<g transform="translate(${offsetX} ${offsetY})">`);
  for (const container of project.containers) layers.push(renderContainer(container));
  for (const connection of project.connections) layers.push(renderConnection(project, connection.id));
  for (const node of [...project.nodes].sort((a, b) => (a.kind === "nestable" ? -1 : 0) - (b.kind === "nestable" ? -1 : 0))) layers.push(renderNode(node, project));
  layers.push(`</g>`);
  if (includeLegend) layers.push(renderLegend(project, padding, totalH - padding - LEGEND_ROW, totalW - padding * 2));

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" font-family="${FONT_STACK}">`,
    `<defs><marker id="exportConnectionArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M 0 0 L 8 4 L 0 8 z" fill="context-stroke"/></marker></defs>`,
    layers.join("\n"),
    `</svg>`,
  ].join("\n");
}
