import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { HeroPreview } from "@/components/hero-preview";
import { IntroSplash } from "@/components/intro-splash";
import { Reveal } from "@/components/reveal";

// Landing public DETALIA — import din Claude Design („Detalia Landing.dc.html"), hero varianta B
// (planșă în panou + voturi pe roluri) + CTA final dark. Paletă proprie de brand (bej cald / teracotă)
// cu fonturile Archivo + IBM Plex Mono — intenționat separată de tokenii UI shadcn (restul aplicației).
// Rutele /signup /login /feed sunt cablate; pentru userii autentificați CTA-urile devin „Mergi la feed".
// Auth passwordless: doar magic link pe email (Google scos pentru MVP).
//
// Responsive: heading-urile și padding-urile verticale folosesc clamp() (fluide, fără media queries);
// grilele de carduri folosesc repeat(auto-fit, minmax(...)) → colapsează singure pe ecrane înguste;
// singura grilă cu media query e hero B (`.dc-hero-grid` în globals.css).

const SANS = "var(--font-archivo), sans-serif";
const MONO = "var(--font-plex-mono), monospace";

// Padding vertical de secțiune, fluid între mobil și desktop.
const SECTION_PAD = "clamp(56px, 9vw, 92px) 24px";

// Lățimea maximă a conținutului principal (header, hero, secțiunile 01–04, footer).
// FAQ și CTA-ul dark rămân mai înguste, centrate intenționat (lizibilitate text centrat).
// Lățime unică pe aplicație (vezi --container-max din globals.css).
const MAXW = "var(--container-max)";

// Secțiunea 01 — „diff" (metafora GitHub): fiecare problemă de azi (−) e înlocuită de soluția DETALIA (+).
const DIFF = [
  {
    minus: "Detaliile circulă în PDF-uri răzlețe, pe mail și pe WhatsApp.",
    plus: "Stau într-un singur loc viu, deschis breslei.",
  },
  {
    minus: "Fiecare le desenează altfel — nu există un punct de referință.",
    plus: "Oricine desenează o propunere direct peste detaliu.",
  },
  {
    minus: "Nimeni nu le contestă pe roluri; proiectantul nu aude executantul.",
    plus: "Fiecare rol aprobă sau dezaprobă — dezacordul vine cu justificare.",
  },
  {
    minus: "Aceleași greșeli de execuție se repetă de la șantier la șantier.",
    plus: "Detaliul bun iese la suprafață prin dezbatere, nu printr-un scor.",
  },
];

const STEPS = [
  {
    n: "PASUL 01",
    title: "Publici un detaliu",
    body: "Încarci desenul de execuție și contextul: ce element e, unde se pune și din ce e alcătuit.",
  },
  {
    n: "PASUL 02",
    title: "Primești propuneri desenate",
    body: "Alți profesioniști desenează direct peste el cum ar trebui făcut — nu în vorbe, ci pe desen.",
  },
  {
    n: "PASUL 03",
    title: "Comunitatea validează pe roluri",
    body: "Fiecare aprobă sau dezaprobă cu numele și rolul afișat. O dezaprobare vine mereu cu o justificare.",
  },
];

// Secțiunea 03 — listă editorială (fără carduri). `label` = tema beneficiului (încodează ceva real,
// servește ca rubrică mono în stânga fiecărui rând).
const BENEFITS = [
  {
    label: "Încredere",
    title: "Detalii verificate de breaslă",
    body: "Nu te bazezi pe un singur autor: detaliul trece prin ochii mai multor roluri înainte să ajungă pe șantier.",
  },
  {
    label: "Transparență",
    title: "Vezi cine aprobă și cu ce rol",
    body: "Părerea unui proiectant și a unui executant cântăresc diferit — și le ai pe amândouă la vedere.",
  },
  {
    label: "Învățare",
    title: "Înveți din dezacord",
    body: "Cele mai utile lucruri stau în motivele unei dezaprobări, nu în aprobările tăcute.",
  },
  {
    label: "Reputație",
    title: "Îți construiești reputația",
    body: "Propunerile și părerile tale rămân legate de numele tău profesional, vizibile breslei.",
  },
];


const SUBLINE = "Alătură-te chiar azi comunității";

// — Stiluri reutilizate —
const eyebrowDiamond: CSSProperties = {
  width: 6,
  height: 6,
  background: "#a9573a",
  transform: "rotate(45deg)",
  display: "inline-block",
};
const eyebrow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontFamily: MONO,
  fontSize: 12,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "#a9573a",
  marginBottom: 18,
};
const h2: CSSProperties = {
  fontFamily: SANS,
  fontWeight: 700,
  fontSize: "clamp(26px, 4.2vw, 36px)",
  lineHeight: 1.1,
  letterSpacing: "-0.02em",
  margin: 0,
  textWrap: "balance",
};
const primaryBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  background: "#a9573a",
  color: "#ffffff",
  fontFamily: SANS,
  fontWeight: 600,
  fontSize: 16,
  padding: "14px 26px",
  borderRadius: "var(--radius)",
  textDecoration: "none",
  border: "1px solid #95492e",
};
const outlineBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  background: "#ffffff",
  color: "#211d18",
  fontFamily: SANS,
  fontWeight: 600,
  fontSize: 16,
  padding: "14px 26px",
  borderRadius: "var(--radius)",
  textDecoration: "none",
  border: "1px solid #d8cfc0",
};

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div style={eyebrow}>
      <span style={eyebrowDiamond} />
      {children}
    </div>
  );
}

export default function Home() {
  // Landing public (anonim). Redirectul user-logat → /feed se face în `proxy.ts` (307 curat,
  // fără meta-refresh) — un user autentificat nu ajunge niciodată să randeze pagina asta.
  return (
    <div
      className="dc-landing"
      style={{
        fontFamily: SANS,
        color: "#211d18",
        background: "#faf8f4",
        fontSize: 16,
        lineHeight: 1.5,
        flex: 1,
      }}
    >
      {/* Intro de brand (logo animat) — o singură dată pe sesiune, înaintea landing-ului. */}
      <IntroSplash />

      {/* ===== HEADER ===== */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          height: 64,
          display: "flex",
          alignItems: "center",
          background: "rgba(250,248,244,0.86)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid #e3ddd2",
        }}
      >
        <div
          style={{
            maxWidth: MAXW,
            margin: "0 auto",
            width: "100%",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <span style={{ width: 9, height: 9, background: "#a9573a", transform: "rotate(45deg)", display: "inline-block" }} />
            <span style={{ fontFamily: SANS, fontWeight: 800, letterSpacing: "0.2em", fontSize: 18, color: "#211d18" }}>
              DETALIA
            </span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <Link href="/login" className="dc-link" style={{ fontSize: 14.5, color: "#211d18", textDecoration: "none", fontWeight: 500, transition: "color .15s" }}>
              Autentificare
            </Link>
            <Link href="/signup" className="dc-btn-primary" style={{ ...primaryBtn, fontSize: 14, padding: "9px 16px", borderRadius: "var(--radius)" }}>
              Creează cont
            </Link>
          </div>
        </div>
      </header>

      {/* ===== HERO (varianta B — planșă în panou + voturi pe roluri) ===== */}
      <section style={{ background: "#faf8f4", position: "relative", overflow: "hidden" }}>
        {/* Fundal blueprint — identic cu login/signup (grilă fină mascată radial spre dreapta). */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            backgroundImage:
              "linear-gradient(#eae0cf 1px,transparent 1px),linear-gradient(90deg,#eae0cf 1px,transparent 1px)",
            backgroundSize: "34px 34px",
            opacity: 0.6,
            WebkitMaskImage: "radial-gradient(120% 90% at 82% 42%,#000 0%,transparent 72%)",
            maskImage: "radial-gradient(120% 90% at 82% 42%,#000 0%,transparent 72%)",
          }}
        />
        <div
          className="dc-hero-grid"
          style={{ position: "relative", zIndex: 1, maxWidth: MAXW, margin: "0 auto", padding: "clamp(72px, 10vw, 124px) 24px clamp(64px, 8vw, 96px)" }}
        >
          {/* Coloana text */}
          <div>
            <div style={{ ...eyebrow, marginBottom: 24, fontSize: 12 }}>
              <span style={eyebrowDiamond} />
              Pre-lansare · Comunitate profesională
            </div>
            <h1
              style={{
                fontFamily: SANS,
                fontWeight: 800,
                fontSize: "clamp(34px, 5.4vw, 54px)",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                margin: "0 0 22px",
                color: "#211d18",
                textWrap: "balance",
              }}
            >
              Detaliul de execuție, pus la dezbatere <span style={{ color: "#a9573a" }}>pe roluri</span>.
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.55, color: "#5d564c", margin: "0 0 34px", maxWidth: 520, textWrap: "pretty" }}>
              Publici un detaliu, alți profesioniști desenează propuneri direct peste el, iar comunitatea îl
              validează deschis — fiecare cu numele și rolul lui.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
              <Link href="/signup" className="dc-btn-primary" style={primaryBtn}>
                Creează cont gratuit
              </Link>
              <Link href="/login" className="dc-btn-outline" style={outlineBtn}>
                Autentificare
              </Link>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12.5, color: "#8a8073", marginTop: 20, letterSpacing: "0.02em" }}>
              {SUBLINE}
            </div>
          </div>

          {/* Coloana card preview (planșă + voturi pe roluri) — animat, loop ~6s. */}
          <HeroPreview />
        </div>
      </section>

      {/* ===== 01 · PROBLEMA & SOLUȚIA ===== */}
      <section style={{ background: "#faf8f4", borderTop: "1px solid #ece4d6" }}>
        <div style={{ maxWidth: MAXW, margin: "0 auto", padding: SECTION_PAD }}>
          <Eyebrow>01 — Problema &amp; soluția</Eyebrow>
          <h2 style={{ ...h2, margin: "0 0 8px", maxWidth: "20ch" }}>
            Detaliile bune se pierd. Greșelile se repetă.
          </h2>
          <p style={{ fontSize: 17, color: "#5d564c", margin: "0 0 44px", maxWidth: "60ch", textWrap: "pretty" }}>
            Același detaliu de execuție e desenat de zeci de ori, în zeci de feluri, fără ca cineva să-l pună la
            îndoială pe roluri.
          </p>

          {/* Panou „diff" — metafora GitHub: problema de azi (−) înlocuită de soluția DETALIA (+). */}
          <Reveal>
          <div
            style={{
              border: "1px solid #e3ddd2",
              borderRadius: "var(--radius)",
              overflow: "hidden",
              background: "#fffdf9",
              boxShadow: "0 20px 48px -32px rgba(33,29,24,0.32)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid #eee6da",
                background: "#f6f1e8",
                fontFamily: MONO,
                fontSize: 12,
                letterSpacing: "0.04em",
                color: "#8a8073",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 8, height: 8, background: "#a9573a", transform: "rotate(45deg)", display: "inline-block" }} />
                starea-breslei.diff
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 12, fontWeight: 600 }}>
                <span style={{ color: "#2f6b3f" }}>+4</span>
                <span style={{ color: "#b0463c" }}>−4</span>
              </span>
            </div>

            {DIFF.map((d, i) => (
              <div key={d.minus} style={{ borderTop: i ? "1px solid #f0e9dd" : "none" }}>
                <DiffLine sign="−" text={d.minus} kind="del" />
                <DiffLine sign="+" text={d.plus} kind="add" />
              </div>
            ))}
          </div>
          </Reveal>
        </div>
      </section>

      {/* ===== 02 · CUM FUNCȚIONEAZĂ ===== */}
      <section style={{ background: "#f3efe8", borderTop: "1px solid #e6ddcf" }}>
        <div style={{ maxWidth: MAXW, margin: "0 auto", padding: SECTION_PAD }}>
          <Eyebrow>02 — Cum funcționează</Eyebrow>
          <h2 style={{ ...h2, margin: "0 0 48px", maxWidth: "20ch" }}>Trei pași, de la desen la validare.</h2>

          {/* Storyboard — același detaliu evoluează cadru cu cadru (publicat → propus → validat).
              Reveal în cascadă (stânga→dreapta) la scroll, ca să sublinieze fluxul. */}
          <div className="dt-flow">
            <Reveal delay={0}>
              <FlowStep step={1} data={STEPS[0]} />
            </Reveal>
            <span className="dt-flow-arrow" aria-hidden>
              →
            </span>
            <Reveal delay={120}>
              <FlowStep step={2} data={STEPS[1]} />
            </Reveal>
            <span className="dt-flow-arrow" aria-hidden>
              →
            </span>
            <Reveal delay={240}>
              <FlowStep step={3} data={STEPS[2]} />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== 03 · CE CÂȘTIGI ===== */}
      <section style={{ background: "#faf8f4", borderTop: "1px solid #e6ddcf" }}>
        <div style={{ maxWidth: MAXW, margin: "0 auto", padding: SECTION_PAD }}>
          <Reveal>
          <div className="dt-gains">
            {/* Coloana titlu */}
            <div>
              <Eyebrow>03 — Ce câștigi</Eyebrow>
              <h2 style={{ ...h2, margin: "0 0 16px" }}>
                Un detaliu cântărit de breaslă, nu de un singur autor.
              </h2>
              <p style={{ fontSize: 16.5, lineHeight: 1.6, color: "#5d564c", margin: 0, maxWidth: "38ch" }}>
                Nu doar un loc unde ții detalii — un mecanism prin care fiecare detaliu iese mai bun
                decât a intrat.
              </p>
            </div>

            {/* Lista beneficiilor — rânduri editoriale, separate de linii fine. */}
            <div className="dt-gain-list">
              {BENEFITS.map((b) => (
                <div key={b.title} className="dt-gain">
                  <div className="dt-gain-label">{b.label}</div>
                  <div>
                    <h3 className="dt-gain-title">{b.title}</h3>
                    <p className="dt-gain-body">{b.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </Reveal>
        </div>
      </section>

      {/* ===== 04 · PENTRU CINE ===== */}
      <section style={{ background: "#f3efe8", borderTop: "1px solid #e6ddcf" }}>
        <div style={{ maxWidth: MAXW, margin: "0 auto", padding: SECTION_PAD }}>
          <Eyebrow>04 — Pentru cine</Eyebrow>
          <h2 style={{ ...h2, margin: "0 0 48px", maxWidth: "20ch" }}>Patru roluri, în jurul aceluiași detaliu.</h2>

          <Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
            <RoleCard
              emoji="📐"
              title="Proiectant"
              body="Pui detaliul la încercare înainte de șantier și vezi unde se împiedică execuția."
            />
            <RoleCard
              emoji="👷"
              title="Executant"
              body="Arăți cum se face de fapt și semnalezi din timp ce nu se poate pune în operă."
            />
            <RoleCard
              emoji="📦"
              title="Furnizor"
              body="Aduci soluția corectă de montaj pentru produsul tău, direct pe detaliu."
            />
            <RoleCard
              emoji="🏠"
              title="Beneficiar"
              body="Înțelegi deciziile și vezi că detaliul a fost cântărit de mai mulți, nu de unul singur."
            />
          </div>
          </Reveal>
        </div>
      </section>

      {/* ===== CTA FINAL (dark) ===== */}
      <section style={{ position: "relative", overflow: "hidden", background: "#201c16" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(169,87,58,0.14) 1px,transparent 1px),linear-gradient(90deg,rgba(169,87,58,0.14) 1px,transparent 1px)",
            backgroundSize: "38px 38px",
            pointerEvents: "none",
            WebkitMaskImage: "radial-gradient(120% 100% at 50% 0%,#000,transparent 80%)",
            maskImage: "radial-gradient(120% 100% at 50% 0%,#000,transparent 80%)",
          }}
        />
        <Reveal>
        <div style={{ position: "relative", maxWidth: 880, margin: "0 auto", padding: "clamp(72px, 10vw, 104px) 24px", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#e0a07f", marginBottom: 22 }}>
            <span style={{ width: 6, height: 6, background: "#e0a07f", transform: "rotate(45deg)", display: "inline-block" }} />
            Pre-lansare
          </div>
          <h2 style={{ fontFamily: SANS, fontWeight: 800, fontSize: "clamp(28px, 4.6vw, 44px)", lineHeight: 1.08, letterSpacing: "-0.02em", margin: "0 0 18px", color: "#faf6ef", textWrap: "balance" }}>
            Suntem la început de drum. Construim împreună standardul.
          </h2>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: "#c4bcae", margin: "0 auto 36px", maxWidth: "60ch", textWrap: "pretty" }}>
            DETALIA se naște acum, cu primii profesioniști care intră. Fii printre ei și ajută la așezarea felului
            în care breasla discută un detaliu de execuție.
          </p>
          <Link
            href="/signup"
            className="dc-btn-primary-dark"
            style={{ ...primaryBtn, fontSize: 16, padding: "15px 30px", border: "1px solid #c06b46" }}
          >
            Creează cont gratuit
          </Link>
          <div style={{ fontFamily: MONO, fontSize: 12.5, color: "#8c8475", marginTop: 20, letterSpacing: "0.02em" }}>
            Alătură-te chiar azi comunității
          </div>
        </div>
        </Reveal>
      </section>

      {/* ===== FOOTER ===== */}
      <footer style={{ background: "#1b1813", color: "#c4bcae" }}>
        <div
          style={{
            maxWidth: MAXW,
            margin: "0 auto",
            padding: "46px 24px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 9, height: 9, background: "#a9573a", transform: "rotate(45deg)", display: "inline-block" }} />
              <span style={{ fontFamily: SANS, fontWeight: 800, letterSpacing: "0.2em", fontSize: 17, color: "#faf6ef" }}>DETALIA</span>
            </div>
            <span style={{ fontSize: 14, color: "#8c8475" }}>Detaliul de execuție, pus la dezbatere pe roluri.</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <span style={{ fontFamily: MONO, fontSize: 12.5, color: "#6f685e" }}>© {new Date().getFullYear()} DETALIA</span>
          </div>
        </div>
      </footer>
    </div>
  );
}


// O linie de diff (secțiunea 01): gutter mono cu semn colorat + textul. „del" = problema veche
// (estompată), „add" = soluția DETALIA (prezentă).
function DiffLine({ sign, text, kind }: { sign: string; text: string; kind: "del" | "add" }) {
  const del = kind === "del";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "46px 1fr",
        background: del ? "rgba(176,70,60,0.05)" : "rgba(47,107,63,0.06)",
      }}
    >
      <span
        aria-hidden
        style={{
          fontFamily: MONO,
          fontSize: 16,
          fontWeight: 700,
          textAlign: "center",
          padding: "13px 0",
          color: del ? "#b0463c" : "#2f6b3f",
          borderRight: `1px solid ${del ? "rgba(176,70,60,0.18)" : "rgba(47,107,63,0.18)"}`,
          userSelect: "none",
        }}
      >
        {sign}
      </span>
      <span style={{ padding: "13px 18px", fontSize: 15.5, lineHeight: 1.5, color: del ? "#6f675c" : "#34302a" }}>
        {text}
      </span>
    </div>
  );
}

// Un cadru din storyboard-ul secțiunii 02 — același detaliu evoluează: gol → cu o propunere
// desenată peste → validat pe roluri (✓/✕). Mini-planșă pe grilă, ca în restul brandului.
function FlowFrame({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div
      style={{
        position: "relative",
        height: 150,
        borderRadius: "var(--radius)",
        border: "1px solid #e3ddd2",
        background: "#faf7f1",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(#ece1cd 1px,transparent 1px),linear-gradient(90deg,#ece1cd 1px,transparent 1px)",
          backgroundSize: "22px 22px",
          opacity: 0.5,
        }}
      />
      <svg
        viewBox="0 0 200 120"
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
        style={{ position: "relative", display: "block" }}
        aria-hidden
      >
        {/* detaliul de bază (grafit) — estompat la pasul de validare */}
        <g opacity={step === 3 ? 0.5 : 1}>
          <rect x="46" y="30" width="108" height="60" stroke="#bfae93" strokeWidth="2" fill="none" />
          <line x1="46" y1="60" x2="154" y2="60" stroke="#d3c4aa" strokeWidth="1.5" />
          <line x1="92" y1="30" x2="92" y2="90" stroke="#d3c4aa" strokeWidth="1.5" />
        </g>
        {/* pasul 2: propunerea desenată peste (terracotta) */}
        {step === 2 && (
          <path d="M58 78 C 82 44, 108 94, 150 52" stroke="#a9573a" strokeWidth="3" fill="none" strokeLinecap="round" />
        )}
        {/* pasul 3: validări pe roluri */}
        {step === 3 && (
          <>
            <circle cx="80" cy="56" r="15" fill="rgba(47,107,63,0.12)" stroke="#2f6b3f" strokeWidth="1.5" />
            <text x="80" y="61" textAnchor="middle" fontSize="15" fontWeight="700" fill="#2f6b3f">
              ✓
            </text>
            <circle cx="124" cy="66" r="15" fill="rgba(176,70,60,0.12)" stroke="#b0463c" strokeWidth="1.5" />
            <text x="124" y="71" textAnchor="middle" fontSize="14" fontWeight="700" fill="#b0463c">
              ✕
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

function FlowStep({ step, data }: { step: 1 | 2 | 3; data: { n: string; title: string; body: string } }) {
  return (
    <div>
      <FlowFrame step={step} />
      <div style={{ fontFamily: MONO, fontSize: 12, color: "#a9573a", letterSpacing: "0.1em", margin: "16px 0 8px" }}>
        {data.n}
      </div>
      <h3 style={{ fontFamily: SANS, fontWeight: 700, fontSize: 20, margin: "0 0 8px", color: "#211d18" }}>
        {data.title}
      </h3>
      <p style={{ fontSize: 15, color: "#5d564c", lineHeight: 1.55, margin: 0 }}>{data.body}</p>
    </div>
  );
}

function RoleCard({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <div className="dt-role-card" style={{ background: "#ffffff", border: "1px solid #e6dfd3", borderRadius: "var(--radius)", padding: 28, display: "flex", gap: 18, alignItems: "flex-start" }}>
      <span className="dt-role-emoji" aria-hidden>
        {emoji}
      </span>
      <div>
        <h3 style={{ fontFamily: SANS, fontWeight: 700, fontSize: 20, margin: "0 0 8px", color: "#211d18" }}>{title}</h3>
        <p style={{ fontSize: 15.5, color: "#5d564c", lineHeight: 1.55, margin: 0 }}>{body}</p>
      </div>
    </div>
  );
}
