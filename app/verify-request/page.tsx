import Link from "next/link";
import { MailCheck } from "lucide-react";

import { AuthShell } from "@/components/auth-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Pagină custom pentru `verifyRequest` (Auth.js) — afișată după ce userul cere magic link-ul.
// Înlocuiește pagina default (temă întunecată, engleză) cu limbajul vizual DETALIA: același shell
// de auth (header brand + fundal blueprint + paletă caldă) și copy în română. Cablată în lib/auth.ts.
export default function VerifyRequestPage() {
  return (
    <AuthShell mode="login">
      <Card className="w-full gap-6 [--card-spacing:--spacing(8)] shadow-[0_22px_56px_-34px_rgba(33,29,24,0.35)]">
        <CardHeader>
          <span
            aria-hidden
            className="mb-1 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <MailCheck className="size-6" />
          </span>
          <CardTitle className="text-[27px] leading-tight tracking-tight">
            Verifică-ți email-ul
          </CardTitle>
          <CardDescription className="text-[15px]">
            Ți-am trimis un link de acces. Deschide-l ca să intri în cont — link-ul e valabil un
            timp scurt și se folosește o singură dată.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-secondary/60 px-3.5 py-3 font-mono text-xs leading-relaxed text-muted-foreground">
            <span aria-hidden className="mt-1 inline-block size-[5px] flex-none rotate-45 bg-primary" />
            Nu vezi mailul? Verifică folderul Spam / Promoții sau încearcă din nou peste un minut.
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Ai greșit adresa?{" "}
            <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
              Înapoi la autentificare
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
