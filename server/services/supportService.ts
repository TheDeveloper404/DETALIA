// Service Suport — cererile de ajutor din aplicație ajung în canalul Slack de suport (incoming webhook).
// Contextul (pagina, eroarea, încercările, replay-ul) e atașat automat, ca omul să nu explice tot.
// Fără PII în loguri: nici mesajul, nici userul nu ajung în console — doar statusul trimiterii.

import { SUPPORT_FLOWS, type SupportFlow } from "@/lib/support-contact";
import { siteUrl } from "@/lib/site-url";

export const SUPPORT_MESSAGE_MIN = 10;
export const SUPPORT_MESSAGE_MAX = 1000;

export type SupportRequestInput = {
  userId: string;
  message: string;
  flow: string;
  page: string;
  errorMessage?: string;
  failures?: number;
  sessionId?: string;
  userAgent?: string;
};

export type SupportRequestResult =
  | { ok: true }
  | { ok: false; error: "VALIDATION" | "NOT_CONFIGURED" | "SEND_FAILED" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Textul venit de la user intră în mrkdwn Slack: `&`, `<`, `>` sunt singurele caractere de control
// (linkuri `<url|text>`, mențiuni `<!channel>`, `<@U…>`). Escapate, nu pot produce linkuri sau pinguri.
export function escapeSlack(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isSupportFlow(flow: string): flow is SupportFlow {
  return Object.hasOwn(SUPPORT_FLOWS, flow);
}

// Linkul de replay se construiește AICI, din id-ul de proiect PostHog + un session id validat ca UUID —
// nu acceptăm un URL de la client (ar putea pune orice link în canal).
function replayUrl(sessionId: string | undefined): string | null {
  const projectId = process.env.POSTHOG_ENV_ID;
  if (!projectId || !sessionId || !UUID_RE.test(sessionId)) return null;
  return `https://eu.posthog.com/project/${encodeURIComponent(projectId)}/replay/${sessionId}`;
}

export function buildSupportPayload(input: SupportRequestInput & { flow: SupportFlow }) {
  const failures = input.failures ?? 0;
  const replay = replayUrl(input.sessionId);
  const fields = [
    `*User*\n<${siteUrl()}/profile/${encodeURIComponent(input.userId)}|Profil (id ${input.userId.slice(0, 8)}…)>`,
    `*Pagina*\n\`${escapeSlack(input.page)}\``,
    `*Eroare*\n${input.errorMessage ? escapeSlack(input.errorMessage) : "—"}`,
    `*Încercări eșuate*\n${failures > 0 ? `${failures} la rând` : "—"}`,
    `*Dispozitiv*\n${input.userAgent ? escapeSlack(input.userAgent.slice(0, 200)) : "—"}`,
    `*Mediu*\n${process.env.VERCEL_ENV ?? "development"}`,
  ];
  const title = `Cerere de ajutor · ${SUPPORT_FLOWS[input.flow]}`;
  return {
    text: title,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `*${title}*` } },
      { type: "section", text: { type: "mrkdwn", text: `>${escapeSlack(input.message).replace(/\n/g, "\n>")}` } },
      { type: "section", fields: fields.map((text) => ({ type: "mrkdwn", text })) },
      ...(replay
        ? [{ type: "section", text: { type: "mrkdwn", text: `<${replay}|Vezi replay-ul sesiunii>` } }]
        : []),
    ],
  };
}

export async function submitSupportRequest(input: SupportRequestInput): Promise<SupportRequestResult> {
  const message = input.message.trim();
  const failures = input.failures ?? 0;
  if (
    message.length < SUPPORT_MESSAGE_MIN ||
    message.length > SUPPORT_MESSAGE_MAX ||
    !isSupportFlow(input.flow) ||
    !input.page.startsWith("/") ||
    input.page.length > 200 ||
    !Number.isInteger(failures) ||
    failures < 0
  ) {
    return { ok: false, error: "VALIDATION" };
  }

  const webhook = process.env.SLACK_SUPPORT_WEBHOOK_URL;
  if (!webhook) {
    console.warn("Suport: SLACK_SUPPORT_WEBHOOK_URL lipsește — cererea NU se trimite.");
    return { ok: false, error: "NOT_CONFIGURED" };
  }

  const payload = buildSupportPayload({
    ...input,
    message,
    errorMessage: input.errorMessage?.slice(0, 200),
    failures: Math.min(failures, 20),
    flow: input.flow,
  });
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("Suport: Slack a respins cererea, status", res.status);
      return { ok: false, error: "SEND_FAILED" };
    }
    return { ok: true };
  } catch (err) {
    console.error("Suport: eroare de rețea la trimitere:", err instanceof Error ? err.message : String(err));
    return { ok: false, error: "SEND_FAILED" };
  }
}
