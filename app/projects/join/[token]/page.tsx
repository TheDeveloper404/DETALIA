import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { auth } from "@/lib/auth";
import { checkLimit, clientIp, limiters } from "@/lib/rate-limit";
import { getProjectPreviewByToken } from "@/server/services/projectService";

import { JoinButton } from "./join-button";

// Pagină PUBLICĂ (fără cont) — invitație la un proiect. Anti-enumerare: token inexistent/regenerat
// → 404, fără să distingem cauza (la fel ca /s/[id]). Numele proiectului e singurul lucru expus fără
// sesiune — un vizitator anonim trebuie să vadă ÎN CE se alătură înainte de a se autentifica.
// SEC-003 (audit 2026-08-11): fără sesiune, fără noindex — ruta trebuia (a) exclusă din index/unfurl
// automat de boți, (b) protejată de rate limit pe IP (SELECT nelimitat altfel, per request anonim).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  // Rate-limit ÎNAINTE de DB — la limită depășită, titlu generic (fără al doilea SELECT nelimitat;
  // pagina însăși tot va bloca mai jos, cu 429 implicit prin lipsa conținutului real).
  const ip = await clientIp();
  if (!(await checkLimit(limiters.projectInvitePreviewPerIp, ip)).ok) {
    return { robots: { index: false, follow: false }, title: "Invitație" };
  }
  const project = await getProjectPreviewByToken(token);
  if (!project) return { robots: { index: false, follow: false }, title: "Invitație indisponibilă" };
  return { robots: { index: false, follow: false }, title: `Invitație: ${project.name}` };
}

export default async function JoinProjectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ip = await clientIp();
  if (!(await checkLimit(limiters.projectInvitePreviewPerIp, ip)).ok) notFound();
  const project = await getProjectPreviewByToken(token);
  if (!project) notFound();

  const session = await auth();
  const returnUrl = `/projects/join/${token}`;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-16 text-center">
      <BrandLogo />
      <div className="max-w-[46ch]">
        <h1 className="mb-2 font-heading text-2xl font-extrabold tracking-tight">
          Ai fost invitat în proiectul „{project.name}&rdquo;
        </h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          Un spațiu de colaborare restrânsă — vizibil doar membrilor, până când cineva decide să scoată
          un detaliu în comunitate.
        </p>
      </div>

      {session?.user?.id ? (
        <JoinButton token={token} />
      ) : (
        <div className="flex flex-col items-center gap-2.5">
          <a
            href={`/login?callbackUrl=${encodeURIComponent(returnUrl)}`}
            className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground no-underline"
          >
            Autentifică-te
          </a>
          <a
            href={`/signup?callbackUrl=${encodeURIComponent(returnUrl)}`}
            className="text-sm text-muted-foreground underline underline-offset-2"
          >
            Sau creează-ți un cont
          </a>
        </div>
      )}
    </main>
  );
}
