import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";

// Găsit la /code-review (2026-08-11): auth() + re-check status ACTIV era duplicat identic în ambele
// rute /api/project-image/* (și mai există o a 3-a copie în /api/blob/upload) — extras aici ca viitoare
// rute JSON/binare autenticate să nu mai copieze blocul. NU e potrivit pt server actions/pagini (acolo
// `requireActiveUserId`, lib/require-active-user.ts, face redirect — greșit într-o rută API).
export async function requireActiveApiUserId(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Autentificare necesară." } },
        { status: 401 },
      ),
    };
  }
  // SEC-04: status JWT e stale → re-check proaspăt din DB.
  const [userRow] = await db
    .select({ status: users.status })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!userRow || userRow.status !== "ACTIVE") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Autentificare necesară." } },
        { status: 401 },
      ),
    };
  }
  return { ok: true, userId: session.user.id };
}
