import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { userHasRole } from "@/server/services/roleService";

import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  // Cine are deja rol nu mai trece prin onboarding → direct în feed.
  if (await userHasRole(session.user.id)) {
    redirect("/feed");
  }

  const email = session.user.email ?? "";

  return (
    <div
      className="dt-onb-page"
      style={{
        fontFamily: "var(--font-archivo), sans-serif",
        color: "#211d18",
        background: "#faf8f4",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* HEADER */}
      <header
        style={{
          height: 64,
          flex: "none",
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid #e3ddd2",
          background: "#faf8f4",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          style={{
            maxWidth: "var(--container-max)",
            margin: "0 auto",
            width: "100%",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- asset SVG static de brand */}
            <img src="/logo.svg" alt="DETALIA" style={{ height: 26, width: "auto", display: "block" }} />
          </span>
          {email && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "var(--font-plex-mono), monospace",
                fontSize: 12,
                color: "#8a8073",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#2f6b3f",
                  display: "inline-block",
                }}
              />
              Conectat ca {email}
            </span>
          )}
        </div>
      </header>

      {/* BODY */}
      <main
        style={{
          position: "relative",
          flex: 1,
          display: "flex",
          justifyContent: "center",
          padding: "52px 24px 72px",
        }}
      >
        {/* blueprint background — același limbaj vizual ca login-ul */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(#eae0cf 1px,transparent 1px),linear-gradient(90deg,#eae0cf 1px,transparent 1px)",
            backgroundSize: "34px 34px",
            opacity: 0.6,
            pointerEvents: "none",
            zIndex: 0,
            WebkitMaskImage: "radial-gradient(120% 80% at 50% 0%,#000 0%,transparent 70%)",
            maskImage: "radial-gradient(120% 80% at 50% 0%,#000 0%,transparent 70%)",
          }}
        />

        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 720 }}>
          {/* TITLE BLOCK */}
          <div style={{ textAlign: "center", marginBottom: 26 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                fontFamily: "var(--font-plex-mono), monospace",
                fontSize: 11.5,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#a9573a",
                marginBottom: 16,
              }}
            >
              <span style={{ width: 6, height: 6, background: "#a9573a", transform: "rotate(45deg)", display: "inline-block" }} />
              Hai să-ți facem profilul
            </div>
            <h1 style={{ fontWeight: 700, fontSize: 34, lineHeight: 1.12, letterSpacing: "-0.02em", margin: "0 0 10px", color: "#211d18" }}>
              Bun venit în DETALIA
            </h1>
            <p style={{ fontSize: 16, color: "#5d564c", lineHeight: 1.5, margin: "0 auto", maxWidth: "46ch" }}>
              Spune-ne cine ești — rolul tău apare lângă nume de fiecare dată când publici sau validezi.
            </p>
          </div>

          <OnboardingForm />
        </div>
      </main>
    </div>
  );
}
