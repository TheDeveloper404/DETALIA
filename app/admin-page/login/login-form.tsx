"use client";

import { useActionState } from "react";

import { TurnstileWidget } from "@/components/turnstile-widget";

import { type AdminLoginState, requestAdminLinkAction } from "./actions";

const INITIAL: AdminLoginState = { sent: false, error: null };

// Site key public Turnstile (inline la build). Fără el (dev fără chei) nu randăm widget-ul, iar
// verificarea server-side e no-op → fluxul de login admin merge normal local.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
// Pe preview (VERCEL_ENV !== "production") nu randăm widget-ul: domeniul dinamic *.vercel.app nu
// poate fi în allowlist-ul Turnstile din Cloudflare → eroare 110200. No-op în oglindă cu verifyTurnstile.
const TURNSTILE_ENABLED = Boolean(TURNSTILE_SITE_KEY) && process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(requestAdminLinkAction, INITIAL);

  if (state.sent) {
    return (
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 text-center text-sm">
        <p className="font-medium">Verifică-ți email-ul.</p>
        <p className="mt-1 text-muted-foreground">
          Dacă adresa e autorizată, ți-am trimis un link de acces. E valabil câteva minute.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email admin
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="tu@detalia.ro"
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
      </div>

      {/* Turnstile — aceeași protecție anti-bot ca pe /login. Injectează `cf-turnstile-response`
          în acest form, verificat server-side în requestAdminLinkAction. */}
      {TURNSTILE_ENABLED && <TurnstileWidget siteKey={TURNSTILE_SITE_KEY!} />}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60"
      >
        {pending ? "Se trimite…" : "Trimite link de acces"}
      </button>
    </form>
  );
}
