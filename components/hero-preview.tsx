"use client";

import { type CSSProperties, useEffect, useState } from "react";

// Cardul de preview din hero-ul landing — (1) FEED: screenshot al componentei REALE `DetailCard`,
// randată cu date fictive (public/landing/feed-real.png, generat 2026-08-07 — vezi CHANGELOG pentru
// metodă), nu o recreere manuală — reflectă exact UI-ul curent (font/iconițe/culori). La o schimbare
// viitoare de UI, se regenerează la fel (randezi cardul cu date fictive, screenshot, decupezi).
// Tap simulat pe cardul „Cornișă șarpantă lemn" (al treilea, cel care chiar se deschide spre exact
// desenul de mai jos), (2) crossfade spre detaliul REAL (imagine, fundal eliminat —
// public/landing/hero-detail.png) cu o propunere desenată live peste el (traseu subțire + hașură,
// filtru fin de „mână"), (3) chrome-ul cardului (titlu/autor/rol — IDENTICE cu cardul din feed, ca
// tranziția să fie continuă) + lista de poziții (nume + rol + „aprobă"/„dezaprobă" text simplu colorat,
// fără pastilă/scor — IDENTIC cu lista din validation-panel.tsx, secțiunea „Pozițiile celorlalți").
// La fiecare ciclu secvența se reia prin remontare (key=cycle) — un `animation-delay` pur CSS nu
// păstrează stagger-ul peste iterații.

const MONO = "var(--font-plex-mono), monospace";
const SANS = "var(--font-archivo), system-ui, sans-serif";
const CYCLE_MS = 10500;
// Revenirea la feed (remount pe key=cycle) altfel e instant/bruscă — fadăm cardul la 0 ÎNAINTE de
// remount, apoi îl remontăm (invizibil) și îl lăsăm să reapară — un crossfade, nu o tăietură seacă.
const LOOP_FADE_MS = 450;

// Silueta generică — ACEEAȘI iconiță (path) ca PersonSilhouette din avatar-initials.tsx. Aplicația reală
// NU arată inițiale-text pentru avatare fără poză (nici în ValidatorStack, nici în lista de poziții din
// validation-panel.tsx) — arată mereu silueta asta, pe fundal cald.
const SILHOUETTE_PATH =
  "M12 12c2.65 0 4.8-2.15 4.8-4.8S14.65 2.4 12 2.4 7.2 4.55 7.2 7.2 9.35 12 12 12Zm0 2.4c-3.2 0-9.6 1.61-9.6 4.8v2.4h19.2v-2.4c0-3.19-6.4-4.8-9.6-4.8Z";

function SilhouetteAvatar({ size, style }: { size: number; style?: CSSProperties }) {
  return (
    <span
      aria-hidden
      style={{
        flex: "none",
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--muted-foreground)",
        ...style,
      }}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: size * 0.55, height: size * 0.55 }}>
        <path d={SILHOUETTE_PATH} />
      </svg>
    </span>
  );
}

// Pastilă de rol — ACEEAȘI logică de culoare ca RolePill.tsx (colorat pe rolul principal, eticheta e
// MESERIA/subrolul, nu rolul principal ca text simplu — „Nume · Arhitect", nu „Nume · Proiectant").
const ROLE_STYLE: Record<string, { bg: string; fg: string }> = {
  PROIECTANT: { bg: "#a9573a", fg: "#ffffff" },
  EXECUTANT: { bg: "#7a8a3f", fg: "#ffffff" },
  FURNIZOR: { bg: "#5e6f8a", fg: "#ffffff" },
  BENEFICIAR: { bg: "#ece4d6", fg: "#5d564c" },
};

function RolePillStatic({ roleMain, label }: { roleMain: keyof typeof ROLE_STYLE; label: string }) {
  const style = ROLE_STYLE[roleMain];
  return (
    <span
      style={{
        display: "inline-block",
        whiteSpace: "nowrap",
        borderRadius: 999,
        padding: "2px 8px",
        fontFamily: MONO,
        fontSize: 11.5,
        lineHeight: 1,
        background: style.bg,
        color: style.fg,
      }}
    >
      {label}
    </span>
  );
}

export function HeroPreview() {
  const [cycle, setCycle] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Respectă prefers-reduced-motion: nu mai reluăm secvența (totul rămâne afișat static).
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCycle((c) => c + 1);
        setFading(false);
      }, LOOP_FADE_MS);
    }, CYCLE_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ position: "relative" }}>
      {/* key=cycle pe tot cardul → remontează SVG-ul (se redesenează) ȘI re-pornește apariția chrome-ului.
          `fading` fadează cardul la 0 ÎNAINTE de remount (crossfade la reluarea ciclului, nu o tăietură). */}
      <div
        key={cycle}
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          boxShadow: "0 24px 60px -28px rgba(33,29,24,0.28)",
          overflow: "hidden",
          opacity: fading ? 0 : 1,
          transition: `opacity ${LOOP_FADE_MS}ms ease`,
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
            aspectRatio: "676 / 693",
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
              style={{ animationDelay: "2.9s" }}
            />
            {/* PROPUNEREA — traseu principal (contur element nou, linie subțire ca un creion, nu
                marker gros) + hașură (notația reală de material din desenul tehnic) — o schiță
                compusă din mai multe tușe succesive, poziționată lângă joncțiunea pantă-perete. */}
            <path
              data-draw="1"
              pathLength={1}
              d="M100 50 L 122 50 L 122 36 L 140 36"
              stroke="var(--primary)" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"
              style={{ filter: "url(#dc-hero-sketch-rough)", animationDelay: "3.5s" }}
            />
            {/* Hașură — 4 tuse scurte, succesive, ca material nou adăugat (izolație) în zona conturată. */}
            <path data-draw="1" pathLength={1} d="M104 47 L 110 40" stroke="var(--primary)" strokeWidth="1" strokeLinecap="round"
              style={{ filter: "url(#dc-hero-sketch-rough)", animationDelay: "4.25s" }} />
            <path data-draw="1" pathLength={1} d="M110 47 L 116 40" stroke="var(--primary)" strokeWidth="1" strokeLinecap="round"
              style={{ filter: "url(#dc-hero-sketch-rough)", animationDelay: "4.35s" }} />
            <path data-draw="1" pathLength={1} d="M116 47 L 122 40" stroke="var(--primary)" strokeWidth="1" strokeLinecap="round"
              style={{ filter: "url(#dc-hero-sketch-rough)", animationDelay: "4.45s" }} />
            <path data-draw="1" pathLength={1} d="M126 34 L 134 34" stroke="var(--primary)" strokeWidth="1" strokeLinecap="round"
              style={{ filter: "url(#dc-hero-sketch-rough)", animationDelay: "4.55s" }} />
            <circle data-fade="1" cx="140" cy="36" r="2.2" fill="var(--primary)" style={{ animationDelay: "5.1s" }} />
            <text data-fade="1" x="98" y="26" fontFamily={MONO} fontSize="8.5" fill="var(--primary)" style={{ animationDelay: "5.2s" }}>
              propunere
            </text>
          </svg>
        </div>

        {/* Conținutul cardului — IDENTIC cu al treilea card din feed-real.png (titlu/autor/rol), ca
            tranziția să fie continuă, nu un montaj cu date diferite. */}
        <div style={{ padding: "16px 18px 4px" }}>
          {/* Titlu */}
          <div data-rise="1" style={{ fontFamily: SANS, fontWeight: 700, fontSize: 16, color: "var(--foreground)", animationDelay: "5.7s" }}>
            Cornișă șarpantă lemn
          </div>

          {/* Autor + rol */}
          <div data-rise="1" style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 9, animationDelay: "5.9s" }}>
            <SilhouetteAvatar size={28} />
            <span style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 600, color: "var(--foreground)" }}>R. Ionescu</span>
            <RolePillStatic roleMain="BENEFICIAR" label="Beneficiar" />
          </div>

          {/* Stivă de validatori — avatarele celor care au luat poziție (apar pe rând), suprapuse. */}
          <div data-rise="1" style={{ display: "flex", alignItems: "center", marginTop: 12, animationDelay: "6.4s" }}>
            <SilhouetteAvatar size={24} style={{ border: "2px solid var(--card)" }} />
            <SilhouetteAvatar size={24} style={{ border: "2px solid var(--card)", marginLeft: -8 }} />
          </div>

          {/* Contoare — ca în feed: validări · comentarii · schițe în teanc. */}
          <div data-rise="1" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12, fontFamily: MONO, fontSize: 11.5, color: "var(--muted-foreground)", animationDelay: "6.65s" }}>
            <span>2 validări</span>
            <span style={{ color: "var(--border)" }}>·</span>
            <span>1 comentariu</span>
            <span style={{ color: "var(--border)" }}>·</span>
            <span>2 schițe în teanc</span>
          </div>
        </div>

        {/* Pozițiile celorlalți — nume + rol, text simplu colorat (aprobă/dezaprobă), fără pastilă/citat —
            IDENTIC cu lista din validation-panel.tsx (fără scor, doar rolul, la vedere). */}
        <div style={{ padding: "12px 18px 16px", marginTop: 8, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div data-rise="1" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, animationDelay: "7.1s" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <SilhouetteAvatar size={28} />
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>M. Popa</span>
              <RolePillStatic roleMain="PROIECTANT" label="Arhitect" />
            </span>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 500, color: "#2f6b3f" }}>aprobă</span>
          </div>
          <div data-rise="1" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, animationDelay: "7.8s" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <SilhouetteAvatar size={28} />
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>I. Radu</span>
              <RolePillStatic roleMain="EXECUTANT" label="Constructor" />
            </span>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 500, color: "var(--destructive)" }}>dezaprobă</span>
          </div>
        </div>
      </div>
    </div>
  );
}
