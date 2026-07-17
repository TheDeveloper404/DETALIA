import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { CookieConsent } from "@/components/cookie-consent";
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
// Primul rând (index 0) e cel mai puternic — miezul produsului (validare pe roluri) — și se randează
// vizual mai proeminent (vezi `featured` în DiffLine); restul sunt suport, ordine descrescătoare ca greutate.
const DIFF = [
  {
    minus: "Nimeni nu le contestă pe roluri; proiectantul nu aude executantul.",
    plus: "Fiecare rol aprobă sau dezaprobă — dezacordul vine cu justificare.",
  },
  {
    minus: "Detaliile circulă în PDF-uri răzlețe, pe mail și pe WhatsApp.",
    plus: "Stau într-un singur loc viu, deschis breslei.",
  },
  {
    minus: "Fiecare le desenează altfel — nu există un punct de referință.",
    plus: "Oricine desenează o propunere direct peste detaliu.",
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

// Secțiunea 04 — aceleași 4 culori de rol ca `components/role-pill.tsx` (ROLE_STYLE), ca landing-ul
// să anticipeze exact culorile pe care userul le vede lângă orice nume în platformă.
const ROLES = [
  {
    roleLabel: "PROIECTANT",
    accent: "#a9573a",
    title: "Proiectant",
    body: "Pui detaliul la încercare înainte de șantier și vezi unde se împiedică execuția.",
  },
  {
    roleLabel: "EXECUTANT",
    accent: "#7a8a3f",
    title: "Executant",
    body: "Arăți cum se face de fapt și semnalezi din timp ce nu se poate pune în operă.",
  },
  {
    roleLabel: "FURNIZOR",
    accent: "#5e6f8a",
    title: "Furnizor",
    body: "Aduci soluția corectă de montaj pentru produsul tău, direct pe detaliu.",
  },
  {
    roleLabel: "BENEFICIAR",
    accent: "#ece4d6",
    title: "Beneficiar",
    body: "Înțelegi deciziile și vezi că detaliul a fost cântărit de mai mulți, nu de unul singur.",
  },
];

const SUBLINE = "Alătură-te chiar azi comunității";

// — Stiluri reutilizate —
const eyebrowDiamond: CSSProperties = {
  width: 6,
  height: 6,
  background: "var(--primary)",
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
  color: "var(--primary)",
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
  whiteSpace: "nowrap",
  background: "var(--primary)",
  color: "var(--primary-foreground)",
  fontFamily: SANS,
  fontWeight: 600,
  fontSize: 16,
  padding: "14px 26px",
  borderRadius: "var(--radius)",
  textDecoration: "none",
  border: "1px solid var(--primary-button-border)",
};
const outlineBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  background: "var(--card)",
  color: "var(--foreground)",
  fontFamily: SANS,
  fontWeight: 600,
  fontSize: 16,
  padding: "14px 26px",
  borderRadius: "var(--radius)",
  textDecoration: "none",
  border: "1px solid var(--border)",
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
  // LOCKDOWN-ul (mentenanță totală) e gestionat GLOBAL în proxy (rewrite la /maintenance), nu aici.
  return (
    <div
      className="dc-landing"
      style={{
        fontFamily: SANS,
        color: "var(--foreground)",
        background: "var(--background)",
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
          height: 88,
          display: "flex",
          alignItems: "center",
          background: "var(--header-bg-translucent)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          className="dc-header-inner"
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
          <BrandLogo size={38} />
          <div className="dc-header-cta" style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <Link href="/login" className="dc-link dc-header-login" style={{ fontSize: 16, color: "var(--foreground)", textDecoration: "none", fontWeight: 500, transition: "color .15s" }}>
              Autentificare
            </Link>
            <Link href="/signup" className="dc-btn-primary" style={{ ...primaryBtn, fontSize: 15.5, padding: "11px 20px", borderRadius: "var(--radius)" }}>
              Creează cont
            </Link>
          </div>
        </div>
      </header>

      {/* ===== HERO (varianta B — planșă în panou + voturi pe roluri) ===== */}
      <section style={{ background: "var(--background)", position: "relative", overflow: "hidden" }}>
        {/* Fundal blueprint — identic cu login/signup (grilă fină mascată radial spre dreapta). */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            backgroundImage:
              "linear-gradient(var(--blueprint-grid) 1px,transparent 1px),linear-gradient(90deg,var(--blueprint-grid) 1px,transparent 1px)",
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
                color: "var(--foreground)",
                textWrap: "balance",
              }}
            >
              Detaliul de execuție, pus la dezbatere <span style={{ color: "var(--primary)" }}>pe roluri</span>.
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.55, color: "var(--muted-foreground)", margin: "0 0 34px", maxWidth: 520, textWrap: "pretty" }}>
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
            <div style={{ fontFamily: MONO, fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 20, letterSpacing: "0.02em" }}>
              {SUBLINE}
            </div>
          </div>

          {/* Coloana card preview (planșă + voturi pe roluri) — animat, loop ~6s. */}
          <HeroPreview />
        </div>
      </section>

      {/* ===== 01 · PROBLEMA & SOLUȚIA ===== */}
      <section style={{ background: "var(--card)", borderTop: "1px solid var(--border)" }}>
        <div style={{ maxWidth: MAXW, margin: "0 auto", padding: SECTION_PAD }}>
          <Eyebrow>01 — Problema &amp; soluția</Eyebrow>
          <h2 style={{ ...h2, margin: "0 0 8px", maxWidth: "20ch" }}>
            Detaliile bune se pierd. Greșelile se repetă.
          </h2>
          <p style={{ fontSize: 17, color: "var(--muted-foreground)", margin: "0 0 44px", maxWidth: "60ch", textWrap: "pretty" }}>
            Același detaliu de execuție e desenat de zeci de ori, în zeci de feluri, fără ca cineva să-l pună la
            îndoială pe roluri.
          </p>

          {/* Panou „diff" — metafora GitHub: problema de azi (−) apare, apoi e „înlocuită" de soluția
              DETALIA (+), rând cu rând, pe măsură ce intră în vizor — nu tot blocul deodată. */}
          <Reveal>
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              overflow: "hidden",
              background: "var(--card)",
              boxShadow: "0 20px 48px -32px rgba(33,29,24,0.32)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid var(--border)",
                background: "var(--secondary)",
                fontFamily: MONO,
                fontSize: 12,
                letterSpacing: "0.04em",
                color: "var(--muted-foreground)",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 8, height: 8, background: "var(--primary)", transform: "rotate(45deg)", display: "inline-block" }} />
                starea-breslei.diff
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 12, fontWeight: 600 }}>
                <span style={{ color: "#2f6b3f" }}>+4</span>
                <span style={{ color: "var(--destructive)" }}>−4</span>
              </span>
            </div>

            {DIFF.map((d, i) => (
              <div key={d.minus} className="dt-diff-row" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                <Reveal delay={i * 420}>
                  <DiffLine sign="−" text={d.minus} kind="del" />
                </Reveal>
                <Reveal delay={i * 420 + 240}>
                  <DiffLine sign="+" text={d.plus} kind="add" />
                </Reveal>
              </div>
            ))}
          </div>
          </Reveal>
        </div>
      </section>

      {/* ===== 02 · CUM FUNCȚIONEAZĂ ===== */}
      <section style={{ background: "var(--background)", borderTop: "1px solid var(--border)" }}>
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

      {/* ===== 03 · PLANȘA TA ===== */}
      <section style={{ background: "var(--card)", borderTop: "1px solid var(--border)" }}>
        <div style={{ maxWidth: MAXW, margin: "0 auto", padding: SECTION_PAD }}>
          <div className="dt-plansa-grid" style={{ display: "grid", gridTemplateColumns: "minmax(260px, 400px) 1fr", gap: 56, alignItems: "center" }}>
            <div>
              <Eyebrow>03 — Planșa ta</Eyebrow>
              <h2 style={{ ...h2, margin: "0 0 16px" }}>
                Un spațiu privat, doar al tău, pentru detaliile care contează.
              </h2>
              <p style={{ fontSize: 16.5, lineHeight: 1.6, color: "var(--muted-foreground)", margin: 0, maxWidth: "42ch" }}>
                Aduni detaliile salvate într-un singur loc, le aranjezi liber — muți, redimensionezi,
                le pui alături pentru comparație. Strict privat: nimeni altcineva nu vede planșa ta.
              </p>
            </div>

            {/* Mockup static al planșei — zonă 16:10, câteva detalii aranjate liber (nu o animație
                elaborată; suficient să comunice ideea de „bord privat"). */}
            <Reveal>
              <div
                aria-hidden
                style={{
                  position: "relative",
                  aspectRatio: "16 / 10",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  background: "#faf7f1",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage:
                      "linear-gradient(var(--blueprint-grid) 1px,transparent 1px),linear-gradient(90deg,var(--blueprint-grid) 1px,transparent 1px)",
                    backgroundSize: "24px 24px",
                    opacity: 0.5,
                  }}
                />
                <PlanșaItem left="5%" top="9%" width="33%" rotate={-3} label="Acoperișuri" image="/landing/how-it-works-detail.png" floatDelay="0s" floatDuration="7.5s" />
                <PlanșaItem left="45%" top="32%" width="37%" rotate={2} label="Șarpantă" image="/landing/hero-detail.png" floatDelay="1.4s" floatDuration="8.5s" />
                <PlanșaItem left="9%" top="58%" width="25%" rotate={4} label="Fundații" sketch="fundatii" floatDelay="0.6s" floatDuration="6.8s" />
                <PlanșaItem left="72%" top="6%" width="22%" rotate={-5} label="Instalații" sketch="instalatii" floatDelay="2.1s" floatDuration="9s" />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== 04 · CE CÂȘTIGI ===== */}
      <section style={{ background: "var(--card)", borderTop: "1px solid var(--border)" }}>
        <div style={{ maxWidth: MAXW, margin: "0 auto", padding: SECTION_PAD }}>
          <Reveal>
          <div className="dt-gains">
            {/* Coloana titlu */}
            <div>
              <Eyebrow>04 — Ce câștigi</Eyebrow>
              <h2 style={{ ...h2, margin: "0 0 16px" }}>
                Un detaliu cântărit de breaslă, nu de un singur autor.
              </h2>
              <p style={{ fontSize: 16.5, lineHeight: 1.6, color: "var(--muted-foreground)", margin: 0, maxWidth: "38ch" }}>
                Nu doar un loc unde ții detalii — un mecanism prin care fiecare detaliu iese mai bun
                decât a intrat.
              </p>
            </div>

            {/* Lista beneficiilor — rânduri editoriale, separate de linii fine, reveal în cascadă
                (nu toate deodată — același fix ca la secțiunea 01). */}
            <div className="dt-gain-list">
              {BENEFITS.map((b, i) => (
                <Reveal key={b.title} delay={i * 130}>
                  <div className="dt-gain">
                    <div className="dt-gain-label">{b.label}</div>
                    <div>
                      <h3 className="dt-gain-title">{b.title}</h3>
                      <p className="dt-gain-body">{b.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
          </Reveal>
        </div>
      </section>

      {/* ===== 05 · PENTRU CINE ===== */}
      <section style={{ background: "var(--background)", borderTop: "1px solid var(--border)" }}>
        <div style={{ maxWidth: MAXW, margin: "0 auto", padding: SECTION_PAD }}>
          <Eyebrow>05 — Pentru cine</Eyebrow>
          <h2 style={{ ...h2, margin: "0 0 20px", maxWidth: "20ch" }}>Patru roluri, în jurul aceluiași detaliu.</h2>

          {/* Motiv „un singur detaliu" — rombul de brand (aceeași semnătură ca la secțiunile 01/03) +
              o linie care coboară spre grid, ca titlul să nu rămână doar o afirmație: cele 4 carduri
              chiar pornesc vizual dintr-un singur punct. */}
          <Reveal>
            <div aria-hidden style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, margin: "0 0 8px" }}>
              <span style={{ width: 9, height: 9, background: "var(--primary)", transform: "rotate(45deg)" }} />
              <span style={{ width: 1, height: 28, background: "var(--border)" }} />
            </div>
          </Reveal>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
            {ROLES.map((r, i) => (
              <Reveal key={r.title} delay={i * 110}>
                <RoleCard roleLabel={r.roleLabel} accent={r.accent} title={r.title} body={r.body} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA FINAL (dark) ===== */}
      {/* Ton închis din familia teracotei (--primary #a9573a întunecat), nu maro-negru neutru — ca să
          se simtă aceeași identitate, nu o paletă separată (feedback Liviu, 2026-07-06). */}
      <section style={{ position: "relative", overflow: "hidden", background: "#33201a" }}>
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
      <footer style={{ background: "#241611", color: "#c4bcae" }}>
        <div
          className="dc-footer-inner"
          style={{
            maxWidth: MAXW,
            margin: "0 auto",
            padding: "30px 24px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <div className="dc-footer-brand" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- asset SVG static de brand */}
              <img src="/logo-dark.svg" alt="DETALIA" style={{ height: 32, width: "auto", display: "block" }} />
            </div>
            <span style={{ fontSize: 16, color: "#8c8475" }}>Detaliul de execuție, pus la dezbatere pe roluri.</span>
          </div>
          <div className="dc-footer-links" style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
            <Link href="/termeni" style={{ fontSize: 13.5, color: "#8c8475", textDecoration: "none" }}>
              Termeni și condiții
            </Link>
            <Link href="/confidentialitate" style={{ fontSize: 13.5, color: "#8c8475", textDecoration: "none" }}>
              Confidențialitate
            </Link>
            <span style={{ fontFamily: MONO, fontSize: 13.5, color: "#6f685e" }}>© {new Date().getFullYear()} DETALIA — Toate drepturile rezervate.</span>
          </div>
        </div>
      </footer>
      <CookieConsent />
    </div>
  );
}


// O linie de diff (secțiunea 01): gutter mono cu semn colorat + textul. „del" = problema veche
// (estompată), „add" = soluția DETALIA (prezentă). Mărimea gutter-ului/textului vine din variabile CSS
// (--diff-sign-fs/--diff-text-fs/--diff-pad) suprascrise la hover în globals.css (.dt-diff-row:hover) —
// rândul „crește" ușor doar când e sub cursor, nu permanent (evită asimetria „rând mare fix" din prima variantă).
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
          fontSize: "var(--diff-sign-fs, 16px)",
          fontWeight: 700,
          textAlign: "center",
          padding: "var(--diff-pad, 13px) 0",
          color: del ? "var(--destructive)" : "#2f6b3f",
          borderRight: `1px solid ${del ? "rgba(176,70,60,0.18)" : "rgba(47,107,63,0.18)"}`,
          userSelect: "none",
          transition: "font-size 0.15s ease, padding 0.15s ease",
        }}
      >
        {sign}
      </span>
      <span
        style={{
          padding: "var(--diff-pad, 13px) 18px",
          fontSize: "var(--diff-text-fs, 15.5px)",
          lineHeight: 1.5,
          color: del ? "var(--muted-foreground)" : "var(--foreground)",
          transition: "font-size 0.15s ease, padding 0.15s ease",
        }}
      >
        {text}
      </span>
    </div>
  );
}

// Un cadru din storyboard-ul secțiunii 02 — același detaliu evoluează: gol → cu o propunere
// desenată peste → validat pe roluri (✓/✕). Mini-planșă pe grilă, ca în restul brandului.
// Cadrul folosește un detaliu REAL (desen de execuție, fundal eliminat — public/landing/how-it-works-detail.png)
// ca bază, cu un reveal fade+scale o singură dată la intrarea în vizor. Peste el, la pasul 2/3, o
// SECVENȚĂ ÎN BUCLĂ de 10s (buton → tap → desen/validare → reset) se repetă cât timp cadrul e vizibil —
// nu se joacă o singură dată. Declanșată de clasa `.is-in` pusă de <Reveal>; toate regulile
// `.dt-flow-*-loop` din globals.css sunt keyframes de 10s, gândite pe procente din acel ciclu, ca să
// rămână sincrone cu apariția/dispariția elementelor (fără JS suplimentar — CSS pur, se oprește lin
// dacă utilizatorul are `prefers-reduced-motion`).
function FlowFrame({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div
      style={{
        position: "relative",
        height: 150,
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
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
            "linear-gradient(var(--blueprint-grid) 1px,transparent 1px),linear-gradient(90deg,var(--blueprint-grid) 1px,transparent 1px)",
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
        {step === 2 && (
          <defs>
            {/* Filtru de „mână" — trasee vectorial perfecte, dar cu un mic tremur de creion, nu o
                curbă geometrică netedă. Aplicat doar traseului desenat la pasul 2. */}
            <filter id="dt-sketch-rough" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.9" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        )}
        {/* Detaliul real, ÎN ACEEAȘI viewBox decât traseul de mai jos — garantează că schița chiar
            cade peste desen. `<g opacity>` pt. estomparea de la pasul 3, separat de clasa de reveal
            (.dt-flow-image) de pe <image> — evită coliziunea inline-vs-clasă din CSS. */}
        <g opacity={step === 3 ? 0.5 : 1}>
          <image
            className="dt-flow-image"
            href="/landing/how-it-works-detail.png"
            x="0" y="0" width="200" height="120"
            preserveAspectRatio="xMidYMid meet"
            style={{ transformOrigin: "100px 60px" }}
          />
        </g>
        {/* pasul 2: propunerea desenată chiar peste detaliu — un profil tehnic, unghiular (segmente
            drepte, ca liniile desenului de bază), NU o mâzgălitură ondulată fără sens — arată ca o
            variantă de detaliu propusă lângă colțul sortului de tablă, cu doar un tremur fin de
            mână (filtrul de mai sus). Se repetă la fiecare 10s, sincron cu „Schițează". */}
        {step === 2 && (
          <path
            className="dt-flow-draw-loop"
            d="M58 70 L 90 70 L 90 46 L 118 46 L 118 30 L 148 30"
            stroke="var(--primary)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"
            style={{ filter: "url(#dt-sketch-rough)", strokeDasharray: 150, strokeDashoffset: 150 }}
          />
        )}
      </svg>

      {/* Butoane reale (mimică UI-ul din produs) + „tap" simulat, în buclă la 10s — nu o singură
          dată. Desenul/validarea din SVG e sincronizat cu momentul exact al tap-ului. */}
      {step === 2 && (
        <div className="dt-flow-btn-loop" style={{ position: "absolute", right: 12, bottom: 10 }}>
          <FlowButton label="Schițează" tone="primary" pressClass="dt-flow-press-s2-loop" tapClass="dt-flow-tap-s2-loop" />
        </div>
      )}
      {step === 3 && (
        <div style={{ position: "absolute", left: 12, right: 12, bottom: 10, display: "flex", justifyContent: "space-between" }}>
          <div className="dt-flow-btn-loop">
            <FlowButton label="Aprob" tone="approve" pressClass="dt-flow-press-approve-loop" tapClass="dt-flow-tap-approve-loop" />
          </div>
          <div className="dt-flow-btn-loop">
            <FlowButton label="Dezaprob" tone="reject" pressClass="dt-flow-press-reject-loop" tapClass="dt-flow-tap-reject-loop" />
          </div>
        </div>
      )}
    </div>
  );
}

// Un buton mic, stilizat ca în produs (nu o formă decorativă), cu un „tap" simulat în buclă: un inel
// se extinde peste buton (`tapClass`) exact când butonul „apasă" (`pressClass`) — clasele de keyframes
// vin din apelant, ca fiecare buton să aibă propriul moment în ciclul de 10s (vezi globals.css).
function FlowButton({
  label, tone, pressClass, tapClass,
}: { label: string; tone: "primary" | "approve" | "reject"; pressClass: string; tapClass: string }) {
  const colors = {
    primary: { bg: "var(--primary)", fg: "#fff" },
    approve: { bg: "#2f6b3f", fg: "#fff" },
    reject: { bg: "var(--destructive)", fg: "#fff" },
  }[tone];
  return (
    <div
      className={pressClass}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 11px",
        borderRadius: 999,
        background: colors.bg,
        color: colors.fg,
        fontFamily: SANS,
        fontSize: 11,
        fontWeight: 700,
        boxShadow: "0 4px 10px -4px rgba(33,29,24,0.35)",
      }}
    >
      {label}
      <span className={tapClass} aria-hidden />
    </div>
  );
}

function FlowStep({ step, data }: { step: 1 | 2 | 3; data: { n: string; title: string; body: string } }) {
  return (
    <div>
      <FlowFrame step={step} />
      <div style={{ fontFamily: MONO, fontSize: 12, color: "var(--primary)", letterSpacing: "0.1em", margin: "16px 0 8px" }}>
        {data.n}
      </div>
      <h3 style={{ fontFamily: SANS, fontWeight: 700, fontSize: 20, margin: "0 0 8px", color: "var(--foreground)" }}>
        {data.title}
      </h3>
      <p style={{ fontSize: 15, color: "var(--muted-foreground)", lineHeight: 1.55, margin: 0 }}>{data.body}</p>
    </div>
  );
}

// Schițe abstracte generice (NU desene tehnice reale) pentru bilețelele fără imagine — mai bine
// decât un cartonaș gol, fără să pretindem un detaliu real care nu există.
function PlanșaSketch({ kind }: { kind: "fundatii" | "instalatii" }) {
  if (kind === "fundatii") {
    return (
      <svg viewBox="0 0 100 75" width="100%" height="100%" aria-hidden style={{ position: "absolute", inset: 0 }}>
        <line x1="15" y1="30" x2="85" y2="30" stroke="#c4b59c" strokeWidth="1.4" />
        <rect x="38" y="30" width="24" height="30" fill="none" stroke="#c4b59c" strokeWidth="1.4" />
        <line x1="41" y1="33" x2="59" y2="57" stroke="#d8cab1" strokeWidth="0.8" />
        <line x1="47" y1="33" x2="59" y2="49" stroke="#d8cab1" strokeWidth="0.8" />
        <line x1="53" y1="33" x2="59" y2="41" stroke="#d8cab1" strokeWidth="0.8" />
        <rect x="45" y="15" width="10" height="15" fill="none" stroke="#a9573a" strokeWidth="1.2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 75" width="100%" height="100%" aria-hidden style={{ position: "absolute", inset: 0 }}>
      <line x1="12" y1="26" x2="88" y2="26" stroke="#8a8073" strokeWidth="1.4" />
      <line x1="12" y1="34" x2="88" y2="34" stroke="#8a8073" strokeWidth="1.4" />
      <circle cx="55" cy="30" r="7" fill="none" stroke="#a9573a" strokeWidth="1.4" />
      <line x1="55" y1="37" x2="55" y2="55" stroke="#8a8073" strokeWidth="1.2" />
      <line x1="45" y1="55" x2="65" y2="55" stroke="#8a8073" strokeWidth="1.2" />
    </svg>
  );
}

// Un „bilețel" de pe planșă (secțiunea 03) — imagine reală (dacă există), altfel o schiță abstractă
// generică (PlanșaSketch, nu un desen tehnic real inventat). Rotit ușor + umbră, ca o hârtie pusă
// liber pe un bord — și cu o mișcare lentă continuă (dt-plansa-float), ca planșa să pară „vie",
// nu o compoziție statică. Fiecare bilețel are propriul delay/durată (variate în JSX, nu identice).
function PlanșaItem({
  left, top, width, rotate, label, image, sketch, floatDelay = "0s", floatDuration = "7s",
}: {
  left: string; top: string; width: string; rotate: number; label: string;
  image?: string; sketch?: "fundatii" | "instalatii"; floatDelay?: string; floatDuration?: string;
}) {
  return (
    <div
      className="dt-plansa-float"
      style={{
        position: "absolute",
        left, top, width,
        aspectRatio: "4 / 3",
        // @ts-expect-error -- proprietăți CSS custom, citite de .dt-plansa-float din globals.css
        "--plansa-rot": `${rotate}deg`,
        animationDelay: floatDelay,
        animationDuration: floatDuration,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          boxShadow: "0 10px 24px -12px rgba(33,29,24,0.28)",
          overflow: "hidden",
        }}
      >
      {image && (
        <div
          aria-hidden
          style={{ position: "absolute", inset: 0, backgroundImage: `url(${image})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
      )}
      {!image && sketch && <PlanșaSketch kind={sketch} />}
      <span
        style={{
          position: "absolute", left: 6, top: 6,
          fontFamily: MONO, fontSize: 8.5, letterSpacing: "0.04em", textTransform: "uppercase",
          color: "#a9573a", background: "rgba(255,253,249,0.9)", border: "1px solid #e3ddd2",
          padding: "2px 5px", borderRadius: 5,
        }}
      >
        {label}
      </span>
      </div>
    </div>
  );
}

// Accentul de culoare pe rol vine din `components/role-pill.tsx` (ROLE_STYLE) — aceleași culori pe
// care userul le vede lângă orice nume în platformă. Înlocuiește emoji-ul generic (off-brand) cu
// identitatea vizuală reală a rolului, ca landing-ul să anticipeze exact UI-ul din produs.
function RoleCard({ roleLabel, accent, title, body }: { roleLabel: string; accent: string; title: string; body: string }) {
  return (
    <div className="dt-role-card" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 28 }}>
      <div
        aria-hidden
        style={{
          display: "inline-block",
          padding: "3px 9px",
          borderRadius: 999,
          background: accent,
          color: accent === "#ece4d6" ? "#5d564c" : "#fff",
          fontFamily: MONO,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          marginBottom: 14,
        }}
      >
        {roleLabel}
      </div>
      <h3 style={{ fontFamily: SANS, fontWeight: 700, fontSize: 20, margin: "0 0 8px", color: "var(--foreground)" }}>{title}</h3>
      <p style={{ fontSize: 15.5, color: "var(--muted-foreground)", lineHeight: 1.55, margin: 0 }}>{body}</p>
    </div>
  );
}
