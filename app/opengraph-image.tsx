// Imaginea implicită de preview la share (WhatsApp/LinkedIn/X) pentru toate paginile care nu își setează
// propria `openGraph.images` (ex. /s/[id] folosește thumbnail-ul schiței). Generată static la build.
// Fontul implicit din next/og (Geist) acoperă diacriticele românești.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const alt = "DETALIA — Detaliile bune se construiesc împreună";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logo = await readFile(join(process.cwd(), "public/logo.svg"), "base64");

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#faf8f4",
          borderBottom: "16px solid #a9573a",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse randează doar <img> simplu */}
        <img src={`data:image/svg+xml;base64,${logo}`} width={480} height={121} alt="" />
        <div style={{ marginTop: 56, fontSize: 64, color: "#211d18", lineHeight: 1.15 }}>
          Detaliile bune se construiesc împreună.
        </div>
        <div style={{ marginTop: 24, fontSize: 32, color: "#5d564c" }}>
          Comunitatea profesională din construcții, organizată în jurul detaliului de execuție.
        </div>
      </div>
    ),
    size,
  );
}
