"use client";

import { signInWithEmailAction, signInWithGoogleAction } from "@/app/auth-actions";

// Formular de autentificare passwordless reutilizabil: „Continuă cu Google" + magic link pe email.
// Folosit de /login și /signup (același flux; doar copy-ul diferă).
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
    <div className="flex flex-col gap-4">
      <form action={signInWithGoogleAction}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <input type="hidden" name="authPath" value={authPath} />
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          <GoogleIcon />
          Continuă cu Google
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        sau
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <form action={signInWithEmailAction} className="flex flex-col gap-3">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <input type="hidden" name="authPath" value={authPath} />
        <label htmlFor="email" className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Email</span>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="nume@exemplu.ro"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {submitLabel}
        </button>
      </form>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
