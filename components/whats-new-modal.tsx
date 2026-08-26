"use client";

// Panou „Ce e nou" — apare o singură dată per versiune, la prima vizită după login, dacă userul n-a
// văzut încă versiunea curentă (server/domain/announcements.ts). Fără CTA deocamdată (decizie 2026-08-17).
// La userul chiar nou (tur vizual activ, `?tour=1`), apelantul (feed/page.tsx) NU trimite `items` deloc
// — panoul rămâne complet suprimat pentru vizita asta, apare firesc la a DOUA vizită (2026-08-26: fostul
// mecanism de întârziere de 60s se rupea la `router.replace()` din tur, care ștergea `?tour=1` și
// declanșa un re-render cu `delayMs` schimbat de la 60000 la 0 — panoul apărea aproape instant, PESTE
// tur, apoi uneori din nou, la timeout-ul vechi rămas agățat).
import { useEffect, useState } from "react";

import type { AnnouncementItem } from "@/server/domain/announcements";
import { confirmAnnouncementSeenAction } from "@/app/(app)/profile/actions";

import { DialogOverlay } from "./dialog-overlay";

export function WhatsNewModal({ items }: { items: AnnouncementItem[] }) {
  // Captat O SINGURĂ DATĂ la mount (nu re-citit din prop) — pagina se poate re-randa pe server (ex.
  // `FeedEntrance` face `router.replace()` la ?welcome=1), iar la a doua trecere `items` vine deja gol
  // (fusese marcat văzut instant de efectul de mai jos), ceea ce închidea panoul instant după deschidere.
  const [shown] = useState(items);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (shown.length === 0) return;
    const timer = setTimeout(() => {
      setOpen(true);
      void confirmAnnouncementSeenAction();
    }, 0);
    return () => clearTimeout(timer);
  }, [shown]);

  if (!open || shown.length === 0) return null;

  return (
    <DialogOverlay
      onClose={() => setOpen(false)}
      ariaLabel="Ce e nou pe DETALIA"
      panelClassName="fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      <div
        role="document"
        className="w-full max-w-md rounded-xl border border-border bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">Ce e nou pe DETALIA</h2>
        <div className="mt-4 flex flex-col gap-4">
          {shown.map((item) => (
            <div key={item.title}>
              <h3 className="text-sm font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Am înțeles
        </button>
      </div>
    </DialogOverlay>
  );
}
