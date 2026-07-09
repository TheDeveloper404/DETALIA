"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { CityAutocomplete } from "@/components/city-autocomplete";
import { HEIC_ERROR_MESSAGE, HeicUnsupportedError, isHeicFile, uploadImageToBlob } from "@/lib/blob-upload";
import { ALLOWED_IMAGE_TYPES, MAX_AVATAR_BYTES, MAX_AVATAR_MB } from "@/lib/upload-limits";
import {
  ROLE_MAINS,
  ROLE_MAIN_LABELS,
  SECONDARY_ROLES,
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
  color: "var(--muted-foreground)",
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
  // Fără preselecție: userul ALEGE explicit rolul și subrolul (placeholder „Alege…").
  const [rol, setRol] = useState<RoleMain | "">("");
  const [subrol, setSubrol] = useState<string>("");
  const [rolAditional, setRolAditional] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverPos, setCoverPos] = useState(50); // poziția verticală cover (0..100), ca în profile edit
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [clientErr, setClientErr] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const avatarUrlRef = useRef<HTMLInputElement>(null);
  const coverUrlRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const coverBandRef = useRef<HTMLDivElement>(null);
  const coverDrag = useRef<{ startY: number; startPos: number } | null>(null);

  const subroluri = rol ? SUBROLES[rol] : [];

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
  // Doar meseria apare în platformă (rolul principal e doar grupare la alegere, vezi lista_meserii.md).
  const pillText = subrol || null;

  function onRol(value: string) {
    const next = value as RoleMain | "";
    setRol(next);
    setSubrol(""); // schimbi rolul → re-alegi subrolul (fără predefinit)
  }

  // Repoziționare cover (LinkedIn-style, ca în profile edit): tragi sus/jos în bandă.
  function onCoverPointerDown(e: React.PointerEvent) {
    coverDrag.current = { startY: e.clientY, startPos: coverPos };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onCoverPointerMove(e: React.PointerEvent) {
    if (!coverDrag.current) return;
    const h = coverBandRef.current?.offsetHeight ?? 72;
    const delta = ((e.clientY - coverDrag.current.startY) / h) * 100;
    setCoverPos(Math.round(Math.min(100, Math.max(0, coverDrag.current.startPos - delta))));
  }
  function onCoverPointerUp() {
    coverDrag.current = null;
  }

  // Alege o imagine (avatar/cover): validare client (doar UX) + preview. Upload-ul efectiv în Blob
  // se face la submit. `null` curăță. Câmpul ascuns de URL se golește → forțează re-upload la o imagine nouă.
  function pickImage(file: File | undefined, kind: "avatar" | "cover") {
    const prev = kind === "avatar" ? avatarUrl : coverUrl;
    if (prev) URL.revokeObjectURL(prev);
    if (!file) {
      if (kind === "avatar") {
        setAvatarUrl(null);
        setAvatarFile(null);
      } else {
        setCoverUrl(null);
        setCoverFile(null);
      }
      return;
    }
    if (isHeicFile(file)) {
      setClientErr(HEIC_ERROR_MESSAGE);
      return;
    }
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setClientErr("Poza trebuie să fie PNG, JPG, WebP sau AVIF.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setClientErr(`Poza e prea mare (max ${MAX_AVATAR_MB} MB).`);
      return;
    }
    setClientErr(null);
    const url = URL.createObjectURL(file);
    if (kind === "avatar") {
      setAvatarUrl(url);
      setAvatarFile(file);
      if (avatarUrlRef.current) avatarUrlRef.current.value = "";
    } else {
      setCoverUrl(url);
      setCoverFile(file);
      setCoverPos(50); // cover nou → poziție centrată implicit
      if (coverUrlRef.current) coverUrlRef.current.value = "";
    }
  }

  // Avatar/cover sunt opționale. La submit, urcăm DIRECT în Blob fișierele alese (ne-urcate încă),
  // punem URL-urile în câmpurile ascunse, apoi re-trimitem formularul către server action.
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const needAvatar = avatarFile && !avatarUrlRef.current?.value;
    const needCover = coverFile && !coverUrlRef.current?.value;
    if (needAvatar || needCover) {
      e.preventDefault();
      if (uploading) return;
      setUploading(true);
      setClientErr(null);
      try {
        if (needAvatar) {
          const u = await uploadImageToBlob("avatars", avatarFile!, "avatar");
          if (avatarUrlRef.current) avatarUrlRef.current.value = u;
        }
        if (needCover) {
          const u = await uploadImageToBlob("covers", coverFile!, "avatar");
          if (coverUrlRef.current) coverUrlRef.current.value = u;
        }
        formRef.current?.requestSubmit();
      } catch (err) {
        setClientErr(
          err instanceof HeicUnsupportedError
            ? HEIC_ERROR_MESSAGE
            : "Încărcarea imaginii a eșuat. Încearcă din nou.",
        );
      } finally {
        setUploading(false);
      }
    }
    // fără imagini de urcat → lăsăm submit-ul să ajungă la server action.
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="dt-onb">
      {/* URL-urile imaginilor (completate după upload-ul client în Blob). */}
      <input type="hidden" name="avatarUrl" ref={avatarUrlRef} />
      <input type="hidden" name="coverUrl" ref={coverUrlRef} />
      <input type="hidden" name="coverPosition" value={coverPos} readOnly />
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
            background: "var(--secondary)",
            borderBottom: "1px solid var(--border)",
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
              background: "var(--secondary)",
              border: "1px solid var(--border)",
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
                  color: "var(--muted-foreground)",
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
                color: "var(--muted-foreground)",
                marginBottom: 5,
              }}
            >
              Cum vei apărea
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: 17, color: "var(--foreground)" }}>
                {displayName}
              </span>
              {pillText && (
                <span
                  style={{
                    fontFamily: "var(--font-plex-mono), monospace",
                    fontSize: 12,
                    color: "var(--primary-foreground)",
                    background: "var(--primary)",
                    padding: "3px 10px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                  }}
                >
                  {pillText}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* FORM BODY */}
        <div style={{ padding: "28px 32px 32px" }}>
          {(clientErr ?? state.error) && (
            <p
              role="alert"
              style={{
                margin: "0 0 20px",
                borderRadius: 10,
                border: "1px solid rgba(176,70,60,0.3)",
                background: "rgba(176,70,60,0.08)",
                padding: "11px 14px",
                fontSize: 14,
                color: "var(--destructive)",
              }}
            >
              {clientErr ?? state.error}
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

          {/* Domeniu (rol principal) + Rolul tău (subrol) */}
          <div className="dt-row2" style={{ marginBottom: 20 }}>
            <div>
              <label htmlFor="dt-rol" style={labelStyle}>
                Domeniu
              </label>
              <select
                id="dt-rol"
                name="roleMain"
                value={rol}
                onChange={(e) => onRol(e.target.value)}
                required
                className="dt-field dt-select"
                style={{ ...inputStyle, cursor: "pointer", paddingRight: 38, color: rol ? "var(--foreground)" : "var(--muted-foreground)" }}
              >
                <option value="" disabled>
                  Alege domeniul
                </option>
                {ROLE_MAINS.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_MAIN_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dt-subrol" style={labelStyle}>
                Rolul tău
              </label>
              <select
                id="dt-subrol"
                name="subRole"
                value={subrol}
                onChange={(e) => setSubrol(e.target.value)}
                required
                disabled={!rol}
                className="dt-field dt-select"
                style={{
                  ...inputStyle,
                  cursor: rol ? "pointer" : "not-allowed",
                  paddingRight: 38,
                  color: subrol ? "var(--foreground)" : "var(--muted-foreground)",
                  opacity: rol ? 1 : 0.6,
                }}
              >
                <option value="" disabled>
                  {rol ? "Alege rolul tău" : "Alege întâi domeniul"}
                </option>
                {subroluri.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Rol adițional (opțional) — Administrativ/Educație, se adaugă PESTE meseria de bază. */}
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="dt-rol-aditional" style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 7 }}>
              Rol adițional{" "}
              <span style={{ color: "var(--muted-foreground)", letterSpacing: "0.04em", textTransform: "none" }}>
                (opțional)
              </span>
            </label>
            <select
              id="dt-rol-aditional"
              name="secondaryRole"
              value={rolAditional}
              onChange={(e) => setRolAditional(e.target.value)}
              className="dt-field dt-select"
              style={{
                ...inputStyle,
                cursor: "pointer",
                paddingRight: 38,
                color: rolAditional ? "var(--foreground)" : "var(--muted-foreground)",
              }}
            >
              <option value="">Niciunul</option>
              {SECONDARY_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
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
            <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 7, lineHeight: 1.4 }}>
              O linie scurtă, ca pe LinkedIn — apare sub numele tău pe profil.
            </div>
          </div>

          {/* Locație + Website */}
          <div className="dt-row2" style={{ marginBottom: 24 }}>
            <div>
              <label htmlFor="dt-oras" style={labelStyle}>
                Locație
              </label>
              <CityAutocomplete
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
                <span style={{ color: "var(--muted-foreground)", letterSpacing: "0.04em", textTransform: "none" }}>
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

          {/* Firmă (opțional) */}
          <div style={{ marginBottom: 24 }}>
            <label htmlFor="dt-company" style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 7 }}>
              Firmă{" "}
              <span style={{ color: "var(--muted-foreground)", letterSpacing: "0.04em", textTransform: "none" }}>
                (opțional)
              </span>
            </label>
            <input
              id="dt-company"
              name="company"
              placeholder="Firma pe care o reprezinți"
              maxLength={120}
              className="dt-field"
              style={inputStyle}
            />
          </div>

          {/* Media: avatar + cover */}
          <div
            className="dt-media"
            style={{ alignItems: "stretch", paddingTop: 22, borderTop: "1px solid var(--border)" }}
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
                    background: "var(--secondary)",
                    border: "1.5px dashed var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="9" r="3.2" />
                      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
                    </svg>
                  )}
                </span>
                <span style={{ fontWeight: 600, fontSize: 14, color: "var(--primary)" }}>
                  {avatarUrl ? "Schimbă poza" : "Încarcă o poză"}
                </span>
              </label>
              <input
                id="dt-avatar"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                onChange={(e) => pickImage(e.target.files?.[0], "avatar")}
                style={{ display: "none" }}
              />
            </div>

            {/* cover */}
            <div style={{ minWidth: 0 }}>
              <label style={{ ...labelStyle, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
                Imagine de cover{" "}
                <span style={{ color: "var(--muted-foreground)", letterSpacing: "0.04em", textTransform: "none" }}>
                  (opțional)
                </span>
              </label>
              {coverUrl ? (
                <div
                  ref={coverBandRef}
                  onPointerDown={onCoverPointerDown}
                  onPointerMove={onCoverPointerMove}
                  onPointerUp={onCoverPointerUp}
                  style={{
                    position: "relative",
                    height: 72,
                    borderRadius: "var(--radius)",
                    overflow: "hidden",
                    border: "1.5px solid var(--border)",
                    cursor: "grab",
                    touchAction: "none",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverUrl}
                    alt=""
                    draggable={false}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: `50% ${coverPos}%`,
                      userSelect: "none",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      bottom: 6,
                      left: "50%",
                      transform: "translateX(-50%)",
                      pointerEvents: "none",
                      fontFamily: "var(--font-plex-mono), monospace",
                      fontSize: 10.5,
                      color: "#fff",
                      background: "rgba(33,29,24,0.6)",
                      padding: "3px 9px",
                      borderRadius: 999,
                      whiteSpace: "nowrap",
                    }}
                  >
                    trage sus/jos pentru a repoziționa
                  </span>
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      fontFamily: "var(--font-plex-mono), monospace",
                      fontSize: 10.5,
                      color: "#fff",
                      background: "rgba(33,29,24,0.6)",
                      border: "none",
                      padding: "4px 9px",
                      borderRadius: 999,
                      cursor: "pointer",
                    }}
                  >
                    Schimbă banda
                  </button>
                </div>
              ) : (
                <label htmlFor="dt-cover" style={{ display: "block", cursor: "pointer" }}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 9,
                      height: 72,
                      borderRadius: "var(--radius)",
                      overflow: "hidden",
                      background: "var(--secondary)",
                      border: "1.5px dashed var(--border)",
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <circle cx="8.5" cy="10" r="1.6" />
                      <path d="m21 16-5-5L5 19" />
                    </svg>
                    <span style={{ fontWeight: 600, fontSize: 14, color: "var(--primary)" }}>
                      Adaugă o bandă de cover
                    </span>
                  </span>
                </label>
              )}
              <input
                id="dt-cover"
                ref={coverInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                onChange={(e) => pickImage(e.target.files?.[0], "cover")}
                style={{ display: "none" }}
              />
            </div>
          </div>

          {/* CTA */}
          <button
            type="submit"
            disabled={pending || uploading}
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
              border: "1px solid var(--primary-button-border)",
              cursor: pending || uploading ? "default" : "pointer",
              opacity: pending || uploading ? 0.75 : 1,
            }}
          >
            {uploading ? "Se încarcă imaginile…" : pending ? "Se salvează…" : "Continuă în feed"}
            {!pending && !uploading && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            )}
          </button>
          <p
            style={{
              textAlign: "center",
              fontSize: 13,
              color: "var(--muted-foreground)",
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
