"use client";

import posthog from "posthog-js";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { submitSupportRequestAction } from "@/app/support-actions";
import { DialogOverlay } from "@/components/dialog-overlay";
import { SUPPORT_EMAIL, type SupportFlow } from "@/lib/support-contact";

const MIN = 10;
const MAX = 1000;

// Formularul „Ai nevoie de ajutor?" — un singur câmp; pagina, eroarea, încercările și sesiunea PostHog
// se atașează automat (vezi server/services/supportService.ts pentru ce ajunge în Slack).
export function SupportDialog({
  flow,
  errorMessage,
  failures,
  onClose,
}: {
  flow: SupportFlow;
  errorMessage?: string;
  failures?: number;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function send() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await submitSupportRequestAction({
          message,
          flow,
          page: window.location.pathname,
          errorMessage,
          failures,
          sessionId: posthog.get_session_id() || undefined,
        });
        if (res.ok) setSent(true);
        else setError(res.error ?? `Nu am putut trimite mesajul. Scrie-ne la ${SUPPORT_EMAIL}.`);
      } catch {
        setError(`Nu am putut trimite mesajul. Scrie-ne la ${SUPPORT_EMAIL}.`);
      }
    });
  }

  const tooShort = message.trim().length < MIN;

  // Portal în body: se deschide și din header (user-menu), unde `backdrop-blur` face din header containing
  // block pentru `fixed` — fără portal, dialogul s-ar poziționa față de header, nu față de ecran.
  // Stratul z-[70] îl ridică peste editoarele full-screen (planșa e `fixed z-[60]`).
  return createPortal(
    <div className="relative z-[70]">
    <DialogOverlay
      onClose={onClose}
      ariaLabel="Ai nevoie de ajutor?"
      panelClassName="fixed left-1/2 top-1/2 z-50 w-[min(29rem,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card p-6 shadow-xl"
    >
      {sent ? (
        <div className="flex flex-col items-center gap-2.5 py-3 text-center">
          <h2 className="font-heading text-xl font-bold">Am primit mesajul</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Îți scriem pe emailul contului, în cel mult o zi lucrătoare. Poți continua să folosești aplicația
            între timp.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-1.5 h-10 rounded-[10px] border border-border bg-card px-[18px] text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Închide
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <h2 className="font-heading text-xl font-bold">Ai nevoie de ajutor?</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Spune-ne pe scurt ce s-a întâmplat. Îți răspundem pe emailul contului, în cel mult o zi lucrătoare.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="support-message" className="text-[13px] font-semibold">
              Ce nu merge?
            </label>
            <textarea
              id="support-message"
              rows={5}
              maxLength={MAX}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex: apăs pe „Publică” și nu se întâmplă nimic."
              className="w-full resize-y rounded-[10px] border border-border bg-card px-3 py-2.5 text-sm leading-relaxed text-foreground focus:outline-2 focus:outline-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Minim {MIN} caractere</span>
              <span className="font-mono">
                {message.length} / {MAX}
              </span>
            </div>
          </div>
          <p className="rounded-[10px] bg-secondary px-3 py-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
            Atașăm automat pagina pe care ești, eroarea apărută și pașii tăi recenți din aplicație, ca să nu fie
            nevoie să ne explici tot.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[13px] text-primary hover:underline">
              Preferi emailul? {SUPPORT_EMAIL}
            </a>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-10 rounded-[10px] border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={send}
                disabled={pending || tooShort}
                className="h-10 rounded-[10px] border border-[#95492e] bg-primary px-[18px] text-sm font-semibold text-primary-foreground transition-colors hover:bg-[#974a2e] disabled:opacity-50"
              >
                {pending ? "Se trimite…" : "Trimite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogOverlay>
    </div>,
    document.body,
  );
}
