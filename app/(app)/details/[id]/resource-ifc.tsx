"use client";

import { Box, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

// three.js + That Open Engine (câțiva MB) se descarcă DOAR la click pe „3D", nu la încărcarea paginii.
const IfcViewer = dynamic(() => import("./ifc-viewer").then((m) => m.IfcViewer), {
  ssr: false,
  loading: () => <div className="size-full" />,
});

// Resursă CAD `.ifc` — buton „3D" lângă chip-ul de download, click → lightbox full-screen cu modelul
// 3D. Același tipar ca resource-image.tsx (fundal negru, X sus-dreapta, Escape închide).
export function ResourceIfc({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focusul de tastatură intră în dialog (pe „Închide" — singurul element focusabil), Tab nu iese din el,
  // iar la închidere revine pe butonul „3D".
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab") {
        e.preventDefault();
        closeRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] font-semibold text-foreground/80 transition-colors hover:border-primary"
        aria-label={`Vezi modelul 3D: ${title}`}
      >
        <Box className="size-3.5 text-[#5e6f8a]" strokeWidth={1.8} />
        3D
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Model 3D: ${title}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setOpen(false)}
        >
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Închide"
            className="absolute right-5 top-5 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
          <div className="relative h-[85vh] w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
            <IfcViewer url={url} />
          </div>
        </div>
      )}
    </>
  );
}
