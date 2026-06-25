import type { ReactNode } from "react";

// template.tsx se remontează la fiecare navigare → animația de intrare se reia. Tranziție subtilă
// (doar opacity, fără transform → nu strică position:fixed și e foarte ieftină la randare). Wrapper-ul
// păstrează comportamentul de flex-item al paginii. Stilul + prefers-reduced-motion stau în globals.css.
export default function Template({ children }: { children: ReactNode }) {
  // Flex inline (robust chiar dacă regula .dt-page n-ar fi încărcată); clasa duce doar animația.
  return (
    <div className="dt-page" style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {children}
    </div>
  );
}
