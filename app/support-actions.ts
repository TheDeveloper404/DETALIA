"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { checkLimit, limiters } from "@/lib/rate-limit";
import { SUPPORT_EMAIL } from "@/lib/support-contact";
import { submitSupportRequest } from "@/server/services/supportService";

export type SupportActionResult = { ok: boolean; error?: string };

const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: `Conectează-te ca să trimiți formularul sau scrie-ne la ${SUPPORT_EMAIL}.`,
  RATE_LIMITED: `Ai trimis deja câteva cereri. Revenim noi — sau scrie-ne la ${SUPPORT_EMAIL}.`,
  VALIDATION: "Scrie măcar câteva cuvinte despre problemă (minim 10 caractere).",
  NOT_CONFIGURED: `Nu am putut trimite mesajul. Scrie-ne la ${SUPPORT_EMAIL}.`,
  SEND_FAILED: `Nu am putut trimite mesajul. Scrie-ne la ${SUPPORT_EMAIL}.`,
};

// Cerere de ajutor din aplicație → Slack. `auth()` direct (nu requireActiveUserId): apelată dintr-un
// dialog, inclusiv de pe pagina de eroare — fără sesiune întoarcem un mesaj cu emailul, nu redirect.
export async function submitSupportRequestAction(input: {
  message: string;
  flow: string;
  page: string;
  errorMessage?: string;
  failures?: number;
  sessionId?: string;
}): Promise<SupportActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: ERROR_MESSAGES.UNAUTHORIZED };
  if (!(await checkLimit(limiters.support, userId)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }
  const res = await submitSupportRequest({
    userId,
    message: String(input.message ?? ""),
    flow: String(input.flow ?? ""),
    page: String(input.page ?? ""),
    errorMessage: input.errorMessage ? String(input.errorMessage) : undefined,
    failures: typeof input.failures === "number" ? input.failures : 0,
    sessionId: input.sessionId ? String(input.sessionId) : undefined,
    userAgent: (await headers()).get("user-agent") ?? undefined,
  });
  if (!res.ok) return { ok: false, error: ERROR_MESSAGES[res.error] };
  return { ok: true };
}
