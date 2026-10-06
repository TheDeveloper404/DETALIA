import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { AnimatedAuthDrawing } from "@/components/public-pages/animated-auth-drawing";
import experience from "@/components/public-pages/auth-experience.module.css";
import styles from "@/components/public-pages/public-pages.module.css";

export function AuthShell({
  mode,
  children,
  presentation = "default",
}: {
  mode: "login" | "signup";
  children: ReactNode;
  presentation?: "default" | "entry";
}) {
  const isEntry = presentation === "entry";
  return (
    <div className={`${styles.publicPage} ${styles.authPage} ${isEntry ? styles.authEntry : ""}`}>
      <a className={styles.skipLink} href="#formular">
        Sari la formular
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <BrandLogo size={38} />
          <Link href="/" className={styles.backLink}>
            <ArrowLeft size={16} aria-hidden="true" /> Înapoi la site
          </Link>
        </div>
      </header>
      {isEntry ? (
        <main className={experience.splitMain}>
          <aside className={experience.drawingColumn} aria-label="Desen tehnic ilustrativ">
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
      <footer className={styles.authFooter}>
        <Link href="/termeni">Termeni și condiții</Link>
        <Link href="/confidentialitate">Confidențialitate</Link>
        <a href="mailto:support@detalia.ro">Suport</a>
      </footer>
    </div>
  );
}
