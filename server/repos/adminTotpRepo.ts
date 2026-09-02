// Repo pentru al doilea factor de admin (SEC-P02) — singura zonă cu acces Drizzle pe `admin_totp`.
//
// REGULĂ TRANSVERSALĂ AICI: fiecare consum (cod TOTP, cod de rezervă) e o SINGURĂ instrucțiune SQL cu
// `RETURNING`, nu SELECT-apoi-UPDATE. `neon-http` nu are tranzacții, iar un citit-apoi-scris lasă o
// fereastră în care două cereri concurente (dublu-click, două tab-uri, retry) văd ambele aceeași stare
// „neconsumată" și trec amândouă — exact bug-ul deja reparat la tokenurile de magic link
// (`consumeAdminLoginToken`). Postgres serializează UPDATE-ul pe rând → doar una primește rândul înapoi.
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { adminTotp } from "@/db/schema";

export type AdminTotpRow = {
  email: string;
  secretEncrypted: string;
  enabled: boolean;
  backupCodesHash: string[];
  lastCounter: number | null;
};

export async function getAdminTotp(email: string): Promise<AdminTotpRow | null> {
  const [row] = await db
    .select({
      email: adminTotp.email,
      secretEncrypted: adminTotp.secretEncrypted,
      enabled: adminTotp.enabled,
      backupCodesHash: adminTotp.backupCodesHash,
      lastCounter: adminTotp.lastCounter,
    })
    .from(adminTotp)
    .where(eq(adminTotp.email, email))
    .limit(1);
  return row ?? null;
}

// Începe (sau reia) o înrolare: scrie un secret NOU, încă neactivat.
//
// GARD CRITIC: `setWhere: enabled = false`. Fără el, oricine ajunge la pagina de înrolare cu o sesiune
// intermediară (adică oricine a trecut DOAR de magic link) ar putea suprascrie secretul unui TOTP deja
// activ cu unul propriu — al doilea factor s-ar reseta singur la fiecare login, adică n-ar exista.
// Un TOTP activ se schimbă doar prin `deleteAdminTotp`, dintr-o sesiune de admin COMPLETĂ.
// Întoarce false dacă înrolarea a fost refuzată pentru că există deja un TOTP activ.
export async function startAdminTotpEnrollment(email: string, secretEncrypted: string): Promise<boolean> {
  const rows = await db
    .insert(adminTotp)
    .values({ email, secretEncrypted, enabled: false })
    .onConflictDoUpdate({
      target: adminTotp.email,
      set: { secretEncrypted, updatedAt: new Date() },
      setWhere: eq(adminTotp.enabled, false),
    })
    .returning({ email: adminTotp.email });
  return rows.length > 0;
}

// Activează TOTP-ul după ce adminul a demonstrat un cod valid din authenticator, în ACEEAȘI instrucțiune
// cu scrierea codurilor de rezervă și a contorului consumat. `enabled = false` în WHERE: o a doua cerere
// de activare (dublu-submit) nu mai rescrie codurile de rezervă ale unui TOTP deja activ.
export async function enableAdminTotp(
  email: string,
  backupCodesHash: string[],
  counter: number,
): Promise<boolean> {
  const rows = await db
    .update(adminTotp)
    .set({ enabled: true, backupCodesHash, lastCounter: counter, updatedAt: new Date() })
    .where(and(eq(adminTotp.email, email), eq(adminTotp.enabled, false)))
    .returning({ email: adminTotp.email });
  return rows.length > 0;
}

// ANTI-REPLAY, enforce-uit în DB: acceptă doar un contor STRICT mai mare decât ultimul.
// Verificarea din `server/domain/adminTotp.ts` (`verifyTotpCode`) e prima linie, dar e citire-apoi-decizie:
// două cereri simultane cu ACELAȘI cod ar citi amândouă același `lastCounter` și ar trece amândouă.
// Condiția de aici e arbitrul real — false = cod deja consumat.
export async function consumeTotpCounter(email: string, counter: number): Promise<boolean> {
  const rows = await db
    .update(adminTotp)
    .set({ lastCounter: counter, updatedAt: new Date() })
    .where(
      and(
        eq(adminTotp.email, email),
        eq(adminTotp.enabled, true),
        sql`(${adminTotp.lastCounter} IS NULL OR ${adminTotp.lastCounter} < ${counter})`,
      ),
    )
    .returning({ email: adminTotp.email });
  return rows.length > 0;
}

// Consumă un cod de rezervă ATOMIC: `array_remove` + verificarea apartenenței în același UPDATE.
// One-time real — din două cereri concurente cu același cod doar una primește rândul înapoi.
export async function consumeBackupCode(email: string, codeHash: string): Promise<boolean> {
  const rows = await db
    .update(adminTotp)
    .set({
      backupCodesHash: sql`array_remove(${adminTotp.backupCodesHash}, ${codeHash})`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(adminTotp.email, email),
        eq(adminTotp.enabled, true),
        sql`${codeHash} = ANY(${adminTotp.backupCodesHash})`,
      ),
    )
    .returning({ email: adminTotp.email });
  return rows.length > 0;
}

// Numărul de coduri de rezervă rămase — afișat în panou ca adminul să știe când să regenereze.
export async function countRemainingBackupCodes(email: string): Promise<number> {
  const row = await getAdminTotp(email);
  return row?.backupCodesHash.length ?? 0;
}

// Resetează complet al doilea factor (dispozitiv pierdut, rotire). Apelabil DOAR dintr-o sesiune de admin
// completă — următorul login intră din nou pe fluxul de înrolare.
export async function deleteAdminTotp(email: string): Promise<void> {
  await db.delete(adminTotp).where(eq(adminTotp.email, email));
}
