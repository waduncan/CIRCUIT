function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(data: unknown, fileName: string): void {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), fileName);
}

export function downloadSvg(svg: string, fileName: string): void {
  downloadBlob(new Blob([svg], { type: "image/svg+xml" }), fileName);
}
