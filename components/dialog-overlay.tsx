"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  backdropClassName = "fixed inset-0 z-40 bg-black/20 backdrop-blur-sm",
  children,
}: {
  onClose: () => void;
  ariaLabel?: string;
  panelClassName: string;
  backdropClassName?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focusul intra in dialog la deschidere si revine pe elementul de dinainte la inchidere.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panelRef.current) return;
      // Tab / Shift+Tab raman in dialog, nu ajung la pagina acoperita.
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !items.includes(active as HTMLElement);
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className={backdropClassName} onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`${panelClassName} outline-none`}
      >
        {children}
      </div>
    </>
  );
}
