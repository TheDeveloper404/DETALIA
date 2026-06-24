"use client";

import { useActionState, useEffect, useState } from "react";

import {
  ROLE_MAINS,
  ROLE_MAIN_LABELS,
  SUBROLES,
  type RoleMain,
} from "@/server/domain/roles";

import { onboardingAction, type OnboardingState } from "./actions";

const initialState: OnboardingState = { error: null };

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-plex-mono), monospace",
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#8a8073",
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: "var(--font-archivo), sans-serif",
  fontSize: 16,
  color: "var(--foreground)",
  background: "var(--background)",
  border: "1px solid var(--input)",
  borderRadius: "var(--radius)",
  padding: "13px 14px",
};

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(onboardingAction, initialState);

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [rol, setRol] = useState<RoleMain>("PROIECTANT");
  const [subrol, setSubrol] = useState<string>(SUBROLES.PROIECTANT[0]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const subroluri = SUBROLES[rol];

  // Curăță object URL-urile de preview (evită leak de memorie).
  useEffect(() => {
    return () => {
      if (avatarUrl) URL.revokeObjectURL(avatarUrl);
      if (coverUrl) URL.revokeObjectURL(coverUrl);
    };
  }, [avatarUrl, coverUrl]);

  const fullName = `${first} ${last}`.trim();
  const displayName = fullName || "Numele tău";
  const initials =
    ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "—";
  const pillText = subrol
    ? `${ROLE_MAIN_LABELS[rol]} · ${subrol}`
    : ROLE_MAIN_LABELS[rol];

  function onRol(value: string) {
    const next = value as RoleMain;
    setRol(next);
    setSubrol(SUBROLES[next][0] ?? "");
  }

  function onPickImage(file: File | undefined, set: (url: string | null) => void, prev: string | null) {
    if (prev) URL.revokeObjectURL(prev);
    set(file ? URL.createObjectURL(file) : null);
  }

  return (
    <form action={formAction} className="dt-onb">
      {/* CARD */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          boxShadow: "0 26px 64px -40px rgba(33,29,24,0.4)",
          overflow: "hidden",
        }}
      >
        {/* LIVE PREVIEW STRIP */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 15,
            padding: "18px 24px",
            background: "#f6f2ea",
            borderBottom: "1px solid #ece4d6",
          }}
        >
          <span
            style={{
              flex: "none",
              position: "relative",
              width: 50,
              height: 50,
              borderRadius: "50%",
              overflow: "hidden",
              background: "#e3d6c4",
              border: "1px solid #ddceba",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span
                style={{
                  fontFamily: "var(--font-plex-mono), monospace",
                  fontSize: 15,
                  color: "#7c7060",
                }}
              >
                {initials}
              </span>
            )}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontFamily: "var(--font-plex-mono), monospace",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#a59a88",
                marginBottom: 5,
              }}
            >
              Cum vei apărea
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: 17, color: "#211d18" }}>
                {displayName}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-plex-mono), monospace",
                  fontSize: 12,
                  color: "#fff",
                  background: "#a9573a",
                  padding: "3px 10px",
                  borderRadius: 999,
                  whiteSpace: "nowrap",
                }}
              >
                {pillText}
              </span>
            </div>
          </div>
        </div>

        {/* FORM BODY */}
        <div style={{ padding: "28px 32px 32px" }}>
          {state.error && (
            <p
              role="alert"
              style={{
                margin: "0 0 20px",
                borderRadius: 10,
                border: "1px solid rgba(176,70,60,0.3)",
                background: "rgba(176,70,60,0.08)",
                padding: "11px 14px",
                fontSize: 14,
                color: "#b0463c",
              }}
            >
              {state.error}
            </p>
          )}

          {/* Prenume + Nume */}
          <div className="dt-row2" style={{ marginBottom: 20 }}>
            <div>
              <label htmlFor="dt-first" style={labelStyle}>
                Prenume
              </label>
              <input
                id="dt-first"
                name="firstName"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                placeholder="Andrei"
                maxLength={80}
                required
                className="dt-field"
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="dt-last" style={labelStyle}>
                Nume
              </label>
              <input
                id="dt-last"
                name="lastName"
                value={last}
                onChange={(e) => setLast(e.target.value)}
                placeholder="Munteanu"
                maxLength={80}
                required
                className="dt-field"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Rol + Subrol */}
          <div className="dt-row2" style={{ marginBottom: 20 }}>
            <div>
              <label htmlFor="dt-rol" style={labelStyle}>
                Rol principal
              </label>
              <select
                id="dt-rol"
                name="roleMain"
                value={rol}
                onChange={(e) => onRol(e.target.value)}
                className="dt-field dt-select"
                style={{ ...inputStyle, cursor: "pointer", paddingRight: 38 }}
              >
                {ROLE_MAINS.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_MAIN_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dt-subrol" style={labelStyle}>
                Subrol
              </label>
              <select
                id="dt-subrol"
                name="subRole"
                value={subrol}
                onChange={(e) => setSubrol(e.target.value)}
                className="dt-field dt-select"
                style={{ ...inputStyle, cursor: "pointer", paddingRight: 38 }}
              >
                {subroluri.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Headline */}
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="dt-headline" style={labelStyle}>
              Headline
            </label>
            <input
              id="dt-headline"
              name="headline"
              placeholder="Arhitect · detalii de execuție"
              maxLength={120}
              className="dt-field"
              style={inputStyle}
            />
            <div style={{ fontSize: 12.5, color: "#a59a88", marginTop: 7, lineHeight: 1.4 }}>
              O linie scurtă, ca pe LinkedIn — apare sub numele tău pe profil.
            </div>
          </div>

          {/* Locație + Website */}
          <div className="dt-row2" style={{ marginBottom: 24 }}>
            <div>
              <label htmlFor="dt-oras" style={labelStyle}>
                Locație
              </label>
              <input
                id="dt-oras"
                name="location"
                placeholder="Cluj-Napoca"
                maxLength={80}
                className="dt-field"
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="dt-web" style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 7 }}>
                Website{" "}
                <span style={{ color: "#b8ad9b", letterSpacing: "0.04em", textTransform: "none" }}>
                  (opțional)
                </span>
              </label>
              <input
                id="dt-web"
                name="website"
                placeholder="exemplu.ro"
                maxLength={200}
                className="dt-field"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Media: avatar + cover */}
          <div
            className="dt-media"
            style={{ alignItems: "stretch", paddingTop: 22, borderTop: "1px solid #ece4d6" }}
          >
            {/* avatar */}
            <div>
              <label style={{ ...labelStyle, marginBottom: 10 }}>Poză de profil</label>
              <label htmlFor="dt-avatar" style={{ display: "flex", alignItems: "center", gap: 13, cursor: "pointer" }}>
                <span
                  style={{
                    flex: "none",
                    position: "relative",
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    overflow: "hidden",
                    background: "#f3efe8",
                    border: "1.5px dashed #cbbfa9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a9573a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="9" r="3.2" />
                      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
                    </svg>
                  )}
                </span>
                <span style={{ fontWeight: 600, fontSize: 14, color: "#a9573a" }}>
                  {avatarUrl ? "Schimbă poza" : "Încarcă o poză"}
                </span>
              </label>
              <input
                id="dt-avatar"
                name="avatar"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                onChange={(e) => onPickImage(e.target.files?.[0], setAvatarUrl, avatarUrl)}
                style={{ display: "none" }}
              />
            </div>

            {/* cover */}
            <div style={{ minWidth: 0 }}>
              <label style={{ ...labelStyle, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
                Imagine de cover{" "}
                <span style={{ color: "#b8ad9b", letterSpacing: "0.04em", textTransform: "none" }}>
                  (opțional)
                </span>
              </label>
              <label htmlFor="dt-cover" style={{ display: "block", cursor: "pointer" }}>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 9,
                    position: "relative",
                    height: 72,
                    borderRadius: "var(--radius)",
                    overflow: "hidden",
                    background: "#f6f2ea",
                    border: "1.5px dashed #cbbfa9",
                  }}
                >
                  {coverUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={coverUrl}
                        alt=""
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <span
                        style={{
                          position: "relative",
                          zIndex: 1,
                          fontFamily: "var(--font-plex-mono), monospace",
                          fontSize: 11,
                          color: "#fff",
                          background: "rgba(33,29,24,0.55)",
                          padding: "4px 10px",
                          borderRadius: 999,
                        }}
                      >
                        Schimbă banda
                      </span>
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a9573a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <circle cx="8.5" cy="10" r="1.6" />
                        <path d="m21 16-5-5L5 19" />
                      </svg>
                      <span style={{ fontWeight: 600, fontSize: 14, color: "#a9573a" }}>
                        Adaugă o bandă de cover
                      </span>
                    </>
                  )}
                </span>
              </label>
              <input
                id="dt-cover"
                name="cover"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                onChange={(e) => onPickImage(e.target.files?.[0], setCoverUrl, coverUrl)}
                style={{ display: "none" }}
              />
            </div>
          </div>

          {/* CTA */}
          <button
            type="submit"
            disabled={pending}
            className="dt-cta"
            style={{
              width: "100%",
              marginTop: 28,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              fontWeight: 600,
              fontSize: 16.5,
              padding: "15px 20px",
              borderRadius: "var(--radius)",
              border: "1px solid #95492e",
              cursor: pending ? "default" : "pointer",
              opacity: pending ? 0.75 : 1,
            }}
          >
            {pending ? "Se salvează…" : "Continuă în feed"}
            {!pending && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            )}
          </button>
          <p
            style={{
              textAlign: "center",
              fontSize: 13,
              color: "#8a8073",
              lineHeight: 1.5,
              margin: "14px 0 0",
            }}
          >
            Îți poți verifica rolul mai târziu, din profil — nu e obligatoriu acum.
          </p>
        </div>
      </div>
    </form>
  );
}
