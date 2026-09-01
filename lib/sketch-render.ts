// Randare stroke-uri (client-only — folosește Path2D din browser). Partajat de editor și de afișarea teancului.
// Coordonatele sunt normalizate 0..1 față de imaginea-mamă; grosimea e px la lățimea de referință.
import { getStroke } from "perfect-freehand";

import { UNIT_EXTENT, type SketchExtent, type Stroke } from "@/server/domain/sketch";

// Lățimea de referință față de care e exprimată grosimea unui stroke (rezoluție-agnostic).
export const REFERENCE_WIDTH = 1000;

// Lățimea la care se exportă o schiță (thumbnail „Trimite în Planșă"): urmează imaginea-mamă, plafonată
// la limita serverului — NU `REFERENCE_WIDTH`, care e doar reperul de normalizare a stroke-urilor
// (`scale = width/REFERENCE_WIDTH` mai jos), independent de rezoluția de ieșire. Fără imagine-mamă (foaie
// goală, `naturalWidth` null), n-avem ce rezoluție să urmăm → `fallback` (de regulă REFERENCE_WIDTH).
// BUG găsit 2026-08-18: exportul se făcea mereu la `REFERENCE_WIDTH` (1000px) chiar și cu o imagine-mamă
// de până la 4096px — pierdere de rezoluție la fiecare refolosire prin schiță.
export function resolveExportWidth(naturalWidth: number | null, fallback: number, cap: number): number {
  return naturalWidth == null ? fallback : Math.min(naturalWidth, cap);
}

const STROKE_OPTIONS = {
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
  simulatePressure: true,
};

// Pentru casetele de text, `size` (8/16/28) e prea mic ca font lizibil → îl scalăm. Factor partajat
// cu input-ul flotant din editor ca textul fixat să apară la aceeași mărime cu cel tastat.
export const TEXT_FONT_SCALE = 2.4;
export const TEXT_FONT_FAMILY = "ui-sans-serif, system-ui, sans-serif";

// Convertește outline-ul perfect-freehand într-un SVG path (pt Path2D). Vezi docs perfect-freehand.
function svgPathFromOutline(points: number[][]): string {
  const len = points.length;
  if (len < 4) return "";
  const average = (a: number, b: number) => (a + b) / 2;
  let a = points[0];
  let b = points[1];
  const c = points[2];
  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(
    2,
  )} ${average(b[0], c[0]).toFixed(2)},${average(b[1], c[1]).toFixed(2)} T`;
  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i];
    b = points[i + 1];
    result += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(2)} `;
  }
  result += "Z";
  return result;
}

// Transformul normalizat→px pentru un canvas care acoperă `extent` (2026-09-01, pasteboard).
// UNIT_EXTENT = [0,1]×[0,1] → `toX(x) = x·width`, `scale = width/REFERENCE_WIDTH` (exact
// comportamentul de dinainte, byte-identic). Cu extent mai lat, punctele se mapează relativ la el,
// dar `scale` (grosime stroke / font text / vârf săgeată) rămâne legat de lățimea IMAGINII
// (`width/spanX`), nu a canvas-ului — un stroke peste imagine arată la fel indiferent cât s-a
// desenat în jur. Pur (fără canvas) — testat direct.
export function sketchTransform(width: number, height: number, extent: SketchExtent = UNIT_EXTENT) {
  const spanX = extent.maxX - extent.minX;
  const spanY = extent.maxY - extent.minY;
  const imageWidthPx = width / spanX;
  return {
    toX: (x: number) => ((x - extent.minX) / spanX) * width,
    toY: (y: number) => ((y - extent.minY) / spanY) * height,
    scale: imageWidthPx / REFERENCE_WIDTH,
  };
}

// Desenează o listă de stroke-uri pe un context 2D de dimensiune (width × height) în px.
// `extent`: vezi `sketchTransform`. Implicit UNIT_EXTENT → apelanții care nu-l trimit nu se schimbă.
export function renderStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  width: number,
  height: number,
  extent: SketchExtent = UNIT_EXTENT,
) {
  const t = sketchTransform(width, height, extent);
  const scale = t.scale;
  for (const s of strokes) {
    const size = s.size * scale;
    const points = s.points.map(([x, y]) => [t.toX(x), t.toY(y)]);

    if (s.kind === "text") {
      // Etichetă curată: text în culoarea aleasă cu un halou alb subțire pentru lizibilitate peste desen
      // (ca adnotările de pe planuri/CAD) — FĂRĂ casetă/bordură, ca să arate parte din schiță.
      const [x, y] = points[0] ?? [0, 0];
      const fontPx = s.size * scale * TEXT_FONT_SCALE;
      ctx.save();
      // Rotație opțională în jurul ancorei (points[0]): translatăm acolo, rotim, desenăm de la origine.
      if (s.angle) {
        ctx.translate(x, y);
        ctx.rotate(s.angle);
      } else {
        ctx.translate(x, y);
      }
      ctx.font = `600 ${fontPx}px ${TEXT_FONT_FAMILY}`;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.lineJoin = "round";
      const lines = (s.text ?? "").split("\n");
      const lineHeight = fontPx * 1.3;
      ctx.strokeStyle = "rgba(250,247,241,0.92)";
      ctx.lineWidth = Math.max(fontPx * 0.16, 2);
      lines.forEach((line, i) => ctx.strokeText(line, 0, i * lineHeight));
      ctx.fillStyle = s.color;
      lines.forEach((line, i) => ctx.fillText(line, 0, i * lineHeight));
      ctx.restore();
      continue;
    }

    // Forme cu 2 capete: primul + ultimul punct.
    if (s.kind === "line" || s.kind === "rect" || s.kind === "ellipse" || s.kind === "arrow") {
      const [x0, y0] = points[0] ?? [0, 0];
      const [x1, y1] = points[points.length - 1] ?? [x0, y0];
      ctx.strokeStyle = s.color;
      ctx.lineWidth = Math.max(size, 1);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (s.kind === "rect") {
        ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      } else if (s.kind === "ellipse") {
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(Math.abs(x1 - x0) / 2, 0.5), Math.max(Math.abs(y1 - y0) / 2, 0.5), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // line + arrow: segmentul de bază; săgeata adaugă vârful.
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        if (s.kind === "arrow") {
          const ang = Math.atan2(y1 - y0, x1 - x0);
          const head = Math.max(size * 3, 9 * scale);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x1 - head * Math.cos(ang - Math.PI / 6), y1 - head * Math.sin(ang - Math.PI / 6));
          ctx.moveTo(x1, y1);
          ctx.lineTo(x1 - head * Math.cos(ang + Math.PI / 6), y1 - head * Math.sin(ang + Math.PI / 6));
          ctx.stroke();
        }
      }
      continue;
    }

    if (points.length < 3) {
      // Un punct / linie foarte scurtă → desenăm un cerc (perfect-freehand n-ar produce outline).
      const [x, y] = points[0] ?? [0, 0];
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(size / 2, 1), 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    const outline = getStroke(points, { ...STROKE_OPTIONS, size });
    const path = svgPathFromOutline(outline);
    if (!path) continue;
    ctx.fillStyle = s.color;
    ctx.fill(new Path2D(path));
  }
}
