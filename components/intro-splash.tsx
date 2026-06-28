"use client";

import { useEffect, useState } from "react";

// Intro de brand afișat o singură dată pe sesiune, înaintea landing-ului: un overlay full-screen
// cu logo-ul DETALIA animat (literele apar pe rând, apoi simbolul „A" din 3 triunghiuri). Se
// estompează după DURATION_MS, apoi dezvăluie landing-ul (randat în spate). Sărit automat dacă a
// fost deja văzut în sesiune sau dacă userul preferă mișcare redusă. CSS-ul stă în globals.css (.dt-intro).

const SEEN_KEY = "detalia_intro_seen";
const DURATION_MS = 3200; // cât stă intro-ul (anim ~1.8s + o scurtă pauză); în intervalul 3-5s
const FADE_MS = 600; // fade-out lin spre landing

// „DETALI" + simbolul „A" (triunghiurile) = DETALIA.
const LETTERS = ["D", "E", "T", "A", "L", "I"];

export function IntroSplash() {
  // „pending" = încă nu am decis → randăm NIMIC (fără overlay în SSR/primul render, deci fără flash
  // la refresh pentru cine a văzut deja intro-ul). Trecem în „show" doar la prima vizită a sesiunii.
  const [phase, setPhase] = useState<"pending" | "show" | "hiding" | "done">("pending");

  // Decizie la montare. Dacă a fost deja văzut / reduced-motion → rămânem „pending" (nu arătăm nimic,
  // niciun setState). Altfel programăm afișarea + auto-dismiss. NU marcăm „văzut" aici: în React Strict
  // Mode (dev) efectul rulează de două ori; flag-ul l-am scrie prematur și al doilea pas ar sări intro-ul.
  // Marcăm „văzut" abia la dismiss (efectul de mai jos). setState e programat (timeout) — nu sincron în effect.
  useEffect(() => {
    const seen = sessionStorage.getItem(SEEN_KEY);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduce) return; // rămâne „pending" → render null, fără flash
    const show = setTimeout(() => setPhase("show"), 0);
    const hide = setTimeout(() => setPhase("hiding"), DURATION_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPhase("hiding");
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // La dismiss: marcăm „văzut", scoatem cover-ul pre-paint (data-intro) ca fade-ul overlay-ului să
  // dezvăluie landing-ul, apoi demontăm după fade-out.
  useEffect(() => {
    if (phase !== "hiding") return;
    sessionStorage.setItem(SEEN_KEY, "1");
    document.documentElement.removeAttribute("data-intro");
    const t = setTimeout(() => setPhase("done"), FADE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // Blocăm scroll-ul DOAR cât timp overlay-ul e efectiv afișat; îl restaurăm când dispare.
  useEffect(() => {
    if (phase !== "show" && phase !== "hiding") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  if (phase === "pending" || phase === "done") return null;

  return (
    <div
      className="dt-intro"
      role="dialog"
      aria-label="Bun venit pe DETALIA"
      onClick={() => setPhase("hiding")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        background: "#faf8f4",
        opacity: phase === "hiding" ? 0 : 1,
        transition: `opacity ${FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        // În timpul fade-out-ului overlay-ul nu mai interceptează nimic (clicks trec spre landing).
        pointerEvents: phase === "hiding" ? "none" : "auto",
        cursor: "pointer",
      }}
    >
      <div className="dt-logo">
        <div className="dt-text" aria-hidden>
          {LETTERS.map((c, i) => (
            <span key={i} className="dt-char" style={{ animationDelay: `${i * 0.08}s` }}>
              {c}
            </span>
          ))}
        </div>

        {/* Simbolul „A" — 3 triunghiuri stratificate (negru + două straturi aurii), pe traseu vectorial unic. */}
        <div className="dt-mark">
          <svg className="dt-logo-svg" viewBox="0 0 100 100" aria-hidden>
            <defs>
              <path id="dt-tri-shape" d="M 30 5 L 50 5 L 85 95 L 5 95 Z" />
            </defs>
            <use href="#dt-tri-shape" className="tri-black" />
            <use href="#dt-tri-shape" className="tri-mid" />
            <use href="#dt-tri-shape" className="tri-light" />
          </svg>
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setPhase("hiding");
        }}
        style={{
          fontFamily: "var(--font-plex-mono), monospace",
          fontSize: 12.5,
          letterSpacing: "0.04em",
          color: "#8a8073",
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        Sari peste →
      </button>
    </div>
  );
}
