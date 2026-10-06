import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";

import shared from "./public-pages.module.css";
import styles from "./landing-experience.module.css";

// Header + footer publice (landing, ghid) — o singură sursă, ca paginile să arate identic.
export const LINKEDIN_URL = "https://www.linkedin.com/company/144903896/";
export const GITHUB_URL = "https://github.com/TheDeveloper404/DETALIA";

// lucide-react 1.x nu mai include logo-uri de brand → path-urile oficiale (Simple Icons, CC0).
function LinkedInIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function GitHubIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

// Sub 1000 px Ghid + rețelele rămân doar în footer, ca să încapă butoanele de cont.
export function PublicHeader() {
  const compact = ` ${styles.hideOnMobile}`;
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <BrandLogo size={44} />
        <nav className={styles.headerActions} aria-label="Navigație principală">
          {/* Ghid | Autentificare Creează cont | LinkedIn GitHub */}
          <Link href="/ghid" className={`${styles.headerLink}${compact}`}>
            Ghid
          </Link>
          <span className={`${styles.headerDivider}${compact}`} aria-hidden="true" />
          <div className={styles.headerGroup}>
            <Link href="/login" className={styles.headerLogin}>
              Autentificare
            </Link>
            <Link href="/signup" className={`${shared.primaryLink} ${styles.headerCta}`}>
              Creează cont gratuit
            </Link>
          </div>
          <span className={`${styles.headerDivider}${compact}`} aria-hidden="true" />
          <div className={`${styles.headerSocial}${compact}`}>
            <a
              href={LINKEDIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="DETALIA pe LinkedIn"
              className={styles.socialLink}
            >
              <LinkedInIcon />
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="DETALIA pe GitHub"
              className={styles.socialLink}
            >
              <GitHubIcon />
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <BrandLogo size={44} />
          <span>Detalii de execuție. Perspective asumate.</span>
        </div>
        <nav aria-label="Informații și suport">
          <Link href="/ghid">Ghid</Link>
          <Link href="/termeni">Termeni și condiții</Link>
          <Link href="/confidentialitate">Confidențialitate</Link>
          <a href="mailto:support@detalia.ro">Suport</a>
          <a
            href={LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.footerSocial}
          >
            <LinkedInIcon size={18} /> LinkedIn
          </a>
        </nav>
      </div>
    </footer>
  );
}
