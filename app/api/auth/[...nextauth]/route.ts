// Route Handler Auth.js (App Router) — re-exportă handlerele din configul central.
// Toate rutele /api/auth/* (signin, callback magic link, signout, session) trec pe aici.
import { NextResponse, type NextRequest } from "next/server";

import { handlers, revokeCurrentSession } from "@/lib/auth";

export const { GET } = handlers;

// AUD-05: emiterea magic link-ului se face DOAR prin `signInWithEmailAction` (rate limit + Turnstile).
// `signIn()` de acolo cheamă Auth.js în proces, nu prin ruta asta — deci POST-ul HTTP direct pe
// `/api/auth/signin/*` nu e folosit de aplicație și ar trimite emailuri ocolind ambele protecții.
// Acțiunea se extrage ca în Auth.js (`parseActionAndProviderId`): segmentele nevide de după bază.
export async function POST(req: NextRequest) {
  const action = req.nextUrl.pathname.replace(/^\/api\/auth/, "").split("/").filter(Boolean)[0];
  if (action === "signin") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Autentificarea se face din formularul de login." } },
      { status: 403 },
    );
  }
  const response = await handlers.POST(req);
  // Auth.js valideaza CSRF inainte sa emita stergerea cookie-ului de sesiune. Un POST
  // respins nu trebuie sa revoce sesiunea victimei (logout CSRF).
  const signedOut = action === "signout" && response.headers.getSetCookie().some((cookie) =>
    /^(?:__Secure-)?authjs\.session-token(?:\.\d+)?=;.*\bMax-Age=0(?:;|$)/i.test(cookie),
  );
  if (signedOut) {
    try {
      await revokeCurrentSession(req.headers);
    } catch {
      return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Deconectarea nu a putut fi finalizata." } }, { status: 500 });
    }
  }
  return response;
}
