import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { AnimatedAuthDrawing } from "@/components/public-pages/animated-auth-drawing";
import experience from "@/components/public-pages/auth-experience.module.css";
import landing from "@/components/public-pages/landing-experience.module.css";
import styles from "@/components/public-pages/public-pages.module.css";

export function AuthShell({
  mode,
  children,
  presentation = "default",
  showDrawing = true,
  hideDrawingOnMobile = false,
}: {
  mode: "login" | "signup";
  children: ReactNode;
  presentation?: "default" | "entry" | "centered";
  showDrawing?: boolean;
  hideDrawingOnMobile?: boolean;
}) {
  const isEntry = presentation === "entry";
  // `centered`: pagina de după click pe magic link („Te conectăm…”) — același header/culori ca
  // login/signup, conținutul pe mijloc, fără desenul animat.
  const isCentered = presentation === "centered";
  const branded = isEntry || isCentered;
  return (
    <div
      className={`${styles.publicPage} ${styles.authPage} ${isEntry ? styles.authEntry : ""} ${branded ? landing.landing : ""}`}
    >
      <a className={styles.skipLink} href="#formular">
        Sari la formular
      </a>
      {/* Login/signup/confirmări: același header ca landing-ul (poziționare, logo, fundal). */}
      <header className={branded ? landing.header : styles.header}>
        <div className={branded ? landing.headerInner : styles.headerInner}>
          <BrandLogo size={branded ? 44 : 38} />
          <Link href="/" className={styles.backLink}>
            <ArrowLeft size={16} aria-hidden="true" /> Înapoi la site
          </Link>
        </div>
      </header>
      {isCentered ? (
        <main id="formular" className={experience.centeredMain}>
          <div className={experience.centeredContent}>{children}</div>
        </main>
      ) : isEntry ? (
        <main className={showDrawing ? experience.splitMain : experience.formOnlyMain}>
          {showDrawing && (
            <aside
              className={`${experience.drawingColumn} ${hideDrawingOnMobile ? experience.drawingDesktopOnly : ""}`}
              aria-label="Desen tehnic ilustrativ"
            >
              <div className={experience.drawingHeading}>
                <p className={experience.drawingEyebrow}>DETALIU / RACORD FEREASTRĂ</p>
                <p className={experience.drawingTitle}>Desenul este punctul de întâlnire.</p>
              </div>
              <AnimatedAuthDrawing />
              <p className={experience.drawingMessage}>
                {mode === "signup"
                  ? "O perspectivă în plus poate deschide o discuție bună."
                  : "Detaliile tale și discuțiile lor te așteaptă."}
              </p>
            </aside>
          )}
          <div id="formular" tabIndex={-1} className={experience.formColumn}>
            <div className={styles.authContent}>{children}</div>
          </div>
        </main>
      ) : (
        <main id="formular" className={styles.authMain}>
          <div className={styles.authDrawing} aria-hidden="true">
            <p className={styles.eyebrow}>
              DETALIU — ȘARPANTĂ
              <br />
              DESENUL ESTE PUNCTUL DE ÎNTÂLNIRE
            </p>
            <Image
              src="/landing/hero-detail.png"
              alt=""
              width={1540}
              height={1025}
              sizes="(max-width: 760px) 1px, 740px"
            />
            <p>
              {mode === "signup"
                ? "O perspectivă în plus poate deschide o discuție bună."
                : "Detaliile tale și discuțiile lor te așteaptă."}
            </p>
          </div>
          <div className={styles.authContent}>{children}</div>
        </main>
      )}
      {!branded && (
        <footer className={styles.authFooter}>
          <Link href="/termeni">Termeni și condiții</Link>
          <Link href="/confidentialitate">Confidențialitate</Link>
          <a href="mailto:support@detalia.ro">Suport</a>
        </footer>
      )}
    </div>
  );
}
