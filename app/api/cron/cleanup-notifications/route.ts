import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { cleanupOldNotifications } from "@/server/services/notificationService";

// Retenție notificări: șterge notificările CITITE mai vechi de 15 zile (decizie Liviu 2026-07-03).
// Necitite NU se șterg (userul trebuie să le vadă măcar o dată) — doar cele deja consumate se curăță,
// ca să nu crească nemărginit tabelul. Invocat de Vercel Cron (vercel.json), autorizat prin CRON_SECRET
// (header pe care Vercel îl trimite automat la apelul programat — vezi docs Vercel Cron Jobs).
const RETENTION_DAYS = 15;

export async function GET(request: Request): Promise<NextResponse> {
  // Fail-closed explicit: dacă CRON_SECRET lipsește din env, comparația NU trebuie să devină
  // "Bearer undefined" (ar trece la orice apelant care trimite literal acel header).
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }

  const deleted = await cleanupOldNotifications(RETENTION_DAYS);
  audit("notifications_retention_cleanup", { deletedCount: deleted, retentionDays: RETENTION_DAYS }, "info");

  return NextResponse.json({ ok: true, deleted });
}
