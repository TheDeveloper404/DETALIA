"use client";

import { useState } from "react";

// Vizualizare de profil stil LinkedIn pentru construcții — prezentațional, props-driven.
// Folosit acum de preview-ul cu date mock; gândit ca, după ce modelul de date primește câmpurile
// necesare (bio, locație, specializări) + agregările (statistici, taburi), aceeași componentă să
// fie alimentată cu date reale. Culorile de accent (verde/amber) sunt specifice acestui ecran → inline.

export type ProfileStats = {
  published: number;
  sketches: number;
  validationsGiven: number;
  validationsReceived: number;
};

export type ProfileDetailItem = {
  id: string;
  title: string;
  categoryName: string;
  validationCount: number;
  sketchCount: number;
};

export type ProfileSketchItem = {
  id: string;
  parentTitle: string;
  title: string;
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
  roleLabel: string; // ex: „Proiectant · Arhitect"
  location: string | null;
  bio: string | null;
  about: string | null;
  specializations: string[];
  verified: boolean;
  stats: ProfileStats;
  details: ProfileDetailItem[];
  sketches: ProfileSketchItem[];
  activity: ProfileActivityItem[];
  editHref: string;
  verifyHref: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

type Tab = "detalii" | "schite" | "activitate";

export function ProfileView({ data }: { data: ProfileViewData }) {
  const [tab, setTab] = useState<Tab>("detalii");

  return (
    <div className="mx-auto w-full max-w-[1080px] px-6 pb-16">
      {/* Banner — grilă blueprint mascată radial. */}
      <div className="relative h-[180px] overflow-hidden rounded-b-2xl bg-[#ece1d3]">
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
      </div>

      {/* Header de profil. */}
      <div className="relative -mt-[46px] px-2">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex min-w-0 items-end gap-[18px]">
            <span className="flex size-[104px] shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-[#d9cab6] font-mono text-[30px] text-muted-foreground">
              {data.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.image} alt="" className="size-full object-cover" />
              ) : (
                initials(data.name)
              )}
            </span>
            <div className="min-w-0 pb-1.5">
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
                {data.location && (
                  <span className="inline-flex items-center gap-1.5 text-[13.5px] text-muted-foreground">
                    <Pin /> {data.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 pb-1.5">
            {!data.verified && (
              <a
                href={data.verifyHref}
                className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#95492e] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground no-underline"
              >
                <Star className="text-white" /> Verifică rolul
              </a>
            )}
            <a
              href={data.editHref}
              className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#d8cfc0] bg-card px-4 py-2.5 text-sm font-semibold text-foreground no-underline transition-colors hover:border-primary"
            >
              <Pencil /> Editează profil
            </a>
          </div>
        </div>

        {data.bio && (
          <p className="mt-[18px] max-w-[64ch] leading-relaxed text-muted-foreground">{data.bio}</p>
        )}

        {/* Nudge — doar dacă rolul e neverificat. */}
        {!data.verified && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#f0e3c2] bg-[#fbf4e4] px-4 py-4">
            <Star className="mt-0.5 shrink-0 text-[#d99a2b]" size={20} />
            <div className="flex-1">
              <div className="font-semibold text-[#5e4a1a]">
                Rolul tău e declarat, dar încă neverificat
              </div>
              <div className="mt-0.5 text-[13.5px] leading-relaxed text-[#7a6a3e]">
                Poți publica și valida fără restricții. Verificarea e opțională și îți adaugă steluța ★
                — un semn în plus de încredere lângă numele tău.
              </div>
            </div>
            <a
              href={data.verifyHref}
              className="shrink-0 self-center whitespace-nowrap text-[13.5px] font-semibold text-primary no-underline"
            >
              Verifică acum →
            </a>
          </div>
        )}
      </div>

      {/* Bara de statistici. */}
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[13px] border border-border bg-border sm:grid-cols-4">
        <Stat value={data.stats.published} label="Detalii publicate" />
        <Stat value={data.stats.sketches} label="Schițe propuse" />
        <Stat value={data.stats.validationsGiven} label="Validări date" />
        <Stat value={data.stats.validationsReceived} label="Validări primite" />
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

          {tab === "detalii" && <DetailsTab items={data.details} />}
          {tab === "schite" && <SketchesTab items={data.sketches} />}
          {tab === "activitate" && <ActivityTab items={data.activity} />}
        </div>

        <aside className="flex flex-col gap-[18px]">
          {(data.about || data.specializations.length > 0) && (
            <div className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
              <SectionLabel>Despre</SectionLabel>
              {data.about && (
                <p className="mb-4 mt-3 text-sm leading-relaxed text-muted-foreground">
                  {data.about}
                </p>
              )}
              {data.specializations.length > 0 && (
                <>
                  <SectionLabel>Specializări</SectionLabel>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {data.specializations.map((s) => (
                      <span
                        key={s}
                        className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[12.5px] text-foreground/80"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
            <SectionLabel>Rol &amp; verificare</SectionLabel>
            {data.verified ? (
              <>
                <div className="mb-3.5 mt-3 flex items-center gap-2.5 rounded-[10px] border border-[#f0e3c2] bg-[#fbf6ea] px-3.5 py-3">
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
                <div className="mb-3.5 mt-3 flex items-center gap-2.5 rounded-[10px] border border-border bg-secondary px-3.5 py-3">
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
                <p className="mb-3.5 text-[13px] leading-relaxed text-muted-foreground">
                  Contul tău e complet funcțional: poți publica detalii, propune schițe și valida fără
                  nicio restricție. Verificarea e opțională — adaugă doar steluța ★ lângă nume.
                </p>
                <a
                  href={data.verifyHref}
                  className="flex items-center justify-center gap-1.5 rounded-[9px] border border-[#95492e] bg-primary px-3.5 py-2.5 text-[13.5px] font-semibold text-primary-foreground no-underline"
                >
                  Verifică rolul
                </a>
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

function DetailsTab({ items }: { items: ProfileDetailItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map((d) => (
        <div key={d.id} className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="relative flex h-[120px] items-center justify-center border-b border-border bg-secondary">
            <span className="absolute left-2.5 top-2.5 rounded-md border border-[#e6dccd] bg-background/85 px-1.5 py-0.5 font-mono text-[9.5px] uppercase text-primary">
              {d.categoryName}
            </span>
          </div>
          <div className="px-4 py-3.5">
            <h3 className="mb-1.5 font-semibold">{d.title}</h3>
            <div className="font-mono text-[11px] text-muted-foreground">
              {d.validationCount} validări · {d.sketchCount} schițe
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const SKETCH_STATUS_STYLE: Record<
  ProfileSketchItem["statusKind"],
  { bg: string; border: string; fg: string }
> = {
  approved: { bg: "#e9f2ea", border: "#cfe3d2", fg: "#2f6b3f" },
  disputed: { bg: "#f6ebe9", border: "#ecd6d2", fg: "#9a3a30" },
  open: { bg: "#f3efe8", border: "#e3ddd2", fg: "#8a8073" },
};

function SketchesTab({ items }: { items: ProfileSketchItem[] }) {
  return (
    <div className="flex flex-col gap-3.5">
      {items.map((s) => {
        const st = SKETCH_STATUS_STYLE[s.statusKind];
        return (
          <div
            key={s.id}
            className="flex items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          >
            <div className="flex h-[74px] w-24 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary" />
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
          </div>
        );
      })}
    </div>
  );
}

const ACTIVITY_ICON: Record<ProfileActivityItem["kind"], { bg: string; fg: string; glyph: string }> = {
  approve: { bg: "#e9f2ea", fg: "#2f6b3f", glyph: "✓" },
  disapprove: { bg: "#f6ebe9", fg: "#9a3a30", glyph: "✕" },
  comment: { bg: "#f3efe8", fg: "#a9573a", glyph: "💬" },
  publish: { bg: "#f3efe8", fg: "#a9573a", glyph: "+" },
};

function activityText(a: ProfileActivityItem) {
  switch (a.kind) {
    case "approve":
      return (
        <>
          <b className="font-semibold">A aprobat</b> o schiță la{" "}
          <b className="font-semibold">{a.target}</b>
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
          <b className="font-semibold">A dezaprobat</b> o schiță la{" "}
          <b className="font-semibold">{a.target}</b>
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
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
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
                <div className="mt-1.5 border-l-2 border-[#ecd6d2] pl-2.5 text-[13px] leading-snug text-muted-foreground">
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

function Pin() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 21s-7-5.7-7-11a7 7 0 0 1 14 0c0 5.3-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
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
