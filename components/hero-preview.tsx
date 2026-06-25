"use client";

import { type CSSProperties, useEffect, useState } from "react";

// Cardul de preview din hero-ul landing (planșă + voturi pe roluri). Animat: la fiecare ciclu
// detaliul „se desenează" singur, apoi apare propunerea, apoi rândurile de vot (Aprobă/Dezaprobă).
// Întreaga secvență se reia la fiecare CYCLE_MS prin remontare (key=cycle) — un `animation-delay`
// pur CSS nu păstrează stagger-ul peste iterații, așa că re-pornim secvența explicit.

const MONO = "var(--font-plex-mono), monospace";
const CYCLE_MS = 6000;

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
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e3ddd2",
          borderRadius: "var(--radius)",
          boxShadow: "0 24px 60px -28px rgba(33,29,24,0.28)",
          overflow: "hidden",
        }}
      >
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

        {/* Planșă — se redesenează la fiecare ciclu (key=cycle remontează SVG-ul). */}
        <div style={{ position: "relative", background: "#faf7f1", padding: 22 }}>
          <svg
            key={cycle}
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

        {/* Voturi pe roluri — apar pe rând după ce planșa s-a desenat (key=cycle reia apariția). */}
        <div key={cycle} style={{ padding: "14px 18px", borderTop: "1px solid #eee6da", display: "flex", flexDirection: "column", gap: 10 }}>
          <div data-rise="1" style={{ display: "flex", alignItems: "center", gap: 10, animationDelay: "2.8s" }}>
            <span style={voteAvatar}>MP</span>
            <span style={{ fontSize: 13.5, flex: 1 }}>
              <b style={{ fontWeight: 600 }}>M. Popa</b> <span style={{ color: "#8a8073" }}>· Proiectant</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#2f6b3f", background: "#e9f2ea", border: "1px solid #d3e6d6", padding: "3px 9px", borderRadius: 999 }}>
              ✓ Aprobă
            </span>
          </div>
          <div data-rise="1" style={{ display: "flex", alignItems: "flex-start", gap: 10, animationDelay: "3.5s" }}>
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
