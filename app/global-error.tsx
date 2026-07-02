"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Ultima plasă de siguranță: prinde erorile din ROOT layout (unde `app/error.tsx` nu mai ajunge).
// Înlocuiește layout-ul → trebuie să randeze propriul <html>/<body>, fără a depinde de fonturi/header.
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ro">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#faf8f4", color: "#211d18" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Ceva n-a mers</h1>
          <p style={{ color: "#5d564c", maxWidth: 420, margin: 0 }}>
            A apărut o eroare neașteptată. Reîncarcă pagina — dacă persistă, revino mai târziu.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              border: "1px solid #95492e",
              background: "#a9573a",
              color: "#fff",
              borderRadius: 8,
              padding: "10px 22px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reîncearcă
          </button>
        </div>
      </body>
    </html>
  );
}
