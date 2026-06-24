import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { auth } from "@/lib/auth";

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

const BENEFITS = [
  {
    title: "Detalii verificate de breaslă",
    body: "Nu te bazezi pe un singur autor: detaliul trece prin ochii mai multor roluri înainte să ajungă pe șantier.",
  },
  {
    title: "Vezi cine aprobă și cu ce rol",
    body: "Părerea unui proiectant și a unui executant cântăresc diferit — și le ai pe amândouă la vedere.",
  },
  {
    title: "Înveți din dezacord",
    body: "Cele mai utile lucruri stau în motivele unei dezaprobări, nu în aprobările tăcute.",
  },
  {
    title: "Îți construiești reputația",
    body: "Propunerile și părerile tale rămân legate de numele tău profesional, vizibile breslei.",
  },
];

const FAQ = [
  {
    q: "E gratuit?",
    a: "Da. Contul e gratuit și înregistrarea e liberă. Nu cerem card și nu există abonament.",
  },
  {
    q: "Trebuie să fiu verificat ca să postez?",
    a: "Nu. Îți declari rolul la înscriere și poți publica imediat. Verificarea profesională e opțională și vine mai târziu — îți dă mai multă greutate, dar nu e o condiție.",
  },
  {
    q: "Cum mă înscriu?",
    a: "O singură dată, fără parolă. Primești un link de intrare pe email și ești înăuntru.",
  },
];

const SUBLINE = "Cont gratuit · fără parolă · intri cu un link primit pe email";

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
const card: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e6dfd3",
  borderRadius: "var(--radius)",
  padding: 28,
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

export default async function Home() {
  const session = await auth();
  const authed = Boolean(session?.user);

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
            {authed ? (
              <Link href="/feed" className="dc-btn-primary" style={{ ...primaryBtn, fontSize: 14, padding: "9px 16px", borderRadius: "var(--radius)" }}>
                Mergi la feed
              </Link>
            ) : (
              <>
                <Link href="/login" className="dc-link" style={{ fontSize: 14.5, color: "#211d18", textDecoration: "none", fontWeight: 500, transition: "color .15s" }}>
                  Autentificare
                </Link>
                <Link href="/signup" className="dc-btn-primary" style={{ ...primaryBtn, fontSize: 14, padding: "9px 16px", borderRadius: "var(--radius)" }}>
                  Creează cont
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ===== HERO (varianta B — planșă în panou + voturi pe roluri) ===== */}
      <section style={{ background: "#faf8f4" }}>
        <div
          className="dc-hero-grid"
          style={{ maxWidth: MAXW, margin: "0 auto", padding: "clamp(72px, 10vw, 124px) 24px clamp(64px, 8vw, 96px)" }}
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
              {authed ? (
                <Link href="/feed" className="dc-btn-primary" style={primaryBtn}>
                  Mergi la feed
                </Link>
              ) : (
                <>
                  <Link href="/signup" className="dc-btn-primary" style={primaryBtn}>
                    Creează cont gratuit
                  </Link>
                  <Link href="/login" className="dc-btn-outline" style={outlineBtn}>
                    Autentificare
                  </Link>
                </>
              )}
            </div>
            {!authed && (
              <div style={{ fontFamily: MONO, fontSize: 12.5, color: "#8a8073", marginTop: 20, letterSpacing: "0.02em" }}>
                {SUBLINE}
              </div>
            )}
          </div>

          {/* Coloana card preview (planșă + voturi pe roluri) */}
          <div style={{ position: "relative" }}>
            <div style={{ background: "#ffffff", border: "1px solid #e3ddd2", borderRadius: "var(--radius)", boxShadow: "0 24px 60px -28px rgba(33,29,24,0.28)", overflow: "hidden" }}>
              {/* Antet card */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 18px",
                  borderBottom: "1px solid #eee6da",
                  fontFamily: MONO,
                  fontSize: 11.5,
                  letterSpacing: "0.06em",
                  color: "#8a8073",
                  textTransform: "uppercase",
                }}
              >
                <span>Detaliu · Atic acoperiș terasă</span>
                <span>DET-014</span>
              </div>
              {/* Planșă */}
              <div style={{ position: "relative", background: "#faf7f1", padding: 22 }}>
                <svg width="100%" viewBox="0 0 420 250" fill="none" style={{ display: "block" }} aria-hidden>
                  <rect x="60" y="40" width="150" height="150" stroke="#c4b59c" strokeWidth="1.5" />
                  <rect x="60" y="40" width="44" height="150" stroke="#c4b59c" strokeWidth="1.5" />
                  <line x1="104" y1="48" x2="186" y2="190" stroke="#d8cab1" strokeWidth="1" />
                  <line x1="118" y1="48" x2="186" y2="166" stroke="#d8cab1" strokeWidth="1" />
                  <line x1="132" y1="48" x2="186" y2="142" stroke="#d8cab1" strokeWidth="1" />
                  <line x1="146" y1="48" x2="186" y2="118" stroke="#d8cab1" strokeWidth="1" />
                  <path d="M60 40 L60 24 L260 24" stroke="#a9573a" strokeWidth="1.4" fill="none" />
                  <line x1="60" y1="16" x2="60" y2="32" stroke="#a9573a" strokeWidth="1" />
                  <line x1="210" y1="16" x2="210" y2="32" stroke="#a9573a" strokeWidth="1" />
                  <text x="120" y="14" fontFamily={MONO} fontSize="12" fill="#a9573a">
                    30 cm
                  </text>
                  <circle cx="186" cy="92" r="4" stroke="#8a8073" strokeWidth="1" fill="none" />
                  <line x1="186" y1="92" x2="300" y2="70" stroke="#8a8073" strokeWidth="1" />
                  <text x="306" y="66" fontFamily={MONO} fontSize="11" fill="#8a8073">
                    șorț tablă
                  </text>
                  <line x1="240" y1="120" x2="350" y2="120" stroke="#a9573a" strokeWidth="1.4" strokeDasharray="4 3" />
                  <circle cx="240" cy="120" r="3.5" fill="#a9573a" />
                  <text x="256" y="138" fontFamily={MONO} fontSize="11" fill="#a9573a">
                    propunere
                  </text>
                </svg>
              </div>
              {/* Voturi pe roluri */}
              <div style={{ padding: "14px 18px", borderTop: "1px solid #eee6da", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={voteAvatar}>MP</span>
                  <span style={{ fontSize: 13.5, flex: 1 }}>
                    <b style={{ fontWeight: 600 }}>M. Popa</b> <span style={{ color: "#8a8073" }}>· Proiectant</span>
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#2f6b3f", background: "#e9f2ea", border: "1px solid #d3e6d6", padding: "3px 9px", borderRadius: 999 }}>
                    ✓ Aprobă
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={voteAvatar}>IR</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13.5 }}>
                        <b style={{ fontWeight: 600 }}>I. Radu</b> <span style={{ color: "#8a8073" }}>· Executant</span>
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#9a3a30", background: "#f6ebe9", border: "1px solid #ecd6d2", padding: "3px 9px", borderRadius: 999, marginLeft: "auto" }}>
                        ✕ Dezaprobă
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "#6f685e", marginTop: 4, lineHeight: 1.45 }}>
                      „Șorțul nu acoperă rostul — apa intră pe la atic.”
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
            {/* Azi */}
            <div style={{ background: "#ffffff", border: "1px solid #e6dfd3", borderRadius: "var(--radius)", padding: "30px 30px 16px" }}>
              <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9a3a30", marginBottom: 18 }}>
                Azi
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {[
                  "Detaliile circulă în PDF-uri răzlețe, pe mail și pe WhatsApp.",
                  "Fiecare le desenează altfel — nu există un punct de referință.",
                  "Nimeni nu le contestă pe roluri; proiectantul nu aude executantul.",
                  "Aceleași greșeli de execuție se repetă de la șantier la șantier.",
                ].map((t) => (
                  <li key={t} style={{ display: "flex", gap: 13, alignItems: "flex-start", padding: "14px 0", borderTop: "1px solid #efe8dc" }}>
                    <span style={{ flex: "none", marginTop: 1, color: "#b0463c", fontWeight: 700 }}>✕</span>
                    <span style={{ fontSize: 15.5, color: "#3f3a33", lineHeight: 1.5 }}>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Cu DETALIA */}
            <div style={{ background: "#ffffff", border: "1px solid #d9c7ba", borderRadius: "var(--radius)", padding: "30px 30px 16px", boxShadow: "0 18px 44px -30px rgba(169,87,58,0.4)" }}>
              <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#a9573a", marginBottom: 18 }}>
                Cu DETALIA
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {[
                  "Detaliile stau într-un singur loc viu, deschis breslei.",
                  "Oricine poate desena o propunere direct peste detaliu.",
                  "Fiecare rol aprobă sau dezaprobă — dezacordul vine cu justificare.",
                  "Detaliul bun iese la suprafață prin dezbatere, nu printr-un scor.",
                ].map((t) => (
                  <li key={t} style={{ display: "flex", gap: 13, alignItems: "flex-start", padding: "14px 0", borderTop: "1px solid #efe8dc" }}>
                    <span style={{ flex: "none", marginTop: 1, color: "#2f6b3f", fontWeight: 700 }}>✓</span>
                    <span style={{ fontSize: 15.5, color: "#3f3a33", lineHeight: 1.5 }}>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 02 · CUM FUNCȚIONEAZĂ ===== */}
      <section style={{ background: "#f3efe8", borderTop: "1px solid #e6ddcf" }}>
        <div style={{ maxWidth: MAXW, margin: "0 auto", padding: SECTION_PAD }}>
          <Eyebrow>02 — Cum funcționează</Eyebrow>
          <h2 style={{ ...h2, margin: "0 0 48px", maxWidth: "20ch" }}>Trei pași, de la desen la validare.</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 28 }}>
            {STEPS.map((s) => (
              <div key={s.n}>
                <div style={{ fontFamily: MONO, fontSize: 13, color: "#a9573a", borderTop: "2px solid #211d18", paddingTop: 14, marginBottom: 18, letterSpacing: "0.08em" }}>
                  {s.n}
                </div>
                <h3 style={{ fontFamily: SANS, fontWeight: 700, fontSize: 21, margin: "0 0 10px", color: "#211d18" }}>{s.title}</h3>
                <p style={{ fontSize: 15.5, color: "#5d564c", lineHeight: 1.55, margin: 0 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 03 · CE CÂȘTIGI ===== */}
      <section style={{ background: "#faf8f4", borderTop: "1px solid #e6ddcf" }}>
        <div style={{ maxWidth: MAXW, margin: "0 auto", padding: SECTION_PAD }}>
          <Eyebrow>03 — Ce câștigi</Eyebrow>
          <h2 style={{ ...h2, margin: "0 0 48px", maxWidth: "22ch" }}>
            Un detaliu cântărit de breaslă, nu de un singur autor.
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
            {BENEFITS.map((b) => (
              <div key={b.title} style={card}>
                <h3 style={{ fontFamily: SANS, fontWeight: 700, fontSize: 19, margin: "0 0 9px", color: "#211d18" }}>{b.title}</h3>
                <p style={{ fontSize: 15.5, color: "#5d564c", lineHeight: 1.55, margin: 0 }}>{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 04 · PENTRU CINE ===== */}
      <section style={{ background: "#f3efe8", borderTop: "1px solid #e6ddcf" }}>
        <div style={{ maxWidth: MAXW, margin: "0 auto", padding: SECTION_PAD }}>
          <Eyebrow>04 — Pentru cine</Eyebrow>
          <h2 style={{ ...h2, margin: "0 0 48px", maxWidth: "20ch" }}>Patru roluri, în jurul aceluiași detaliu.</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
            <RoleCard
              marker={<span style={{ flex: "none", width: 14, height: 14, background: "#a9573a", transform: "rotate(45deg)", marginTop: 6 }} />}
              title="Proiectant"
              body="Pui detaliul la încercare înainte de șantier și vezi unde se împiedică execuția."
            />
            <RoleCard
              marker={<span style={{ flex: "none", width: 14, height: 14, borderRadius: "50%", background: "#a9573a", marginTop: 6 }} />}
              title="Executant"
              body="Arăți cum se face de fapt și semnalezi din timp ce nu se poate pune în operă."
            />
            <RoleCard
              marker={<span style={{ flex: "none", width: 14, height: 14, background: "#a9573a", marginTop: 6 }} />}
              title="Furnizor"
              body="Aduci soluția corectă de montaj pentru produsul tău, direct pe detaliu."
            />
            <RoleCard
              marker={
                <span
                  style={{
                    flex: "none",
                    width: 0,
                    height: 0,
                    borderLeft: "8px solid transparent",
                    borderRight: "8px solid transparent",
                    borderBottom: "14px solid #a9573a",
                    marginTop: 7,
                  }}
                />
              }
              title="Beneficiar"
              body="Înțelegi deciziile și vezi că detaliul a fost cântărit de mai mulți, nu de unul singur."
            />
          </div>
        </div>
      </section>

      {/* ===== 05 · ÎNTREBĂRI FRECVENTE ===== */}
      <section style={{ background: "#faf8f4", borderTop: "1px solid #e6ddcf" }}>
        <div style={{ maxWidth: 840, margin: "0 auto", padding: SECTION_PAD }}>
          <Eyebrow>05 — Întrebări frecvente</Eyebrow>
          <h2 style={{ ...h2, margin: "0 0 40px" }}>Întrebări frecvente</h2>

          {FAQ.map((item, i) => (
            <details
              key={item.q}
              open={i === 0}
              style={{
                borderTop: "1px solid #e3ddd2",
                borderBottom: i === FAQ.length - 1 ? "1px solid #e3ddd2" : undefined,
                padding: "6px 0",
              }}
            >
              <summary
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "20px 0",
                  fontFamily: SANS,
                  fontWeight: 600,
                  fontSize: 19,
                  color: "#211d18",
                }}
              >
                {item.q}
                <span className="dt-sign" style={{ flex: "none", fontFamily: MONO, fontSize: 22, color: "#a9573a", transition: "transform .2s", fontWeight: 400 }}>
                  +
                </span>
              </summary>
              <p style={{ fontSize: 16, color: "#5d564c", lineHeight: 1.6, margin: "0 0 18px", maxWidth: "64ch" }}>{item.a}</p>
            </details>
          ))}
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
            href={authed ? "/feed" : "/signup"}
            className="dc-btn-primary-dark"
            style={{ ...primaryBtn, fontSize: 16, padding: "15px 30px", border: "1px solid #c06b46" }}
          >
            {authed ? "Mergi la feed" : "Creează cont gratuit"}
          </Link>
          {!authed && (
            <div style={{ fontFamily: MONO, fontSize: 12.5, color: "#8c8475", marginTop: 20, letterSpacing: "0.02em" }}>{SUBLINE}</div>
          )}
        </div>
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
            <Link href="/login" style={{ fontSize: 14, color: "#c4bcae", textDecoration: "none" }}>
              Autentificare
            </Link>
            <Link href="/signup" style={{ fontSize: 14, color: "#faf6ef", textDecoration: "none", fontWeight: 600 }}>
              Creează cont
            </Link>
            <span style={{ fontFamily: MONO, fontSize: 12.5, color: "#6f685e" }}>© {new Date().getFullYear()} DETALIA</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

const voteAvatar: CSSProperties = {
  flex: "none",
  width: 26,
  height: 26,
  borderRadius: "50%",
  background: "#ece4d6",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 10.5,
  color: "#6f685e",
  fontFamily: MONO,
};

function RoleCard({ marker, title, body }: { marker: ReactNode; title: string; body: string }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e6dfd3", borderRadius: "var(--radius)", padding: 28, display: "flex", gap: 18, alignItems: "flex-start" }}>
      {marker}
      <div>
        <h3 style={{ fontFamily: SANS, fontWeight: 700, fontSize: 20, margin: "0 0 8px", color: "#211d18" }}>{title}</h3>
        <p style={{ fontSize: 15.5, color: "#5d564c", lineHeight: 1.55, margin: 0 }}>{body}</p>
      </div>
    </div>
  );
}
