"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  LOGIN_FAILURES_KEY,
  parseStoredFailures,
  recentFailures,
  recordVerificationFailure,
} from "@/components/support/login-failures";
import { SUPPORT_EMAIL, WHATSAPP_NOTE, whatsappUrl } from "@/lib/support-contact";

// localStorage e un sistem EXTERN lui React → useSyncExternalStore (nu useEffect + setState); efectul doar
// scrie eșecul nou și anunță abonații.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function storedFailureCount(): number {
  try {
    return recentFailures(parseStoredFailures(window.localStorage.getItem(LOGIN_FAILURES_KEY)), Date.now()).length;
  } catch {
    return 0;
  }
}

// Ajutor pe /login la link expirat/folosit (error=Verification): explicația TTL mereu; de la al doilea
// link eșuat în 24h, caseta WhatsApp + email (userul nu e logat, deci formularul nu e o opțiune aici).
export function LoginSupportHint({ verificationFailed, ttlMinutes }: { verificationFailed: boolean; ttlMinutes: number }) {
  const failures = useSyncExternalStore(subscribe, storedFailureCount, () => 0);

  useEffect(() => {
    if (!verificationFailed) return;
    try {
      const next = recordVerificationFailure(
        parseStoredFailures(window.localStorage.getItem(LOGIN_FAILURES_KEY)),
        Date.now(),
      );
      window.localStorage.setItem(LOGIN_FAILURES_KEY, JSON.stringify(next));
      listeners.forEach((listener) => listener());
    } catch {
      // localStorage blocat (privat / setări): rămâne doar explicația TTL.
    }
  }, [verificationFailed]);

  if (!verificationFailed) return null;

  return (
    <div className="mb-6 flex flex-col gap-3">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Linkul e valabil {ttlMinutes} minute. Folosește-l pe cel din ultimul email primit.
      </p>
      {failures >= 2 && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5">
          <span className="text-sm font-semibold">Nu reușești să intri?</span>
          <a
            href={whatsappUrl({ page: "/login", errorMessage: "link de conectare expirat sau folosit" })}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 items-center justify-center rounded-[10px] border border-border text-[15px] font-semibold text-foreground no-underline transition-colors hover:bg-secondary"
          >
            Scrie-ne pe WhatsApp
          </a>
          <span className="text-center text-xs text-muted-foreground">{WHATSAPP_NOTE}</span>
          <span className="text-center text-[13px] text-muted-foreground">
            sau la <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </span>
        </div>
      )}
    </div>
  );
}
