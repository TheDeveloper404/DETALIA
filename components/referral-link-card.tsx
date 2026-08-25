"use client";

import { Check, Copy, UserPlus } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

// Strict pe propriul profil (viewerIsOwner, verificat de apelant) — link privat, cod deja generat de
// server (profileService, lenes la prima vizită pe propriul profil).
export function ReferralLinkCard({ code, count }: { code: string; count: number }) {
  const [copied, setCopied] = useState(false);

  // `window.location.origin` e extern lui React — useSyncExternalStore (nu useEffect+state) citește-l
  // corect din prima la hidratare, fără mismatch (același pattern ca InviteLinkBox/published-time.tsx).
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const link = origin ? `${origin}/signup?ref=${code}` : "";

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
    <div className="mt-4 rounded-lg bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex items-center gap-2">
        <UserPlus className="size-4 text-primary" strokeWidth={2} />
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Linkul tău de referral
        </span>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
        Trimite-l unui prieten — dacă își face cont prin el, primești o notificare. La 10 useri aduși
        primești badge-ul „Creștem împreună&rdquo;.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 font-mono text-[13px] outline-none"
        />
        <button
          type="button"
          onClick={copyLink}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          {copied ? <Check className="size-3.5 text-[#2f6b3f]" strokeWidth={2} /> : <Copy className="size-3.5" strokeWidth={2} />}
          {copied ? "Copiat" : "Copiază"}
        </button>
      </div>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
        {count} {count === 1 ? "persoană adusă" : "persoane aduse"} până acum.
      </p>
    </div>
  );
}
