// Sentry — inițializare server/edge (rulează o singură dată, la boot). Client-ul se inițializează
// separat în `instrumentation-client.ts` (convenție Sentry pentru Next.js App Router).
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Prinde erorile din Server Components, server actions și proxy.ts (Next 16, fostul middleware).
export const onRequestError = Sentry.captureRequestError;
