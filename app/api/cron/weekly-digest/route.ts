import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { sendWeeklyDigests } from "@/server/services/digestService";

// Digest săptămânal pe email (2026-09-03). Programat luni în `vercel.json` (07:00 UTC ≈ 09:00 RO).
// Autorizat prin `CRON_SECRET` (header trimis automat de Vercel Cron) — același tipar ca
// `cleanup-notifications`. Fail-closed dacă secretul lipsește din env.
function isAuthorized(authHeader: string | null, cronSecret: string): boolean {
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const actual = Buffer.from(authHeader ?? "");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || !isAuthorized(authHeader, cronSecret)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }

  const { built, sent } = await sendWeeklyDigests();
  audit("weekly_digest_sent", { built, sent }, "info");

  return NextResponse.json({ ok: true, built, sent });
}
