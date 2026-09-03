// Service digest săptămânal (2026-09-03) — asamblează și trimite emailul de rezumat pe săptămână.
// Invocat de `/api/cron/weekly-digest` (Vercel Cron, luni). Notificarea in-app rămâne canalul
// principal pentru evenimente individuale; digestul e re-engagement, best-effort.
//
// Regulă de produs: dacă secțiunea „La tine" (activitate pe detaliile tale) e goală, userul e OMIS —
// secțiunea globală „Nou pe DETALIA" singură nu justifică un email (altfel devine spam săptămânal).
import {
  type WeeklyDigestData,
  plainSubject,
  sendEmailBatch,
  weeklyDigestEmailHtml,
  weeklyDigestEmailText,
} from "@/lib/email";
import { createSignedToken } from "@/lib/signed-token";
import {
  countCommentsOnOwnDetails,
  countSketchesOnOwnDetails,
  countValidationsOnOwnDetails,
  listDigestRecipients,
  listNewCommunityDetails,
} from "@/server/repos/digestRepo";

const WINDOW_DAYS = 7;
const COMMUNITY_LIMIT = 5;

export const DIGEST_UNSUBSCRIBE_PURPOSE = "digest-unsubscribe";

function baseUrl(): string {
  // Cronul nu are host de request → `AUTH_URL` (Production) e baza corectă aici (ca `detailUrl` din
  // notificationService). Fallback local doar pentru teste/dev.
  return process.env.AUTH_URL ?? "http://localhost:3000";
}

export type WeeklyDigest = { userId: string; email: string; data: WeeklyDigestData };

export async function buildWeeklyDigests(now: Date = new Date()): Promise<WeeklyDigest[]> {
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
  const [recipients, comments, sketches, validations, community] = await Promise.all([
    listDigestRecipients(),
    countCommentsOnOwnDetails(since),
    countSketchesOnOwnDetails(since),
    countValidationsOnOwnDetails(since),
    listNewCommunityDetails(since, COMMUNITY_LIMIT),
  ]);

  const base = baseUrl();
  const communityItems = community.map((d) => ({ title: d.title, url: `${base}/details/${d.id}` }));

  const out: WeeklyDigest[] = [];
  for (const r of recipients) {
    const mine = {
      comments: comments.get(r.id) ?? 0,
      sketches: sketches.get(r.id) ?? 0,
      validations: validations.get(r.id) ?? 0,
    };
    if (mine.comments + mine.sketches + mine.validations === 0) continue;
    out.push({
      userId: r.id,
      email: r.email,
      data: {
        recipientName: r.name,
        mine,
        community: communityItems,
        unsubscribeUrl: `${base}/api/digest/unsubscribe?token=${encodeURIComponent(
          createSignedToken(DIGEST_UNSUBSCRIBE_PURPOSE, r.id),
        )}`,
        profileUrl: `${base}/profile`,
      },
    });
  }
  return out;
}

export async function sendWeeklyDigests(
  now: Date = new Date(),
): Promise<{ built: number; sent: number }> {
  const digests = await buildWeeklyDigests(now);
  if (digests.length === 0) return { built: 0, sent: 0 };
  const sent = await sendEmailBatch(
    digests.map((d) => ({
      to: d.email,
      subject: plainSubject("Săptămâna ta pe DETALIA"),
      html: weeklyDigestEmailHtml(d.data),
      text: weeklyDigestEmailText(d.data),
    })),
  );
  return { built: digests.length, sent };
}
