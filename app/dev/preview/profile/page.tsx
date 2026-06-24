import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { ProfileView, type ProfileViewData } from "@/components/profile-view";

// Preview profil (stil LinkedIn) cu date mock — DOAR non-producție. Toggle: ?variant=neverificat.
// Componenta `ProfileView` e props-driven, gândită să fie alimentată cu date reale după ce modelul
// de date primește câmpurile necesare (bio, locație, specializări) + agregările (statistici, taburi).
export default async function DevProfilePreview({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { variant } = await searchParams;
  const verified = variant !== "neverificat";

  // Heatmap mock — 53 săptămâni de niveluri pseudo-aleatoare deterministe (preview, fără DB).
  // Bază fixă (determinist, fără `Date.now` — interzis în render).
  const mockBase = Date.UTC(2025, 5, 1);
  const mockContributions = Array.from({ length: 53 * 7 }, (_, i) => {
    const level = [0, 0, 1, 0, 2, 1, 3, 0, 4, 1][(i * 7) % 10];
    const count = [0, 0, 2, 0, 4, 1, 7, 0, 12, 2][(i * 7) % 10];
    const date = new Date(mockBase + i * 86_400_000).toISOString().slice(0, 10);
    return { date, count, level };
  });
  const mockContributionsTotal = mockContributions.reduce((s, d) => s + d.count, 0);

  const data: ProfileViewData = {
    name: "Andrei Munteanu",
    image: null,
    roleLabel: "Proiectant · Arhitect",
    location: "Cluj-Napoca",
    website: { href: "https://exemplu.ro", label: "exemplu.ro" },
    bio: "Proiectez structuri și detalii de execuție pentru locuințe și clădiri publice de peste 12 ani. Mă interesează acolo unde proiectul întâlnește șantierul — aticuri, racorduri, hidroizolații.",
    about:
      "Lucrez la limita dintre proiect și execuție: prefer un detaliu care se poate pune în operă, nu unul care arată bine doar pe planșă. Cred în dezbaterea deschisă între roluri.",
    specializations: ["Acoperișuri terasă", "Hidroizolații", "Structuri", "Termosistem"],
    verified,
    stats: { published: 24, sketches: 58, validationsGiven: 312, validationsReceived: 476 },
    details: [
      { id: "d1", title: "Atic acoperiș terasă", categoryName: "Acoperișuri", validationCount: 14, sketchCount: 4 },
      { id: "d2", title: "Hidroizolație la radier", categoryName: "Fundații", validationCount: 31, sketchCount: 5 },
      { id: "d3", title: "Streașină la șarpantă", categoryName: "Acoperișuri", validationCount: 18, sketchCount: 3 },
      { id: "d4", title: "Termosistem la glaf", categoryName: "Fațade", validationCount: 22, sketchCount: 6 },
    ],
    sketches: [
      { id: "s1", parentTitle: "Atic acoperiș terasă", title: "Propunere: șorț continuu peste rost", statusLabel: "larg aprobată · 12 validări", statusKind: "approved" },
      { id: "s2", parentTitle: "Racord hidroizolație baie", title: "Propunere: scafă armată în colț", statusLabel: "disputată pe roluri", statusKind: "disputed" },
      { id: "s3", parentTitle: "Streașină la șarpantă", title: "Propunere: aerisire sub țiglă", statusLabel: "în dezbatere · 5 validări", statusKind: "open" },
    ],
    activity: [
      { id: "a1", kind: "approve", target: "Hidroizolație la radier", asRole: "Proiectant", time: "acum 2 zile" },
      { id: "a2", kind: "disapprove", target: "Termosistem la glaf", asRole: "Proiectant", justification: "Polistirenul nu intră pe glaf — apare punte termică pe conturul golului.", time: "acum 4 zile" },
      { id: "a3", kind: "comment", target: "Streașină la șarpantă", time: "acum 6 zile" },
      { id: "a4", kind: "publish", target: "Atic acoperiș terasă", time: "acum 1 săptămână" },
    ],
    editHref: "#",
    viewerIsOwner: true,
    contributions: mockContributions,
    contributionsTotal: mockContributionsTotal,
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-50 flex h-16 items-center border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1080px] items-center justify-between px-6">
          <BrandLogo href="/dev/preview" />
          <div className="flex items-center gap-3">
            <Link
              href={verified ? "?variant=neverificat" : "?variant=verificat"}
              className="rounded-full border border-border bg-card px-3 py-1 font-mono text-xs text-muted-foreground no-underline hover:border-primary"
            >
              {verified ? "Vezi neverificat →" : "Vezi verificat →"}
            </Link>
            <span className="rounded-full border border-border bg-secondary px-3 py-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Preview · profil
            </span>
          </div>
        </div>
      </header>

      <ProfileView data={data} />
    </div>
  );
}
