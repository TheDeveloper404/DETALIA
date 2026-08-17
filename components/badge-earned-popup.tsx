"use client";

// Pop-up de celebrare la primirea unui badge nou (sau urcare de tier) — apare o singură dată, la prima
// vizită pe propriul profil după ce pragul a fost atins (badge-urile sunt calculate LIVE din statistici,
// vezi server/domain/badges.ts — `newlyEarnedBadges` e diferența față de ultimul snapshot văzut).
import { useEffect, useState } from "react";

import type { EarnedBadge } from "@/server/domain/badges";
import { confirmBadgesSeenAction } from "@/app/(app)/profile/actions";

import { DialogOverlay } from "./dialog-overlay";

const TIER_STYLE: Record<EarnedBadge["tier"], string> = {
  bronze: "border-[#d9b28c] bg-[#f7ede1] text-[#8a5a2b]",
  silver: "border-[#d6d6da] bg-[#f2f2f4] text-[#5a5a63]",
  gold: "border-[#f0e0b4] bg-[#fbf6ea] text-[#9a7b1f]",
};
const TIER_LABEL: Record<EarnedBadge["tier"], string> = {
  bronze: "Bronz",
  silver: "Argint",
  gold: "Aur",
};

export function BadgeEarnedPopup({ badges }: { badges: EarnedBadge[] }) {
  const [open, setOpen] = useState(badges.length > 0);

  // Marchează snapshot-ul ca văzut imediat ce se afișează — un refresh nu trebuie să retrigger-uiască
  // celebrarea. Fire-and-forget: e o simplă bifă, nu blochează UI-ul dacă rețeaua e lentă.
  useEffect(() => {
    if (badges.length > 0) void confirmBadgesSeenAction();
  }, [badges]);

  if (!open || badges.length === 0) return null;

  return (
    <DialogOverlay
      onClose={() => setOpen(false)}
      ariaLabel="Badge nou primit"
      panelClassName="fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      <div
        role="document"
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-4xl">🎉</div>
        <h2 className="mt-2 text-lg font-bold">
          {badges.length === 1 ? "Ai primit un badge nou!" : `Ai primit ${badges.length} badge-uri noi!`}
        </h2>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {badges.map((b) => (
            <span
              key={b.id}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${TIER_STYLE[b.tier]}`}
            >
              {b.label}
              <span className="font-mono text-[11px] font-normal opacity-75">{TIER_LABEL[b.tier]}</span>
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Super!
        </button>
      </div>
    </DialogOverlay>
  );
}
