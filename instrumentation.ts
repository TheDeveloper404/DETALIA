import type { Instrumentation } from "next";

import { reportServerException } from "@/lib/posthog-report";

// Prinde erorile din Server Components, server actions și proxy.ts (Next 16, fostul middleware) —
// rulează și pe Edge, deci raportarea (lib/posthog-report.ts) e fetch brut, nu SDK Node.
// Înlocuiește Sentry (`onRequestError`), scos 2026-07-16 — decommission asumat, PostHog e sursa unică.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  reportServerException(error, {
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
