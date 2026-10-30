import { NextResponse } from "next/server";
import { verifySignedToken } from "@/lib/signed-token";
import { isUuid } from "@/server/domain/ids";
import { ACTIVITY_UNSUBSCRIBE_PURPOSE, unsubscribeActivityEmails } from "@/server/services/notificationEmailService";

function page(body: string, status = 200) {
  return new NextResponse(`<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Emailuri de activitate — DETALIA</title></head>
    <body style="margin:0;background:#faf8f4;color:#211d18;font-family:Arial,Helvetica,sans-serif;"><main style="max-width:440px;margin:48px auto;padding:28px;background:white;border:1px solid #e3ddd2;border-top:3px solid #a9573a;border-radius:14px;">${body}</main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// GET nu modifica preferinta: scanerele de linkuri din email nu pot dezabona utilizatorul.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const userId = verifySignedToken(ACTIVITY_UNSUBSCRIBE_PURPOSE, token);
  if (!userId || !isUuid(userId)) return page("<h1>Link invalid sau expirat</h1>", 400);
  return page(`<h1>Oprești emailurile de activitate?</h1><p>Notificările din aplicație și digestul săptămânal rămân disponibile.</p>
    <form method="post"><input type="hidden" name="token" value="${token.replace(/"/g, "&quot;")}"><button type="submit" style="min-height:44px;padding:12px 18px;border:0;border-radius:8px;background:#a9573a;color:white;font-size:15px;cursor:pointer;">Oprește emailurile de activitate</button></form>`);
}

export async function POST(request: Request) {
  let form: FormData;
  try { form = await request.formData(); }
  catch { return page("<h1>Cerere invalidă</h1>", 400); }
  const token = String(form.get("token") ?? "");
  if (!await unsubscribeActivityEmails(token)) return page("<h1>Link invalid sau expirat</h1>", 400);
  return page("<h1>Emailurile de activitate au fost oprite</h1><p>Poți reactiva opțiunea din profil. Digestul săptămânal are propria setare.</p>");
}
