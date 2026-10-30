import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { processNotificationEmails } from "@/server/services/notificationEmailService";

export const maxDuration = 300;

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (!secret || expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const result = await processNotificationEmails();
    audit("activity_emails_processed", result, "info");
    return NextResponse.json({ ok: true, ...result });
  } catch {
    audit("activity_emails_failed", {}, "error");
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Procesarea nu a reușit." } }, { status: 500 });
  }
}
