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

// Tag-ul environment permite separarea alertelor de productie de trafic Preview.
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

// Analytics este best-effort: nu trebuie sa blocheze mutatia deja salvata.
const FLUSH_TIMEOUT_MS = 2000;

export async function flushPostHogEvents(): Promise<void> {
  await Promise.race([
    getPostHogClient()
      .flush()
      .catch(() => {}),
    new Promise<void>((resolve) => setTimeout(resolve, FLUSH_TIMEOUT_MS)),
  ]);
}
