"use client";

import { useEffect } from "react";

// Extras din 3 implementări identice (InviteMembersButton, AddContentModal — QODO, 2026-08-11):
// backdrop + Escape-to-close + wrapper `role="dialog" aria-modal="true"`, TOATE identice caracter cu
// caracter în cele 3 locuri, doar conținutul din interior diferea. `className`/`children` rămân complet
// la latitudinea apelantului — acest component NU impune stil vizual, doar structura+comportamentul
// comune, ca schimbarea să fie zero-diff vizual pe apelantele existente.
// Pattern DIFERIT (lightbox full-screen, un singur div care e și backdrop și container, fără panou
// separat) rămâne neatins — vezi docs/UI-REGISTRY.md, e o familie structurală distinctă, nu aceeași
// duplicare.
export function DialogOverlay({
  onClose,
  ariaLabel,
  panelClassName,
  children,
}: {
  onClose: () => void;
  ariaLabel?: string;
  panelClassName: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={ariaLabel} className={panelClassName}>
        {children}
      </div>
    </>
  );
}
