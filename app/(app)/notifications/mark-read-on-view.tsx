"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { markReadAction } from "./actions";

// La deschiderea paginii, marchează notificările citite și reîmprospătează (clopoțelul din header se golește).
export function MarkReadOnView({ hasUnread }: { hasUnread: boolean }) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (!hasUnread || done.current) return;
    done.current = true;
    markReadAction().then(() => router.refresh());
  }, [hasUnread, router]);

  return null;
}
