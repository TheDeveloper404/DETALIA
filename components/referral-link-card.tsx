"use client";

import { Check, Copy, UserPlus } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// Strict pe propriul profil (viewerIsOwner, verificat de apelant) — link privat, cod deja generat de
// server (profileService, lenes la prima vizită pe propriul profil).
// Click deschide un popover mic cu linkul (nu mai stă afișat lung pe pagină), 2026-08-26 (feedback:
// UI-ul inițial, card întreg cu input vizibil, era prea proeminent). Mutat în colțul antetului de
// profil ca buton primary — mai vizibil decât varianta anterioară, discretă lângă „Badge-uri".
export function ReferralLinkCard({ code, count }: { code: string; count: number }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const link = origin ? `${origin}/signup?ref=${code}` : "";

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API poate fi indisponibil (permisiuni/context non-securizat) — degradare tăcută,
      // linkul rămâne oricum vizibil/selectabil manual în input-ul din popover.
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Invită un prieten prin linkul tău de referral"
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[#974a2e]"
      >
        <UserPlus className="size-4" strokeWidth={2} />
        Invită un prieten
        {count > 0 && <span className="font-mono text-[12px] opacity-90">· {count}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-2 w-72 max-w-[85vw] rounded-lg border border-input bg-card p-3 shadow-lg">
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            Trimite-l unui prieten — dacă își face cont prin el, primești o notificare. La 10 useri
            aduși primești badge-ul „Creștem împreună&rdquo;.
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 font-mono text-[12px] outline-none"
            />
            <button
              type="button"
              onClick={copyLink}
              className="flex shrink-0 items-center gap-1 rounded-md border border-input bg-background px-2 py-1.5 text-[12px] font-medium hover:bg-muted"
            >
              {copied ? (
                <Check className="size-3.5 text-[#2f6b3f]" strokeWidth={2} />
              ) : (
                <Copy className="size-3.5" strokeWidth={2} />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
