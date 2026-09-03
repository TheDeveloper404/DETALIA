import { NextResponse } from "next/server";

import { verifySignedToken } from "@/lib/signed-token";
import { DIGEST_UNSUBSCRIBE_PURPOSE } from "@/server/services/digestService";
import { setWeeklyDigestEnabled } from "@/server/repos/usersRepo";

// Dezabonare de la digestul săptămânal, dintr-un client de email (FĂRĂ sesiune). Dovada = tokenul
// semnat HMAC (vezi lib/signed-token.ts) — doar noi îl putem produce, deci verificarea semnăturii e
// suficientă. Nu dezvăluim dacă userul există (update pe 0 rânduri = același răspuns).
//
// Două trepte, intenționat: GET arată o pagină cu buton, POST execută. Scanerele de securitate și
// prefetch-ul clienților de email ating linkuri GET automat — dacă GET ar dezabona direct, useri ar
// fi scoși fără să fi apăsat nimic.
function page(title: string, body: string, status = 200): NextResponse {
  const html = `<!doctype html><html lang="ro"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — DETALIA</title>
<style>body{margin:0;background:#faf8f4;color:#211d18;font-family:Arial,Helvetica,sans-serif;}
.wrap{max-width:440px;margin:0 auto;padding:56px 20px;}
.card{background:#fff;border:1px solid #e3ddd2;border-top:3px solid #a9573a;border-radius:14px;padding:28px;}
h1{font-size:20px;margin:0 0 12px;}p{font-size:15px;line-height:1.55;color:#5d564c;margin:0 0 18px;}
button{appearance:none;border:0;border-radius:10px;background:#a9573a;color:#fff;font-size:15px;
font-weight:700;padding:12px 22px;cursor:pointer;}a{color:#a9573a;}</style></head>
<body><div class="wrap"><div class="card">${body}</div></div></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(request: Request): Promise<NextResponse> {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!verifySignedToken(DIGEST_UNSUBSCRIBE_PURPOSE, token)) {
    return page("Link invalid", "<h1>Link invalid sau expirat</h1><p>Deschide linkul din cel mai recent email de digest.</p>", 400);
  }
  return page(
    "Dezabonare",
    `<h1>Nu mai vrei digestul săptămânal?</h1>
     <p>Apasă butonul de mai jos ca să nu mai primești rezumatul pe email. Notificările din aplicație rămân neschimbate.</p>
     <form method="post"><input type="hidden" name="token" value="${token.replace(/"/g, "&quot;")}">
     <button type="submit">Dezabonează-mă</button></form>`,
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const userId = verifySignedToken(DIGEST_UNSUBSCRIBE_PURPOSE, token);
  if (!userId) {
    return page("Link invalid", "<h1>Link invalid sau expirat</h1><p>Deschide linkul din cel mai recent email de digest.</p>", 400);
  }
  await setWeeklyDigestEnabled(userId, false);
  return page(
    "Dezabonat",
    "<h1>Gata, te-am dezabonat</h1><p>Nu vei mai primi digestul săptămânal. Poți reactiva oricând din setările contului.</p>",
  );
}
