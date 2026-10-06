import Link from "next/link";
import { ArrowDown, ArrowRight, Check, MessageSquare, Pencil } from "lucide-react";
import { CookieConsent } from "@/components/cookie-consent";
import { DetailDemo, RoleDemo, WorkspaceDemo } from "./landing-demos";
import { PublicFooter, PublicHeader } from "./public-chrome";
import { TechnicalSheet } from "./technical-sheet";
import shared from "./public-pages.module.css";
import styles from "./landing-experience.module.css";

function SignupLink() {
  return (
    <Link href="/signup" className={shared.primaryLink}>
      Creează cont gratuit <ArrowRight size={18} aria-hidden="true" />
    </Link>
  );
}

export function LandingPage() {
  return (
    <div className={`${shared.publicPage} ${styles.landing}`}>
      <a className={shared.skipLink} href="#continut">
        Sari la conținut
      </a>
      <PublicHeader />
      <main id="continut">
        <section className={styles.heroSection} aria-labelledby="landing-title">
          <div className={styles.hero}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>
                Detalii de execuție
                <br />
                Perspective asumate
              </p>
              <h1 id="landing-title">Detaliile bune se construiesc împreună.</h1>
              <p className={styles.heroDescription}>
                Un desen poate lăsa loc de interpretare. Adu-l în fața celor care proiectează,
                execută, furnizează și folosesc construcția.
              </p>
              <div className={styles.heroActions}>
                <SignupLink />
                <a href="#cum-functioneaza" className={styles.exampleLink}>
                  Vezi un exemplu <ArrowDown size={18} aria-hidden="true" />
                </a>
              </div>
              <p className={styles.microcopy}>Fără parolă. Link de acces pe email.</p>
            </div>
            <div className={styles.heroSheet}>
              <TechnicalSheet />
            </div>
          </div>
          <div className={styles.heroBottom}>
            <span>
              <Pencil size={18} aria-hidden="true" /> Schițe direct pe detaliu
            </span>
            <span>
              <MessageSquare size={18} aria-hidden="true" /> Argumente, nu doar reacții
            </span>
            <span>
              <Check size={18} aria-hidden="true" /> Autor și rol la vedere
            </span>
          </div>
        </section>
        <section
          id="cum-functioneaza"
          className={styles.mechanism}
          aria-labelledby="mechanism-title"
        >
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>01 / Cum funcționează</p>
                <h2 id="mechanism-title">
                  Nu mai discuți
                  <br />
                  pe lângă desen.
                </h2>
              </div>
              <p>
                Ia un racord de terasă. Întrebarea e pe detaliu, propunerea vine într-o schiță, iar
                argumentele rămân lângă ea. Explorează cele trei etape.
              </p>
            </div>
            <DetailDemo />
            <div className={styles.sectionClosing}>
              <p>
                Detaliul nu se pierde printre mesaje. Fiecare schiță are un autor și un punct de
                plecare.
              </p>
              <Link href="/signup">
                Adu primul tău detaliu <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
        <section
          id="proiecte-planse"
          className={styles.privateSection}
          aria-labelledby="private-title"
        >
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>02 / Proiecte &amp; Planșe</p>
                <h2 id="private-title">
                  Deschizi discuția.
                  <br />
                  Tu alegi spațiul.
                </h2>
              </div>
              <p>
                Comunitatea nu este singurul loc în care lucrezi. Adu echipa într-un proiect privat
                sau pune-ți ideile în ordine pe propria planșă.
              </p>
            </div>
            <WorkspaceDemo />
            <p className={styles.privacyNote}>
              Nimic nu ajunge automat în comunitate. Publicarea unui detaliu este o alegere
              explicită.
            </p>
          </div>
        </section>
        <section className={styles.rolesSection} aria-labelledby="roles-title">
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>03 / Patru roluri. Același detaliu.</p>
                <h2 id="roles-title">
                  Schimbă perspectiva.
                  <br />
                  Vezi altă întrebare.
                </h2>
              </div>
              <p>
                Proiectul, montajul, materialul, utilizarea. Același racord poate ridica întrebări
                diferite. Alege un rol și vezi ce aduce în discuție.
              </p>
            </div>
            <RoleDemo />
            <div className={styles.principles}>
              <p>
                <strong>Poziții asumate.</strong> Vezi cine vorbește și din ce rol.
              </p>
              <p>
                <strong>Dezacord explicat.</strong> Dezaprobarea cere o justificare.
              </p>
              <p>
                <strong>Context păstrat.</strong> Schița rămâne legată de detaliu.
              </p>
            </div>
          </div>
        </section>
        <section className={styles.finalCta} aria-labelledby="final-title">
          <div className={styles.sectionInner}>
            <p className={styles.eyebrow}>Următoarea discuție poate începe cu tine</p>
            <h2 id="final-title">
              Ce detaliu ai vrea
              <br />
              să pui pe masă?
            </h2>
            <p>O întrebare, o schiță sau o perspectivă din șantier. Ai un loc de unde să începi.</p>
            <SignupLink />
            <p className={styles.finalLogin}>
              Ai deja cont? <Link href="/login">Autentifică-te</Link>
            </p>
          </div>
        </section>
      </main>
      <PublicFooter />
      <CookieConsent />
    </div>
  );
}
