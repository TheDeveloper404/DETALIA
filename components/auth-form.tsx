"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { signInWithEmailAction } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Site key public Turnstile (inline la build). Fără el (dev fără chei) nu randăm widget-ul, iar
// verificarea server-side e no-op → fluxul de auth merge normal local.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
// Pe preview (VERCEL_ENV !== "production") nu randăm widget-ul deloc: domeniul dinamic *.vercel.app
// nu poate fi în allowlist-ul Turnstile din Cloudflare → widget-ul aruncă mereu eroare 110200
// (vezi verifyTurnstile, care e no-op în afara producției, în oglindă cu asta).
const TURNSTILE_ENABLED = Boolean(TURNSTILE_SITE_KEY) && process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
  }
}

// Randare EXPLICITĂ (nu implicită): scriptul Turnstile e injectat o singură dată în <head> de
// `next/script` — la a doua navigare client-side (ex. /signup → /login) scriptul e deja "loaded"
// și NU mai scanează DOM-ul după noul `.cf-turnstile`, deci widget-ul nu apărea și submit-ul pica
// mereu cu `CaptchaFailed` (până la refresh de pagină). `useEffect` randează manual la fiecare
// montare a formularului, indiferent dacă scriptul era deja încărcat de o pagină anterioară.
function TurnstileWidget({ siteKey }: { siteKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function renderWidget() {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "light",
      });
    }

    if (window.turnstile) {
      renderWidget();
      return () => {
        cancelled = true;
        if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      };
    }

    // Prima montare din sesiune: scriptul poate fi încă în curs de încărcare.
    const interval = setInterval(() => {
      if (window.turnstile) {
        clearInterval(interval);
        renderWidget();
      }
    }, 100);
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
    };
  }, [siteKey]);

  return <div ref={containerRef} className="mt-[18px]" />;
}

// Buton de submit cu feedback instant: cât rulează server action-ul (trimite emailul ~1s, apoi redirect)
// `pending` e true → butonul devine „Se trimite…" + disabled, ca să nu pară blocat.
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="mt-[18px] h-12 w-full text-base">
      {pending ? "Se trimite…" : label}
    </Button>
  );
}

// Formular de autentificare passwordless reutilizabil: magic link pe email (Resend).
// Folosit de /login și /signup (același flux; doar copy-ul diferă). Stil din designul „Detalia Auth".
export function AuthForm({
  callbackUrl,
  authPath,
  submitLabel,
}: {
  callbackUrl: string;
  authPath: string;
  submitLabel: string;
}) {
  return (
    <form action={signInWithEmailAction} className="flex flex-col">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <input type="hidden" name="authPath" value={authPath} />

      <label
        htmlFor="email"
        className="mb-2 block font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground"
      >
        Email
      </label>
      <Input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="nume@mail.ro"
        className="h-12 bg-background text-base"
      />

      {/* Turnstile — widget invizibil/managed care injectează `cf-turnstile-response` în acest form.
          Randare explicită (vezi TurnstileWidget) — `render=explicit` dezactivează scanarea automată
          a scriptului, ca să nu randeze de două ori. Verificat pe server în signInWithEmailAction. */}
      {TURNSTILE_ENABLED && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            strategy="afterInteractive"
          />
          <TurnstileWidget siteKey={TURNSTILE_SITE_KEY!} />
        </>
      )}

      <SubmitButton label={submitLabel} />

      <div className="mt-[18px] flex items-center gap-2.5 font-mono text-xs leading-snug text-muted-foreground">
        <span aria-hidden className="inline-block size-[5px] flex-none rotate-45 bg-primary" />
        Fără parolă · primești un link de acces pe email
      </div>
    </form>
  );
}
