// Ecran „site în lucru" — afișat când LOCKDOWN e activ (gate global în proxy, rewrite la /maintenance).
// Paletă de brand (bej cald + teracotta), consistent cu landing-ul. Server component (fără interactivitate).
const SANS = "var(--font-archivo), sans-serif";
const MONO = "var(--font-plex-mono), monospace";

export function MaintenanceScreen({ message, date }: { message?: string | null; date?: string | null }) {
  const dateLabel = date
    ? new Date(date).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;
  return (
    <div
      style={{
        fontFamily: SANS,
        color: "#211d18",
        background: "#faf8f4",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "40px 24px",
        gap: 18,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- asset SVG static de brand */}
      <img src="/logo.svg" alt="DETALIA" style={{ height: 38, width: "auto" }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontFamily: MONO,
          fontSize: 12,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "#a9573a",
        }}
      >
        <span style={{ width: 6, height: 6, background: "#a9573a", transform: "rotate(45deg)", display: "inline-block" }} />
        Mentenanță
      </div>
      <h1
        style={{
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: "clamp(26px, 4.2vw, 36px)",
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          margin: 0,
          maxWidth: "16ch",
        }}
      >
        Site în lucru
      </h1>
      <p style={{ fontSize: 17, lineHeight: 1.6, color: "#5d564c", margin: 0, maxWidth: "46ch" }}>
        {message || "Lucrăm la platformă chiar acum. Revenim în scurt timp."}
      </p>
      {dateLabel && (
        <p style={{ fontFamily: MONO, fontSize: 13, color: "#8a8073", margin: 0, letterSpacing: "0.02em" }}>
          Estimat: {dateLabel}
        </p>
      )}
    </div>
  );
}
