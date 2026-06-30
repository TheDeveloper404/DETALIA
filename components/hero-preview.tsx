"use client";

import { type CSSProperties, useEffect, useState } from "react";

// Cardul de preview din hero-ul landing — oglindește un CARD REAL din feed (`DetailCard`): thumbnail cu
// planșa care „se desenează", etichetă de categorie, titlu, autor + rol, stivă de validatori, contoare
// (validări/comentarii/schițe) și pozițiile pe roluri (Aprobă/Dezaprobă cu justificare). La fiecare ciclu
// secvența se reia prin remontare (key=cycle) — un `animation-delay` pur CSS nu păstrează stagger-ul peste iterații.

const MONO = "var(--font-plex-mono), monospace";
const SANS = "var(--font-archivo), system-ui, sans-serif";
const CYCLE_MS = 6500;

const stackAvatar: CSSProperties = {
  flex: "none",
  width: 24,
  height: 24,
  borderRadius: "50%",
  background: "#ece4d6",
  border: "2px solid #ffffff",
  marginLeft: -7,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 9.5,
  color: "#6f685e",
  fontFamily: MONO,
};

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

// Pastilă de rol — același limbaj vizual ca RolePill din feed (fundal cald, text primary).
const rolePill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontFamily: MONO,
  fontSize: 11,
  color: "#a9573a",
  background: "#f6ede4",
  border: "1px solid #ecdcc8",
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
          background: "#ffffff",
          border: "1px solid #e3ddd2",
          borderRadius: "var(--radius)",
          boxShadow: "0 24px 60px -28px rgba(33,29,24,0.28)",
          overflow: "hidden",
        }}
      >
        {/* Thumbnail — planșa care se desenează, cu eticheta de categorie peste (ca în feed). */}
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
            Acoperișuri
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
            viewBox="0 0 420 250"
            fill="none"
            style={{ display: "block" }}
            aria-hidden
          >
            {/* contur secțiune atic */}
            <rect data-draw="1" pathLength={1} x="60" y="40" width="150" height="150" stroke="#c4b59c" strokeWidth="1.5" style={{ animationDelay: "0s" }} />
            <rect data-draw="1" pathLength={1} x="60" y="40" width="44" height="150" stroke="#c4b59c" strokeWidth="1.5" style={{ animationDelay: "0.3s" }} />
            {/* hașură termoizolație */}
            <line data-draw="1" pathLength={1} x1="104" y1="48" x2="186" y2="190" stroke="#d8cab1" strokeWidth="1" style={{ animationDelay: "0.55s" }} />
            <line data-draw="1" pathLength={1} x1="118" y1="48" x2="186" y2="166" stroke="#d8cab1" strokeWidth="1" style={{ animationDelay: "0.67s" }} />
            <line data-draw="1" pathLength={1} x1="132" y1="48" x2="186" y2="142" stroke="#d8cab1" strokeWidth="1" style={{ animationDelay: "0.79s" }} />
            <line data-draw="1" pathLength={1} x1="146" y1="48" x2="186" y2="118" stroke="#d8cab1" strokeWidth="1" style={{ animationDelay: "0.91s" }} />
            {/* cotă 30 cm */}
            <path data-draw="1" pathLength={1} d="M60 40 L60 24 L260 24" stroke="#a9573a" strokeWidth="1.4" fill="none" style={{ animationDelay: "1.1s" }} />
            <line data-draw="1" pathLength={1} x1="60" y1="16" x2="60" y2="32" stroke="#a9573a" strokeWidth="1" style={{ animationDelay: "1.18s" }} />
            <line data-draw="1" pathLength={1} x1="210" y1="16" x2="210" y2="32" stroke="#a9573a" strokeWidth="1" style={{ animationDelay: "1.26s" }} />
            <text data-fade="1" x="120" y="14" fontFamily={MONO} fontSize="12" fill="#a9573a" style={{ animationDelay: "1.5s" }}>
              30 cm
            </text>
            {/* indicator șorț tablă */}
            <circle data-draw="1" pathLength={1} cx="186" cy="92" r="4" stroke="#8a8073" strokeWidth="1" fill="none" style={{ animationDelay: "1.3s" }} />
            <line data-draw="1" pathLength={1} x1="186" y1="92" x2="300" y2="70" stroke="#8a8073" strokeWidth="1" style={{ animationDelay: "1.45s" }} />
            <text data-fade="1" x="306" y="66" fontFamily={MONO} fontSize="11" fill="#8a8073" style={{ animationDelay: "1.75s" }}>
              șorț tablă
            </text>
            {/* PROPUNEREA — desenată după detaliu (cineva propune pe schiță) */}
            <line data-draw="1" pathLength={1} x1="240" y1="120" x2="350" y2="120" stroke="#a9573a" strokeWidth="1.6" strokeLinecap="round" style={{ animationDelay: "2s" }} />
            <circle data-fade="1" cx="240" cy="120" r="3.5" fill="#a9573a" style={{ animationDelay: "2.2s" }} />
            <text data-fade="1" x="256" y="138" fontFamily={MONO} fontSize="11" fill="#a9573a" style={{ animationDelay: "2.3s" }}>
              propunere
            </text>
          </svg>
        </div>

        {/* Conținutul cardului — chrome-ul real din feed, apare după ce planșa s-a desenat. */}
        <div style={{ padding: "16px 18px 4px" }}>
          {/* Titlu */}
          <div data-rise="1" style={{ fontFamily: SANS, fontWeight: 700, fontSize: 16, color: "#211d18", animationDelay: "2.5s" }}>
            Atic acoperiș terasă
          </div>

          {/* Autor + rol */}
          <div data-rise="1" style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 9, animationDelay: "2.7s" }}>
            <span style={voteAvatar}>MP</span>
            <span style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 600, color: "#211d18" }}>M. Popa</span>
            <span style={rolePill}>Proiectant</span>
          </div>

          {/* Stivă de validatori — avatarele celor care au luat poziție (apar pe rând). */}
          <div data-rise="1" style={{ display: "flex", alignItems: "center", marginTop: 12, paddingLeft: 7, animationDelay: "3.2s" }}>
            <span style={stackAvatar}>IR</span>
            <span style={stackAvatar}>AS</span>
            <span style={stackAvatar}>DV</span>
            <span style={{ ...stackAvatar, fontWeight: 600, color: "#8a8073" }}>+9</span>
          </div>

          {/* Contoare — ca în feed: validări · comentarii · schițe în teanc. */}
          <div data-rise="1" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12, fontFamily: MONO, fontSize: 11.5, color: "#8a8073", animationDelay: "3.45s" }}>
            <span>12 validări</span>
            <span style={{ color: "#ddd4c4" }}>·</span>
            <span>3 comentarii</span>
            <span style={{ color: "#ddd4c4" }}>·</span>
            <span>5 schițe în teanc</span>
          </div>
        </div>

        {/* Pozițiile pe roluri — partea „vie" a dezbaterii (Aprobă / Dezaprobă cu justificare). */}
        <div style={{ padding: "12px 18px 16px", marginTop: 8, borderTop: "1px solid #eee6da", display: "flex", flexDirection: "column", gap: 10 }}>
          <div data-rise="1" style={{ display: "flex", alignItems: "center", gap: 10, animationDelay: "3.9s" }}>
            <span style={voteAvatar}>MP</span>
            <span style={{ fontSize: 13.5, flex: 1 }}>
              <b style={{ fontWeight: 600 }}>M. Popa</b> <span style={{ color: "#8a8073" }}>· Proiectant</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#2f6b3f", background: "#e9f2ea", border: "1px solid #d3e6d6", padding: "3px 9px", borderRadius: 999 }}>
              ✓ Aprobă
            </span>
          </div>
          <div data-rise="1" style={{ display: "flex", alignItems: "flex-start", gap: 10, animationDelay: "4.6s" }}>
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
  );
}
