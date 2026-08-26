"use client";

import { Check, Copy, UserPlus, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

// Strict pe propriul profil (viewerIsOwner, verificat de apelant) — link privat, cod deja generat de
// server (profileService, lenes la prima vizită pe propriul profil).
// Click deschide un modal centrat (nu un dropdown ancorat sub buton) — pattern identic cu modalul
// „Date de contact" din profile-view.tsx. Schimbat din dropdown, 2026-08-26 (finding Greptile, P1: un
// dropdown ancorat sub butonul din colțul antetului se întindea peste avatar pe ecrane înguste; un
// modal centrat, cu backdrop, elimină orice suprapunere parțială — acoperă intenționat tot ecranul,
// comportament normal de modal, nu un bug de layout).
export function ReferralLinkCard({ code, count }: { code: string; count: number }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const link = origin ? `${origin}/signup?ref=${code}` : "";

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API poate fi indisponibil (permisiuni/context non-securizat) — degradare tăcută,
      // linkul rămâne oricum vizibil/selectabil manual în input-ul de mai jos.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Invită un prieten prin linkul tău de referral"
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[#974a2e]"
      >
        <UserPlus className="size-4" strokeWidth={2} />
        Invită un prieten
        {count > 0 && <span className="font-mono text-[12px] opacity-90">· {count}</span>}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Invită un prieten"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Invită un prieten</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Închide"
                className="-m-2.5 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Trimite-l unui prieten — dacă își face cont prin el, primești o notificare. La 10 useri
              aduși primești badge-ul „Creștem împreună&rdquo;.
            </p>
            <div className="mt-3 flex items-center gap-1.5">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 py-2 font-mono text-[12.5px] outline-none"
              />
              <button
                type="button"
                onClick={copyLink}
                className="flex shrink-0 items-center gap-1 rounded-md border border-input bg-background px-2.5 py-2 text-[12.5px] font-medium hover:bg-muted"
              >
                {copied ? (
                  <Check className="size-3.5 text-[#2f6b3f]" strokeWidth={2} />
                ) : (
                  <Copy className="size-3.5" strokeWidth={2} />
                )}
              </button>
            </div>
            {count > 0 && (
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                {count} {count === 1 ? "persoană adusă" : "persoane aduse"} până acum.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
