import { encode } from "@auth/core/jwt";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { accounts, details, roles, sessions, users } from "../db/schema";

// E2E — ștergere de cont (GDPR, `deleteAccountAction` → `accountService.deleteAccount`), CRITICAL
// (date sensibile, ireversibil) și PÂNĂ ACUM fără nicio acoperire e2e — doar unitar
// (`accountService.test.ts`), care nu verifică fluxul real de UI + delogare + acces ulterior.
// User DEDICAT, aruncat la finalul testului — NU userul din `authed` (ireversibil, ar strica storageState-ul
// altor suite care rulează în paralel).

const TARGET_EMAIL = `e2e-delete-target-${Date.now()}@detalia.test`;
const TARGET_NAME = "E2E Delete Target";

test("ștergere cont: anonimizare, delogare reală, conținutul rămâne, acces ulterior blocat", async ({
  browser,
  baseURL,
}) => {
  const [user] = await db
    .insert(users)
    .values({
      email: TARGET_EMAIL,
      name: TARGET_NAME,
      firstName: "E2E",
      lastName: "Target",
      status: "ACTIVE",
      emailVerified: new Date(),
    })
    .returning({ id: users.id });
  const userId = user.id;

  // Rol cu verificare ACTIVĂ (dovadă + status VERIFIED) — ca să confirmăm că ștergerea o resetează,
  // nu doar că lasă un rând implicit needevizuit (test slab).
  await db.insert(roles).values({
    userId,
    roleMain: "PROIECTANT",
    subRole: "Arhitect",
    verificationStatus: "VERIFIED",
    verificationEvidence: "e2e-fake-cui-evidence",
  });

  // Un detaliu PUBLICAT al userului — politica e anonimizare (tombstone), nu hard-delete: conținutul
  // trebuie să rămână, doar autorul devine anonim.
  const [detail] = await db
    .insert(details)
    .values({
      title: `E2E ștergere cont — detaliu ${Date.now()}`,
      authorId: userId,
      imageUrl: "https://e2e.public.blob.vercel-storage.com/e2e-placeholder.png",
      status: "PUBLISHED",
    })
    .returning({ id: details.id });

  const url = new URL(baseURL ?? "http://localhost:3000");
  const secure = url.protocol === "https:";
  const cookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
  const maxAgeSeconds = 30 * 86_400;

  const sessionToken = await encode({
    secret: process.env.AUTH_SECRET!,
    salt: cookieName,
    maxAge: maxAgeSeconds,
    token: { sub: userId, id: userId, status: "ACTIVE", name: TARGET_NAME, email: TARGET_EMAIL },
  });

  const context = await browser.newContext({
    storageState: {
      cookies: [
        {
          name: cookieName,
          value: sessionToken,
          domain: url.hostname,
          path: "/",
          expires: Math.floor((Date.now() + maxAgeSeconds * 1000) / 1000),
          httpOnly: true,
          secure,
          sameSite: "Lax",
        },
      ],
      origins: [],
    },
  });

  try {
    const page = await context.newPage();

    await page.goto("/profile/edit");
    await page.getByRole("button", { name: "Șterge contul", exact: true }).click();
    await page.getByLabel(/Scrie ȘTERGE ca să confirmi/).fill("ȘTERGE");
    await page.getByRole("button", { name: "Confirm ștergerea definitivă" }).click();

    // `deleteAccountAction` face `signOut({ redirectTo: "/" })` — semnalul real că fluxul a mers.
    await expect(page).toHaveURL(`${url.origin}/`, { timeout: 15_000 });

    // DIAGNOSTIC (2026-08-07, eșec real reprodus pe preview: /profile/edit rămâne accesibil după
    // signOut()) — verificăm DIRECT dacă cookie-ul de sesiune chiar a fost șters din context de către
    // signOut(), înainte să presupunem cauza. Dacă asertarea de mai jos pică, problema e signOut()
    // însuși (nu golește cookie-ul); dacă trece dar /profile/edit tot se încarcă, problema e altundeva
    // (cache/pagina nu re-verifică).
    const cookiesAfterSignOut = await context.cookies();
    const sessionCookieStillPresent = cookiesAfterSignOut.some((c) => c.name === cookieName);
    expect(sessionCookieStillPresent, "signOut() ar trebui să șteargă cookie-ul de sesiune imediat").toBe(false);

    // Rândul user: PII șters, email placeholder, status DELETED.
    const [row] = await db
      .select({ email: users.email, name: users.name, status: users.status, image: users.image })
      .from(users)
      .where(eq(users.id, userId));
    expect(row.status).toBe("DELETED");
    expect(row.name).toBe("[cont șters]");
    expect(row.email).toMatch(/^deleted-.+@deleted\.invalid$/);
    expect(row.email).not.toBe(TARGET_EMAIL);
    expect(row.image).toBeNull();

    // Dovada de rol (PII) ștearsă, verificarea resetată la starea de bază.
    const [roleRow] = await db
      .select({ verificationStatus: roles.verificationStatus, verificationEvidence: roles.verificationEvidence })
      .from(roles)
      .where(eq(roles.userId, userId));
    expect(roleRow.verificationStatus).toBe("DECLARED");
    expect(roleRow.verificationEvidence).toBeNull();

    // Autentificarea revocată server-side (nu doar cookie-ul din browser).
    const remainingSessions = await db.select().from(sessions).where(eq(sessions.userId, userId));
    const remainingAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));
    expect(remainingSessions).toHaveLength(0);
    expect(remainingAccounts).toHaveLength(0);

    // Conținutul RĂMÂNE (politica de anonimizare, nu hard-delete) — nu se șterge dezbaterea altora.
    const [detailRow] = await db
      .select({ status: details.status, authorId: details.authorId })
      .from(details)
      .where(eq(details.id, detail.id));
    expect(detailRow.status).toBe("PUBLISHED");
    expect(detailRow.authorId).toBe(userId);

    // Acces ulterior blocat: signOut() a golit cookie-ul de sesiune pe RĂSPUNSUL acestei acțiuni (nu e
    // scenariul de JWT-stale de la suspended.spec.ts) — o navigare nouă în același context nu mai vede
    // sesiunea. Pagina protejată redirectează (login/onboarding/home), nu mai arată profilul.
    await page.goto("/profile/edit");
    await expect(page).not.toHaveURL(/\/profile\/edit$/);
  } finally {
    await context.close();
    await db.delete(details).where(eq(details.id, detail.id));
    await db.delete(roles).where(eq(roles.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  }
});
