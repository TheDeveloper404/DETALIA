"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

export function PostHogIdentify({
  userId,
  name,
}: {
  userId: string;
  name: string | null | undefined;
}) {
  useEffect(() => {
    posthog.identify(userId, {
      name: name ?? undefined,
    });
  }, [userId, name]);

  return null;
}
