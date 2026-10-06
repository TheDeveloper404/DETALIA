import Link from "next/link";
import { MailCheck } from "lucide-react";
import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import styles from "@/components/public-pages/public-pages.module.css";

// Pagină custom pentru `verifyRequest` (Auth.js) — afișată după ce userul cere magic link-ul.
// Înlocuiește pagina default (temă întunecată, engleză) cu limbajul vizual DETALIA: același shell
// de auth (header brand + fundal blueprint + paletă caldă) și copy în română. Cablată în lib/auth.ts.
export const metadata: Metadata = { title: "Verifică emailul" };

export default function VerifyRequestPage() {
  return (
    <AuthShell mode="login">
      <section aria-labelledby="verify-request-title">
        <span
          aria-hidden
          className="mb-1 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <MailCheck className="size-6" />
        </span>
        <h1 id="verify-request-title">Verifică-ți email-ul</h1>
        <p className={styles.authDescription}>
          Ți-am trimis un link de acces. Deschide-l ca să intri în cont — link-ul e valabil un timp
          scurt și se folosește o singură dată.
        </p>
        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-secondary/60 px-3.5 py-3 font-mono text-xs leading-relaxed text-muted-foreground">
          <span
            aria-hidden
            className="mt-1 inline-block size-[5px] flex-none rotate-45 bg-primary"
          />
          Nu vezi mailul? Verifică folderul Spam / Promoții sau încearcă din nou peste un minut.
        </div>

        <p className={styles.authAlternative}>
          Ai greșit adresa? <Link href="/login">Înapoi la autentificare</Link>
        </p>
      </section>
    </AuthShell>
  );
}
