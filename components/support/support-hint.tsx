"use client";

import { useState } from "react";

import { SupportDialog } from "@/components/support/support-dialog";
import { supportLevel, WHATSAPP_NOTE, whatsappUrl, type SupportFlow } from "@/lib/support-contact";

// Rândul de ajutor pus SUB un mesaj de eroare existent. Nimic la prima eroare; link de raportare de la a
// doua; WhatsApp de la a treia (vezi `supportLevel`). Randat ca <span>, ca să încapă și într-un <p role="alert">.
export function SupportHint({
  failures,
  flow,
  errorMessage,
}: {
  failures: number;
  flow: SupportFlow;
  errorMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const level = supportLevel(failures);
  if (level === "none") return null;

  return (
    <>
      <span className="mt-1.5 flex flex-col gap-1 text-muted-foreground">
        <span>
          Tot nu merge?{" "}
          <button type="button" onClick={() => setOpen(true)} className="font-semibold text-primary hover:underline">
            Raportează problema
          </button>
        </span>
        {level === "whatsapp" && (
          <span>
            Blocat complet?{" "}
            <a
              href={whatsappUrl({
                page: typeof window === "undefined" ? "" : window.location.pathname,
                errorMessage,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              Scrie-ne pe WhatsApp
            </a>
            <span className="block text-xs">{WHATSAPP_NOTE}</span>
          </span>
        )}
      </span>
      {open && (
        <SupportDialog flow={flow} errorMessage={errorMessage} failures={failures} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
