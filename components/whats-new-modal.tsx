"use client";

// Panou „Ce e nou" — apare o singură dată per versiune, la prima vizită după login, dacă userul n-a
// văzut încă versiunea curentă (server/domain/announcements.ts). Fără CTA deocamdată (decizie 2026-08-17).
import { useEffect, useState } from "react";

import type { AnnouncementItem } from "@/server/domain/announcements";
import { confirmAnnouncementSeenAction } from "@/app/(app)/profile/actions";

import { DialogOverlay } from "./dialog-overlay";

export function WhatsNewModal({ items }: { items: AnnouncementItem[] }) {
  const [open, setOpen] = useState(items.length > 0);

  // Marchează versiunea ca văzută imediat ce se afișează — un refresh nu trebuie să retrigger-uiască
  // panoul. Fire-and-forget: e o simplă bifă, nu blochează UI-ul dacă rețeaua e lentă.
  useEffect(() => {
    if (items.length > 0) void confirmAnnouncementSeenAction();
  }, [items]);

  if (!open || items.length === 0) return null;

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
          {items.map((item) => (
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
