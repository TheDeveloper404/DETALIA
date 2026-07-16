"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ContributionGraph, type ContributionDay } from "./contribution-graph";

// Vizualizare de profil stil LinkedIn pentru construcții — prezentațional, props-driven, alimentată
// cu date reale. Culorile de accent (verde/amber) sunt specifice acestui ecran → inline.

export type ProfileStats = {
  published: number;
  sketches: number;
  validationsGiven: number;
  validationsReceived: number;
};

export type ProfileDetailItem = {
  id: string;
  title: string;
  imageUrl: string;
  categoryName: string | null;
  validationCount: number;
  sketchCount: number;
};

export type ProfileSketchItem = {
  id: string;
  detailId: string;
  parentTitle: string;
  title: string;
  thumbnailUrl: string | null;
  statusLabel: string;
  statusKind: "approved" | "disputed" | "open";
};

export type ProfileActivityItem = {
  id: string;
  kind: "approve" | "disapprove" | "comment" | "publish";
  target: string;
  asRole?: string;
  justification?: string;
  time: string;
};

export type ProfileViewData = {
  name: string;
  image: string | null;
  coverImage: string | null;
  coverPosition: number; // object-position Y (0..100) pentru banner
  roleLabel: string; // ex: „Proiectant · Arhitect"
  location: string | null;
  company: string | null;
  website: { href: string; label: string } | null;
  // Contact opțional — vine deja redactat din server (null dacă privat și tu nu ești proprietarul).
  phone: string | null;
  email: string | null;
  bio: string | null;
  about: string | null;
  verified: boolean;
  stats: ProfileStats;
  details: ProfileDetailItem[];
  sketches: ProfileSketchItem[];
  activity: ProfileActivityItem[];
  editHref: string;
  viewerIsOwner: boolean; // ascunde „Editează profil" pentru vizitatori (profil public read-only)
  contributions: ContributionDay[]; // heatmap ultimul an (zile aliniate pe săptămâni, nivel 0..4)
  contributionsTotal: number;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

type Tab = "detalii" | "schite" | "activitate";

export function ProfileView({ data }: { data: ProfileViewData }) {
  const [tab, setTab] = useState<Tab>("detalii");
  const [contactOpen, setContactOpen] = useState(false);
  const hasContactInfo = !!(data.location || data.company || data.website || data.phone || data.email);

  useEffect(() => {
    if (!contactOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setContactOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [contactOpen]);

  return (
    <div className="mx-auto w-full max-w-[1080px] px-6 pb-16">
      {/* Card unic pt banner + antet (avatar/nume/badge/bio) — coerent cu bara de statistici de mai
          jos, care are deja propriul chenar (cerință Liviu, 2026-07-16: „le-aș pune și pe astea într-un
          container"). */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* Banner — imaginea de cover dacă există, altfel grilă blueprint mascată radial. */}
      <div className="relative h-[180px] overflow-hidden bg-[#ece1d3]">
        {data.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.coverImage}
            alt=""
            className="absolute inset-0 size-full object-cover"
            style={{ objectPosition: `50% ${data.coverPosition}%` }}
          />
        ) : (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(#dccdb3 1px,transparent 1px),linear-gradient(90deg,#dccdb3 1px,transparent 1px)",
              backgroundSize: "34px 34px",
              opacity: 0.65,
              WebkitMaskImage: "radial-gradient(120% 120% at 70% 0%,#000,transparent 75%)",
              maskImage: "radial-gradient(120% 120% at 70% 0%,#000,transparent 75%)",
            }}
          />
        )}
      </div>

      {/* Header de profil. Avatarul iese peste banner; numele/rolul stau SUB banner, pe fundal —
          așa un cover închis sau aglomerat nu mai acoperă numele. */}
      <div className="relative px-5 pb-5">
        <span className="-mt-[46px] flex size-[104px] shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-[#d9cab6] font-mono text-[30px] text-muted-foreground">
          {data.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.image} alt="" className="size-full object-cover" />
          ) : (
            initials(data.name)
          )}
        </span>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[27px] font-extrabold tracking-tight">{data.name}</h1>
              {data.verified && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f0e0b4] bg-[#fbf2da] px-2.5 py-1 font-mono text-[11.5px] text-[#9a7b1f]">
                  <Star className="text-[#d99a2b]" /> Verificat
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
              <span className="rounded-full bg-primary px-2.5 py-1 font-mono text-[12.5px] text-primary-foreground">
                {data.roleLabel}
              </span>
              {hasContactInfo && (
                <button
                  type="button"
                  onClick={() => setContactOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[13px] font-semibold text-foreground/80 transition-colors hover:border-primary hover:text-primary"
                >
                  <Contact /> Date de contact
                </button>
              )}
            </div>
          </div>

          {data.viewerIsOwner && (
            <a
              href={data.editHref}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground no-underline transition-colors hover:border-primary"
            >
              <Pencil /> Editează profil
            </a>
          )}
        </div>

        {/* Modal „Date de contact" — locație/firmă/website/telefon/email grupate, ca să nu aglomereze
            antetul (2026-07-16: chip-urile inline împingeau butonul „Editează profil" la fiecare câmp
            nou activat). Telefon/email vin deja redactate din server. */}
        {contactOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
            onClick={() => setContactOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-xl border border-border bg-card p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Date de contact</h3>
                <button
                  type="button"
                  onClick={() => setContactOpen(false)}
                  aria-label="Închide"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Close />
                </button>
              </div>
              <div className="flex flex-col gap-2.5">
                {data.location && (
                  <span className="inline-flex items-center gap-2 text-[13.5px] text-muted-foreground">
                    <Pin /> {data.location}
                  </span>
                )}
                {data.company && (
                  <span className="inline-flex items-center gap-2 text-[13.5px] text-muted-foreground">
                    <Building /> {data.company}
                  </span>
                )}
                {data.website && (
                  <a
                    href={data.website.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[13.5px] text-primary underline-offset-2 hover:underline"
                  >
                    {data.website.label}
                  </a>
                )}
                {data.phone && (
                  <a
                    href={`tel:${data.phone}`}
                    className="inline-flex items-center gap-2 text-[13.5px] text-muted-foreground hover:text-primary"
                  >
                    <PhoneIcon /> {data.phone}
                  </a>
                )}
                {data.email && (
                  <a
                    href={`mailto:${data.email}`}
                    className="inline-flex items-center gap-2 text-[13.5px] text-muted-foreground hover:text-primary"
                  >
                    <MailIcon /> {data.email}
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {data.bio && (
          <p className="mt-[18px] max-w-[64ch] leading-relaxed text-muted-foreground">{data.bio}</p>
        )}
      </div>
      </div>

      {/* Bara de statistici. */}
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
        <Stat value={data.stats.published} label="Detalii publicate" />
        <Stat value={data.stats.sketches} label="Schițe propuse" />
        <Stat value={data.stats.validationsGiven} label="Validări date" />
        <Stat value={data.stats.validationsReceived} label="Validări primite" />
      </div>

      {/* Heatmap de contribuții (ultimul an). */}
      <div className="mt-6">
        <ContributionGraph days={data.contributions} total={data.contributionsTotal} />
      </div>

      {/* Grid principal: taburi (stânga) + aside (dreapta). */}
      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_312px]">
        <div className="min-w-0">
          <div className="mb-5 flex gap-1 border-b border-border">
            <TabButton active={tab === "detalii"} onClick={() => setTab("detalii")}>
              Detalii
            </TabButton>
            <TabButton active={tab === "schite"} onClick={() => setTab("schite")}>
              Schițe
            </TabButton>
            <TabButton active={tab === "activitate"} onClick={() => setTab("activitate")}>
              Activitate
            </TabButton>
          </div>

          {tab === "detalii" && <DetailsTab items={data.details} viewerIsOwner={data.viewerIsOwner} />}
          {tab === "schite" && <SketchesTab items={data.sketches} />}
          {tab === "activitate" && <ActivityTab items={data.activity} />}
        </div>

        <aside className="flex flex-col gap-[18px]">
          {data.about && (
            <div className="rounded-lg bg-card p-5 ring-1 ring-foreground/10">
              <SectionLabel>Despre</SectionLabel>
              <p className="mb-4 mt-3 text-sm leading-relaxed text-muted-foreground">
                {data.about}
              </p>
            </div>
          )}

          <div className="rounded-lg bg-card p-5 ring-1 ring-foreground/10">
            <SectionLabel>Rol &amp; verificare</SectionLabel>
            {data.verified ? (
              <>
                <div className="mb-3.5 mt-3 flex items-center gap-2.5 rounded-lg border border-[#f0e3c2] bg-[#fbf6ea] px-3.5 py-3">
                  <Star className="shrink-0 text-[#d99a2b]" size={22} />
                  <div>
                    <div className="font-semibold text-[#5e4a1a]">Rol verificat</div>
                    <div className="font-mono text-[11px] text-[#9a7b1f]">{data.roleLabel}</div>
                  </div>
                </div>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Verificarea confirmă rolul declarat lângă numele tău. Nu e un scor — doar un semn de
                  încredere pentru breaslă. Părerea ta cântărește prin rol, nu printr-un număr.
                </p>
              </>
            ) : (
              <>
                <div className="mb-3.5 mt-3 flex items-center gap-2.5 rounded-lg border border-border bg-secondary px-3.5 py-3">
                  <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-[#b6a98f] text-xs text-muted-foreground">
                    ?
                  </span>
                  <div>
                    <div className="font-semibold text-foreground">Rol declarat</div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {data.roleLabel} · neverificat
                    </div>
                  </div>
                </div>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Cont complet funcțional: poți publica detalii, propune schițe și valida fără nicio
                  restricție. <strong className="font-semibold text-foreground">Verificarea rolului nu este
                  încă disponibilă</strong> — o activăm în curând (va adăuga steluța ★ lângă nume).
                </p>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-card px-5 py-4">
      <div className="text-2xl font-extrabold text-foreground">{value}</div>
      <div className="mt-0.5 font-mono text-[11.5px] text-muted-foreground">{label}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-[14.5px] font-semibold transition-colors ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function DetailsTab({ items, viewerIsOwner }: { items: ProfileDetailItem[]; viewerIsOwner: boolean }) {
  if (items.length === 0)
    return (
      <EmptyTab>
        Niciun detaliu publicat încă.
        {viewerIsOwner && (
          <div className="mt-4">
            <Link
              href="/details/new"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#95492e] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground no-underline transition-colors hover:bg-[#974a2e]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Adaugă detaliu
            </Link>
          </div>
        )}
      </EmptyTab>
    );
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map((d) => (
        <Link
          key={d.id}
          href={`/details/${d.id}`}
          className="block overflow-hidden rounded-lg bg-card no-underline ring-1 ring-foreground/10 transition-shadow hover:ring-primary/40"
        >
          <div className="relative flex h-[120px] items-center justify-center overflow-hidden border-b border-border bg-secondary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.imageUrl} alt={d.title} className="absolute inset-0 size-full object-cover" />
            {d.categoryName && (
              <span className="absolute left-2.5 top-2.5 rounded-md border border-border bg-background/85 px-1.5 py-0.5 font-mono text-[9.5px] uppercase text-primary">
                {d.categoryName}
              </span>
            )}
          </div>
          <div className="px-4 py-3.5">
            <h3 className="mb-1.5 font-semibold text-foreground">{d.title}</h3>
            <div className="font-mono text-[11px] text-muted-foreground">
              {d.validationCount} validări · {d.sketchCount} schițe
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function EmptyTab({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

const SKETCH_STATUS_STYLE: Record<
  ProfileSketchItem["statusKind"],
  { bg: string; border: string; fg: string }
> = {
  approved: { bg: "#e9f2ea", border: "#cfe3d2", fg: "#2f6b3f" },
  // „disputat" = poziție de dezacord → culoarea destructive a sistemului (#b0463c).
  disputed: { bg: "rgba(176,70,60,0.1)", border: "rgba(176,70,60,0.3)", fg: "#b0463c" },
  open: { bg: "#f3efe8", border: "#e3ddd2", fg: "#8a8073" },
};

function SketchesTab({ items }: { items: ProfileSketchItem[] }) {
  if (items.length === 0) return <EmptyTab>Nicio schiță propusă încă.</EmptyTab>;
  return (
    <div className="flex flex-col gap-3.5">
      {items.map((s) => {
        const st = SKETCH_STATUS_STYLE[s.statusKind];
        return (
          <Link
            key={s.id}
            href={`/details/${s.detailId}`}
            className="flex items-center gap-4 rounded-lg bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:ring-foreground/20"
          >
            <div className="relative h-[74px] w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
              {s.thumbnailUrl && (
                <Image src={s.thumbnailUrl} alt="" fill sizes="96px" className="object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 font-mono text-[11px] text-muted-foreground">
                Schiță peste · {s.parentTitle}
              </div>
              <h3 className="mb-1.5 font-semibold">{s.title}</h3>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px]"
                style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.fg }}
              >
                {s.statusLabel}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

const ACTIVITY_ICON: Record<ProfileActivityItem["kind"], { bg: string; fg: string; glyph: string }> = {
  approve: { bg: "#e9f2ea", fg: "#2f6b3f", glyph: "✓" },
  disapprove: { bg: "rgba(176,70,60,0.12)", fg: "#b0463c", glyph: "✕" },
  comment: { bg: "#f3efe8", fg: "#a9573a", glyph: "💬" },
  publish: { bg: "#f3efe8", fg: "#a9573a", glyph: "+" },
};

function activityText(a: ProfileActivityItem) {
  switch (a.kind) {
    case "approve":
      return (
        <>
          <b className="font-semibold">A aprobat</b> „<b className="font-semibold">{a.target}</b>”
          {a.asRole && (
            <>
              {" "}
              — ca <span className="text-primary">{a.asRole}</span>
            </>
          )}
          .
        </>
      );
    case "disapprove":
      return (
        <>
          <b className="font-semibold">A dezaprobat</b> „<b className="font-semibold">{a.target}</b>”
          {a.asRole && (
            <>
              {" "}
              — ca <span className="text-primary">{a.asRole}</span>
            </>
          )}
          .
        </>
      );
    case "comment":
      return (
        <>
          A comentat la <b className="font-semibold">{a.target}</b>.
        </>
      );
    case "publish":
      return (
        <>
          A publicat detaliul <b className="font-semibold">{a.target}</b>.
        </>
      );
  }
}

function ActivityTab({ items }: { items: ProfileActivityItem[] }) {
  if (items.length === 0) return <EmptyTab>Nicio activitate încă.</EmptyTab>;
  return (
    <div className="overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10">
      {items.map((a, i) => {
        const icon = ACTIVITY_ICON[a.kind];
        return (
          <div
            key={a.id}
            className={`flex gap-3.5 px-4 py-4 ${i < items.length - 1 ? "border-b border-border" : ""}`}
          >
            <span
              className="flex size-[30px] shrink-0 items-center justify-center rounded-lg text-sm font-bold"
              style={{ background: icon.bg, color: icon.fg }}
            >
              {icon.glyph}
            </span>
            <div className="flex-1">
              <div className="text-sm leading-relaxed text-foreground">{activityText(a)}</div>
              {a.justification && (
                <div className="mt-1.5 border-l-2 border-destructive/30 pl-2.5 text-[13px] leading-snug text-muted-foreground">
                  „{a.justification}”
                </div>
              )}
              <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">{a.time}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Star({ className, size = 12 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z" />
    </svg>
  );
}

function Contact() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M8 17c0-2.2 1.8-3 4-3s4 .8 4 3" />
    </svg>
  );
}

function Close() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  );
}

function Pin() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 21s-7-5.7-7-11a7 7 0 0 1 14 0c0 5.3-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function Building() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
      <path d="M19 21V11a1 1 0 0 0-1-1h-3" />
      <path d="M9 7h2M9 11h2M9 15h2" />
    </svg>
  );
}

function Pencil() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
