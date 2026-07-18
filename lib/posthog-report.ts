// Raportare de erori/audit către PostHog prin fetch BRUT (nu SDK) — motiv: acest modul e importat din
// cod care rulează pe Edge (`proxy.ts` → `lib/audit.ts`, `instrumentation.ts`), unde `posthog-node`
// (Node-only) NU e garantat compatibil. Bug găsit 2026-07-16 (code review): `server/repos/settingsRepo.ts`
// importa `posthog-node` prin `getPostHogClient()`, dar e folosit din `proxy.ts` (Edge by default, Next
// 16, fără `nodeMiddleware`) — ar fi spart gate-ul de mentenanță pentru TOT traficul. Fix: un singur
// punct edge-safe, folosit uniform (server, edge, audit).
//
// Fire-and-forget intenționat (best-effort): NU garantăm livrare dacă platforma îngheață funcția imediat
// după răspuns (fără `waitUntil`) — acceptabil pt evenimente de audit/erori non-critice; Vercel Runtime
// Logs (console.log/console.error, deja emise de apelanți) rămân sursa de adevăr dacă evenimentul se pierde.
const POSTHOG_INGEST_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

function environmentTag(): string {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

export function reportServerEvent(event: string, properties: Record<string, unknown> = {}): void {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return;
  fetch(`${POSTHOG_INGEST_HOST}/i/v0/e/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: token,
      event,
      properties: { distinct_id: "server", environment: environmentTag(), ...properties },
    }),
  }).catch(() => {
    // best-effort — o eroare de rețea la raportare nu trebuie să rateze cererea originală.
  });
}

// Formă standard `$exception` PostHog (type/value/mechanism per item) — vezi packages/mcp/docs/
// ARCHITECTURE.md din posthog-js. Fără stacktrace (nu avem acces la el din acest fetch brut, spre
// deosebire de SDK-ul complet) — degradare asumată față de Sentry, acceptabilă pt MVP.
export function reportServerException(error: unknown, tags: Record<string, unknown> = {}): void {
  // Cauza reală a erorilor-wrapper (ex. Drizzle: `message` = doar "Failed query: ...") stă pe `.cause`.
  // O trimitem ca proprietate separată (`cause`), NU concatenată în `value` — value intră în fingerprint
  // și ar sparge gruparea issue-urilor în PostHog la fiecare cauză diferită.
  const cause =
    error instanceof Error && error.cause !== undefined
      ? error.cause instanceof Error
        ? error.cause.message
        : String(error.cause)
      : undefined;
  reportServerEvent("$exception", {
    $exception_list: [
      {
        type: error instanceof Error ? error.name : "Error",
        value: error instanceof Error ? error.message : String(error),
        mechanism: { handled: true, synthetic: false },
      },
    ],
    $exception_level: "error",
    ...(cause !== undefined ? { cause } : {}),
    ...tags,
  });
}
