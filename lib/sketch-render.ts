// Randare stroke-uri (client-only — folosește Path2D din browser). Partajat de editor și de afișarea teancului.
// Coordonatele sunt normalizate 0..1 față de imaginea-mamă; grosimea e px la lățimea de referință.
import { getStroke } from "perfect-freehand";

import type { Stroke } from "@/server/domain/sketch";

// Lățimea de referință față de care e exprimată grosimea unui stroke (rezoluție-agnostic).
export const REFERENCE_WIDTH = 1000;

const STROKE_OPTIONS = {
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
  simulatePressure: true,
};

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

// Desenează o listă de stroke-uri pe un context 2D de dimensiune (width × height) în px.
export function renderStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  width: number,
  height: number,
) {
  const scale = width / REFERENCE_WIDTH;
  for (const s of strokes) {
    const size = s.size * scale;
    const points = s.points.map(([x, y]) => [x * width, y * height]);

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
