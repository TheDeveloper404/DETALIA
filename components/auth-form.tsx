"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { signInWithEmailAction } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { suggestEmailFix } from "@/lib/email-typo";

// Site key public Turnstile (inline la build). Fără el (dev fără chei) nu randăm widget-ul, iar
// verificarea server-side e no-op → fluxul de auth merge normal local.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
// Pe preview (VERCEL_ENV !== "production") nu randăm widget-ul deloc: domeniul dinamic *.vercel.app
// nu poate fi în allowlist-ul Turnstile din Cloudflare → widget-ul aruncă mereu eroare 110200
// (vezi verifyTurnstile, care e no-op în afara producției, în oglindă cu asta).
const TURNSTILE_ENABLED =
  Boolean(TURNSTILE_SITE_KEY) &&
  (process.env.NEXT_PUBLIC_VERCEL_ENV === "production" || process.env.NEXT_PUBLIC_VERCEL_TARGET_ENV === "staging");

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
        // Fără callback, Turnstile aruncă excepție la orice eroare de client (ex. 300030 într-un tab lăsat
        // deschis ore întregi) → eroare netratată în PostHog + alertă Slack. `false` = Turnstile își
        // păstrează reîncercarea automată (`retry: auto`) și doar scrie un warning în consolă.
        "error-callback": () => false,
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
  // Avertizare la greșeli de tipar în domeniu (ex. `gmail.con`): apare la ieșirea din câmp, dispare la
  // orice editare. Primul submit cu o adresă suspectă e oprit ca userul s-o vadă (și cu Enter direct
  // din câmp); al doilea trece — adresa poate fi corectă, nu blocăm.
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  const stoppedForRef = useRef<string | null>(null);

  return (
    <form
      action={signInWithEmailAction}
      className="flex flex-col"
      onSubmit={(e) => {
        const suggestion = suggestEmailFix(
          String(new FormData(e.currentTarget).get("email") ?? ""),
        );
        if (suggestion && stoppedForRef.current !== suggestion) {
          e.preventDefault();
          stoppedForRef.current = suggestion;
          setEmailSuggestion(suggestion);
        }
      }}
    >
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <input type="hidden" name="authPath" value={authPath} />

      <label htmlFor="email" className="mb-2 block text-sm font-medium text-foreground">
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
        onBlur={(e) => setEmailSuggestion(suggestEmailFix(e.currentTarget.value))}
        onChange={() => {
          setEmailSuggestion(null);
          stoppedForRef.current = null;
        }}
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
      {/* Sub buton, nu sub câmp: apare la blur, adică pe mousedown-ul click-ului pe buton — deasupra lui
          l-ar împinge în jos în timpul click-ului și click-ul s-ar pierde. */}
      {emailSuggestion && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          Ai vrut să scrii <strong>{emailSuggestion}</strong>? Verifică adresa înainte să trimiți.
        </p>
      )}

      <p className="mt-[18px] font-mono text-xs leading-relaxed text-muted-foreground">
        Fără parolă. Primești un link de acces pe email.
      </p>
    </form>
  );
}
