"use client";

import { type CSSProperties, useEffect, useState } from "react";

// Cardul de preview din hero-ul landing — (1) FEED: SCREENSHOT REAL din aplicație (nu o recreere de
// cod — public/landing/feed-real.png, cadru din înregistrarea trimisă de Liviu, test.mp4), cu tap
// simulat pe cardul „Cornișă șarpantă lemn" (al treilea, cel care chiar se deschide spre exact
// desenul de mai jos), (2) crossfade spre detaliul REAL (imagine, fundal eliminat —
// public/landing/hero-detail.png) cu o propunere desenată live peste el (traseu subțire + hașură,
// filtru fin de „mână"), (3) chrome-ul cardului (titlu/autor/rol — IDENTICE cu cardul din feed, ca
// tranziția să fie continuă) + pozițiile pe roluri (Aprobă/Dezaprobă cu justificare). La fiecare
// ciclu secvența se reia prin remontare (key=cycle) — un `animation-delay` pur CSS nu păstrează
// stagger-ul peste iterații.

const MONO = "var(--font-plex-mono), monospace";
const SANS = "var(--font-archivo), system-ui, sans-serif";
const CYCLE_MS = 8600;

const stackAvatar: CSSProperties = {
  flex: "none",
  width: 24,
  height: 24,
  borderRadius: "50%",
  background: "var(--secondary)",
  border: "2px solid var(--card)",
  marginLeft: -7,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 9.5,
  color: "var(--muted-foreground)",
  fontFamily: MONO,
};

const voteAvatar: CSSProperties = {
  flex: "none",
  width: 26,
  height: 26,
  borderRadius: "50%",
  background: "var(--secondary)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 10.5,
  color: "var(--muted-foreground)",
  fontFamily: MONO,
};

// Pastilă de rol — același limbaj vizual ca RolePill din feed (fundal cald, text primary).
const rolePill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontFamily: MONO,
  fontSize: 11,
  color: "var(--primary)",
  background: "var(--secondary)",
  border: "1px solid var(--border)",
  padding: "2px 8px",
  borderRadius: 999,
  whiteSpace: "nowrap",
};

export function HeroPreview() {
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    // Respectă prefers-reduced-motion: nu mai reluăm secvența (totul rămâne afișat static).
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setCycle((c) => c + 1), CYCLE_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ position: "relative" }}>
      {/* key=cycle pe tot cardul → remontează SVG-ul (se redesenează) ȘI re-pornește apariția chrome-ului. */}
      <div
        key={cycle}
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          boxShadow: "0 24px 60px -28px rgba(33,29,24,0.28)",
          overflow: "hidden",
        }}
      >
        {/* ETAPA 1 — FEED: screenshot REAL (nu o recreere), tap simulat pe „Cornișă șarpantă lemn"
            (al treilea card — chiar cel care se deschide spre desenul de mai jos), apoi crossfade. */}
        <div
          className="dc-hero-feed"
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            aspectRatio: "702 / 808",
            backgroundImage: "url(/landing/feed-real.png)",
            backgroundSize: "contain",
            backgroundPosition: "top center",
            backgroundRepeat: "no-repeat",
            backgroundColor: "var(--card)",
          }}
        >
          <span className="dc-hero-tap" aria-hidden style={{ left: "50%", top: "83%" }} />
        </div>

        {/* Thumbnail — detaliul REAL, cu propunerea desenată live peste el, eticheta de categorie peste (ca în feed). */}
        <div style={{ position: "relative", background: "#faf7f1", padding: 22 }}>
          <span
            style={{
              position: "absolute",
              left: 14,
              top: 14,
              zIndex: 1,
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#a9573a",
              background: "rgba(255,253,249,0.85)",
              border: "1px solid #e3ddd2",
              padding: "3px 7px",
              borderRadius: 7,
            }}
          >
            Șarpantă
          </span>
          <span
            style={{
              position: "absolute",
              right: 14,
              top: 14,
              zIndex: 1,
              fontFamily: MONO,
              fontSize: 10.5,
              color: "#a59a88",
            }}
          >
            DET-014
          </span>
          <svg
            className="dc-sketch"
            width="100%"
            viewBox="0 0 200 120"
            style={{ display: "block", width: "100%", height: "auto", aspectRatio: "200 / 120" }}
            aria-hidden
          >
            <defs>
              {/* Filtru de „mână" — tremur FIN, potrivit pentru linie subțire (nu marker gros):
                  baseFrequency mai mare + scale mic → jitter fin, nu distorsiune haotică. */}
              <filter id="dc-hero-sketch-rough" x="-30%" y="-30%" width="160%" height="160%">
                <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="7" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.55" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
            {/* Detaliul REAL (hero-detail.png — desen dedicat animației din hero). */}
            <image
              data-fade="1"
              href="/landing/hero-detail.png"
              x="0" y="0" width="200" height="120"
              preserveAspectRatio="xMidYMid meet"
              style={{ animationDelay: "1.6s" }}
            />
            {/* PROPUNEREA — traseu principal (contur element nou, linie subțire ca un creion, nu
                marker gros) + hașură (notația reală de material din desenul tehnic) — o schiță
                compusă din mai multe tușe succesive, poziționată lângă joncțiunea pantă-perete. */}
            <path
              data-draw="1"
              pathLength={1}
              d="M100 50 L 122 50 L 122 36 L 140 36"
              stroke="var(--primary)" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"
              style={{ filter: "url(#dc-hero-sketch-rough)", animationDelay: "2.2s" }}
            />
            {/* Hașură — 4 tuse scurte, succesive, ca material nou adăugat (izolație) în zona conturată. */}
            <path data-draw="1" pathLength={1} d="M104 47 L 110 40" stroke="var(--primary)" strokeWidth="1" strokeLinecap="round"
              style={{ filter: "url(#dc-hero-sketch-rough)", animationDelay: "2.95s" }} />
            <path data-draw="1" pathLength={1} d="M110 47 L 116 40" stroke="var(--primary)" strokeWidth="1" strokeLinecap="round"
              style={{ filter: "url(#dc-hero-sketch-rough)", animationDelay: "3.05s" }} />
            <path data-draw="1" pathLength={1} d="M116 47 L 122 40" stroke="var(--primary)" strokeWidth="1" strokeLinecap="round"
              style={{ filter: "url(#dc-hero-sketch-rough)", animationDelay: "3.15s" }} />
            <path data-draw="1" pathLength={1} d="M126 34 L 134 34" stroke="var(--primary)" strokeWidth="1" strokeLinecap="round"
              style={{ filter: "url(#dc-hero-sketch-rough)", animationDelay: "3.25s" }} />
            <circle data-fade="1" cx="140" cy="36" r="2.2" fill="var(--primary)" style={{ animationDelay: "3.8s" }} />
            <text data-fade="1" x="98" y="26" fontFamily={MONO} fontSize="8.5" fill="var(--primary)" style={{ animationDelay: "3.9s" }}>
              propunere
            </text>
          </svg>
        </div>

        {/* Conținutul cardului — IDENTIC cu al treilea card din feed-real.png (titlu/autor/rol), ca
            tranziția să fie continuă, nu un montaj cu date diferite. */}
        <div style={{ padding: "16px 18px 4px" }}>
          {/* Titlu */}
          <div data-rise="1" style={{ fontFamily: SANS, fontWeight: 700, fontSize: 16, color: "var(--foreground)", animationDelay: "4.4s" }}>
            Cornișă șarpantă lemn
          </div>

          {/* Autor + rol */}
          <div data-rise="1" style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 9, animationDelay: "4.6s" }}>
            <span style={voteAvatar}>RI</span>
            <span style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 600, color: "var(--foreground)" }}>R. Ionescu</span>
            <span style={rolePill}>Beneficiar</span>
          </div>

          {/* Stivă de validatori — avatarele celor care au luat poziție (apar pe rând). */}
          <div data-rise="1" style={{ display: "flex", alignItems: "center", marginTop: 12, paddingLeft: 7, animationDelay: "5.1s" }}>
            <span style={stackAvatar}>MP</span>
            <span style={stackAvatar}>IR</span>
          </div>

          {/* Contoare — ca în feed: validări · comentarii · schițe în teanc. */}
          <div data-rise="1" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12, fontFamily: MONO, fontSize: 11.5, color: "var(--muted-foreground)", animationDelay: "5.35s" }}>
            <span>2 validări</span>
            <span style={{ color: "var(--border)" }}>·</span>
            <span>1 comentariu</span>
            <span style={{ color: "var(--border)" }}>·</span>
            <span>2 schițe în teanc</span>
          </div>
        </div>

        {/* Pozițiile pe roluri — partea „vie" a dezbaterii (Aprobă / Dezaprobă cu justificare). */}
        <div style={{ padding: "12px 18px 16px", marginTop: 8, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div data-rise="1" style={{ display: "flex", alignItems: "center", gap: 10, animationDelay: "5.8s" }}>
            <span style={voteAvatar}>MP</span>
            <span style={{ fontSize: 13.5, flex: 1 }}>
              <b style={{ fontWeight: 600 }}>M. Popa</b> <span style={{ color: "var(--muted-foreground)" }}>· Proiectant</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#2f6b3f", background: "rgba(47,107,63,0.12)", border: "1px solid rgba(47,107,63,0.3)", padding: "3px 9px", borderRadius: 999 }}>
              ✓ Aprobă
            </span>
          </div>
          <div data-rise="1" style={{ display: "flex", alignItems: "flex-start", gap: 10, animationDelay: "6.5s" }}>
            <span style={voteAvatar}>IR</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13.5 }}>
                  <b style={{ fontWeight: 600 }}>I. Radu</b> <span style={{ color: "var(--muted-foreground)" }}>· Executant</span>
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#9a3a30", background: "rgba(176,70,60,0.12)", border: "1px solid rgba(176,70,60,0.3)", padding: "3px 9px", borderRadius: 999, marginLeft: "auto" }}>
                  ✕ Dezaprobă
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 4, lineHeight: 1.45 }}>
                „Cosoroaba nu ține cornișa la deschiderea asta — mai pune un reazem.”
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
