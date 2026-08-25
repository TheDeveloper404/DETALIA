import { PostHog } from "posthog-node";

import { environmentTag } from "@/lib/posthog-report";

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog {
  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

// Punct unic pentru evenimente trimise din Server Actions (SDK complet, spre deosebire de
// `reportServerEvent` care e Edge-safe prin fetch brut) — injectează `environment` automat, ca niciun
// apel nou să nu (re)creeze golul găsit 2026-08-18: fără acest tag, o alertă Slack pe evenimentul respectiv
// n-avea cum să excludă trafic non-producție altfel decât hardcodând o listă de email-uri de test.
export function captureServerEvent(
  distinctId: string,
  event: string,
  properties: Record<string, unknown> = {},
): void {
  getPostHogClient().capture({
    distinctId,
    event,
    properties: { ...properties, environment: environmentTag() },
  });
}

// flush() n-are un timeout implicit strâns (shutdown-ul din SDK are default 30s) — pe un serverless
// function care apoi face redirect() către user, un răspuns lent/agățat de la PostHog bloca acțiunea
// întreagă (găsit 2026-08-25: schița rămânea "Se publică…" minute în șir). Cap dur: publicarea/mutația
// deja s-a scris în DB înainte de acest apel — analytics-ul e best-effort, nu trebuie să țină userul.
const FLUSH_TIMEOUT_MS = 2000;

export async function flushPostHogEvents(): Promise<void> {
  await Promise.race([
    getPostHogClient()
      .flush()
      .catch(() => {}),
    new Promise<void>((resolve) => setTimeout(resolve, FLUSH_TIMEOUT_MS)),
  ]);
}
