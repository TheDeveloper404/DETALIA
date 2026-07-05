"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";

// Copiază link-ul PUBLIC (fără cont) al schiței — `/s/[sketchId]`, nu URL-ul curent (care e pagina
// privată `/details/[id]`, indisponibilă fără sesiune). Pattern identic cu copyLink din
// detail-actions-menu.tsx (stare „copiat" 1.5s, eșec clipboard ignorat silențios).
export function CopySketchLinkButton({ sketchId }: { sketchId: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      const url = `${window.location.origin}/s/${sketchId}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponibil (permisiuni/context non-secure) — ignorăm silențios.
    }
  }

  return (
    <button
      type="button"
      onClick={copyLink}
      title="Copiază un link public spre această schiță, vizibil și fără cont"
      className="inline-flex items-center gap-1.5 rounded-md border border-[#e6ddcf] bg-white px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-foreground/75 transition-colors hover:bg-secondary"
    >
      {copied ? (
        <>
          <Check className="size-3.5 text-primary" strokeWidth={2} />
          Link copiat
        </>
      ) : (
        <>
          <Link2 className="size-3.5" strokeWidth={2} />
          Copiază linkul
        </>
      )}
    </button>
  );
}
