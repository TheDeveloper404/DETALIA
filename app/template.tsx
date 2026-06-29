import type { ReactNode } from "react";

// template.tsx se remontează la fiecare navigare. Wrapper-ul păstrează comportamentul de flex-item
// al paginii. NU mai animă opacity la intrare: un fade-de-la-0 pe fiecare navigare se percepea ca
// flash de „pagină blank" (vezi globals.css .dt-page). Clasa rămâne doar ca hook, fără stil de animație.
export default function Template({ children }: { children: ReactNode }) {
  // Flex inline (robust chiar dacă regula .dt-page n-ar fi încărcată); clasa duce doar animația.
  return (
    <div className="dt-page" style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {children}
    </div>
  );
}
