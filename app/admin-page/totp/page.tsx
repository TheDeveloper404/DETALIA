import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAdminPendingSession, getAdminSession } from "@/lib/admin-auth";
import { beginAdminTotpEnrollment, getAdminTotpStatus } from "@/server/services/adminTotpService";

import { AdminTotpForm } from "./totp-form";

export const metadata: Metadata = {
  title: "Admin — al doilea factor",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Al doilea factor de admin (SEC-P02). Singura pagină care acceptă o sesiune INTERMEDIARĂ.
// Poarta din `proxy.ts` o lasă să treacă fără sesiune completă; verificarea de aici e cea care
// decide efectiv ce se randează — nu ne bazăm pe proxy ca unică barieră.
export default async function AdminTotpPage() {
  // Sesiune completă = ambii factori deja trecuți; n-are ce căuta pe ecranul de verificare.
  if (await getAdminSession()) redirect("/admin-page");

  const pending = await getAdminPendingSession();
  if (!pending) redirect("/admin-page/login?error=expired");

  const status = await getAdminTotpStatus(pending.email);

  // FAIL-CLOSED: fără cheia de criptare nu se poate nici înrola, nici verifica. Preferăm o zonă de
  // admin blocată de o configurare greșită uneia deschise cu un singur factor.
  if (!status.keyConfigured) {
    return (
      <Shell title="Al doilea factor indisponibil">
        <p className="text-sm text-muted-foreground">
          Cheia de criptare pentru al doilea factor nu e configurată pe server. Accesul în panou e
          blocat până când <code className="font-mono">ADMIN_TOTP_ENCRYPTION_KEY</code> e setată.
        </p>
      </Shell>
    );
  }

  if (status.enabled) {
    return (
      <Shell title="Confirmă-ți identitatea">
        <p className="text-sm text-muted-foreground">
          Introdu codul de 6 cifre din aplicația de authenticator. Dacă nu ai telefonul la îndemână,
          poți folosi unul dintre codurile de rezervă.
        </p>
        <AdminTotpForm mode="verify" />
      </Shell>
    );
  }

  const enrollment = await beginAdminTotpEnrollment(pending.email);
  if (!enrollment.ok) {
    // Singura cale rămasă aici e `already_enabled` printr-o cursă cu o altă filă — reîncărcarea
    // paginii aterizează pe ecranul de verificare.
    redirect("/admin-page/totp");
  }

  return (
    <Shell title="Activează al doilea factor">
      <p className="text-sm text-muted-foreground">
        Scanează codul cu aplicația de authenticator (Google Authenticator, Aegis, 1Password,
        Bitwarden), apoi confirmă cu primul cod generat. Fără acest pas nu se intră în panou.
      </p>

      {/* QR generat pe server și randat ca JSX din matricea de module — secretul nu ajunge niciodată
          la un serviciu extern de generare de coduri QR, iar în pagină nu intră niciun fragment de
          HTML brut (fără `dangerouslySetInnerHTML`). */}
      <QrCode size={enrollment.qr.size} modules={enrollment.qr.modules} />

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          Nu poți scana? Introdu cheia manual
        </summary>
        <code className="mt-2 block break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs">
          {enrollment.secretBase32}
        </code>
      </details>

      <AdminTotpForm mode="enroll" />
    </Shell>
  );
}

// Matricea de module → SVG, un `<rect>` per modul negru. Fundal alb fix (nu token de temă): cititoarele
// de QR au nevoie de contrast real, iar în temă întunecată un fundal transparent ar face codul nescanabil.
function QrCode({ size, modules }: { size: number; modules: boolean[][] }) {
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Cod QR pentru înrolarea în aplicația de authenticator"
      className="mx-auto w-44 rounded-lg bg-white p-2 ring-1 ring-foreground/10"
      shapeRendering="crispEdges"
    >
      {modules.flatMap((row, y) =>
        row.map((filled, x) =>
          filled ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#000" /> : null,
        ),
      )}
    </svg>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6 py-10">
      <h1 className="text-lg font-bold tracking-tight">{title}</h1>
      {children}
    </main>
  );
}
