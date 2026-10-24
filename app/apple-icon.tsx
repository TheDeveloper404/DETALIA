// Iconița pentru iOS (ecran principal) — PNG generat static la build din app/icon.svg (iOS nu folosește SVG).
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const icon = await readFile(join(process.cwd(), "app/icon.svg"), "base64");

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf8f4",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse randează doar <img> simplu */}
        <img src={`data:image/svg+xml;base64,${icon}`} width={144} height={144} alt="" />
      </div>
    ),
    size,
  );
}
