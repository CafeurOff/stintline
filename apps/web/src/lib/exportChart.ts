/**
 * Chart exports for people who reuse our figures (a video, a post): the chart as a PNG with
 * its title, source and our name, and its data as CSV. Everything happens in the browser.
 */

/** Pixel density of the exported picture (sharp on a 4K video timeline). */
const PNG_SCALE = 2;
/** Room for the title above the chart and the credit below it, in CSS pixels. */
const HEADER_PX = 56;
const FOOTER_PX = 36;
const SIDE_PX = 24;
/** Space kept under the chart for an axis title drawn past its bottom edge. */
const OVERHANG_PX = 16;

/** Turns `var(--x)` in an attribute into the colour it stands for right now. */
function resolveVars(value: string, styles: CSSStyleDeclaration): string {
  return value.replace(/var\((--[\w-]+)\)/g, (_, name: string) =>
    styles.getPropertyValue(name).trim(),
  );
}

const PAINT_ATTRIBUTES = ["fill", "stroke", "stop-color", "color"] as const;

/** A standalone copy of a chart's SVG: theme colours written in, size fixed. */
export function standaloneSvg(svg: SVGSVGElement): {
  markup: string;
  width: number;
  height: number;
} {
  const styles = getComputedStyle(document.documentElement);
  const box = svg.getBoundingClientRect();
  const width = Math.round(box.width || Number(svg.getAttribute("width")) || 800);
  // Axis titles hang just below the drawing on the page: keep room for them.
  const height = Math.round(box.height || Number(svg.getAttribute("height")) || 400) + OVERHANG_PX;
  const copy = svg.cloneNode(true);
  if (!(copy instanceof SVGSVGElement)) throw new Error("not an svg");
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", String(width));
  copy.setAttribute("height", String(height));
  for (const element of [copy, ...copy.querySelectorAll("*")]) {
    for (const name of PAINT_ATTRIBUTES) {
      const value = element.getAttribute(name);
      if (value?.includes("var(")) element.setAttribute(name, resolveVars(value, styles));
    }
    const inline = element.getAttribute("style");
    if (inline?.includes("var(")) element.setAttribute("style", resolveVars(inline, styles));
  }
  return { markup: new XMLSerializer().serializeToString(copy), width, height };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error("the chart could not be drawn"));
    };
    image.src = url;
  });
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

/** "Race pace: Brazilian Grand Prix" → "race-pace-brazilian-grand-prix". */
export function fileSlug(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "stintline-chart";
}

/** The chart on the page background, with its title above and the credit below. */
export async function chartPng(svg: SVGSVGElement, title: string, credit: string): Promise<Blob> {
  const { markup, width, height } = standaloneSvg(svg);
  const styles = getComputedStyle(document.documentElement);
  const colour = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`);
  const canvas = document.createElement("canvas");
  const fullWidth = width + SIDE_PX * 2;
  const fullHeight = height + HEADER_PX + FOOTER_PX;
  canvas.width = fullWidth * PNG_SCALE;
  canvas.height = fullHeight * PNG_SCALE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.scale(PNG_SCALE, PNG_SCALE);
  context.fillStyle = colour("--color-bg", "#0b0b0d");
  context.fillRect(0, 0, fullWidth, fullHeight);
  context.fillStyle = colour("--color-ink", "#f2f2f4");
  context.font = "800 20px Archivo, system-ui, sans-serif";
  context.fillText(title, SIDE_PX, 34);
  context.drawImage(image, SIDE_PX, HEADER_PX, width, height);
  context.fillStyle = colour("--color-muted", "#9a9cab");
  context.font = "500 12px Archivo, system-ui, sans-serif";
  context.fillText(credit, SIDE_PX, fullHeight - 14);
  context.textAlign = "right";
  context.font = "800 13px Archivo, system-ui, sans-serif";
  context.fillStyle = colour("--color-mark-text", "#ff5a66");
  context.fillText("StintLine", fullWidth - SIDE_PX, fullHeight - 14);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("the picture could not be made"));
    }, "image/png");
  });
}

/** Byte order mark: Excel then reads the file as UTF-8 (accents in names). */
const BOM = "\uFEFF";

/** RFC 4180 CSV: quotes around values that need them, CRLF line ends, a BOM for Excel. */
export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  const cell = (value: string | number | null | undefined) => {
    if (value == null) return "";
    const text = String(value);
    return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `${BOM}${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
