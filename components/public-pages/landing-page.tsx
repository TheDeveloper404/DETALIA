import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowRight, Check, Layers, MessageSquare, Pencil, Users } from "lucide-react";
import { AvatarInitials } from "@/components/avatar-initials";
import { CookieConsent } from "@/components/cookie-consent";
import { RolePill } from "@/components/role-pill";
import { DetailDemo, RoleDemo, WorkspaceDemo } from "./landing-demos";
import { FinalCtaScene } from "./final-cta-scene";
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
            <section className={styles.principles} aria-labelledby="principles-title">
              <div className={styles.principlesIntro}>
                <p className={styles.eyebrow}>Cum citești o contribuție</p>
                <h3 id="principles-title">Vezi cine spune, de ce spune și la ce se referă.</h3>
                <p>Trei repere fac discuția ușor de urmărit, indiferent de rolul ales mai sus.</p>
              </div>
              <ol className={styles.principleList}>
                <li>
                  <div className={styles.principleExample}>
                    <div className={styles.principleAuthor}>
                      <AvatarInitials name="Andrei Popa" size={38} />
                      <div>
                        <strong>Andrei Popa</strong>
                        <RolePill roleMain="EXECUTANT" subRole="Executant" verified={false} />
                      </div>
                    </div>
                    <p>„Ce trebuie clarificat înainte de montaj?”</p>
                  </div>
                  <h4>
                    <Users size={18} aria-hidden="true" /> Poziții asumate
                  </h4>
                  <p>
                    Numele și meseria însoțesc contribuția. Înțelegi din ce experiență vine
                    întrebarea și poți judeca argumentul în context.
                  </p>
                </li>
                <li>
                  <div className={styles.principleExample}>
                    <span className={styles.principleLabel}>Dezaprob · cu justificare</span>
                    <blockquote>
                      „Nu este clar cum se fixează această piesă. Aș arăta racordul într-o schiță.”
                    </blockquote>
                  </div>
                  <h4>
                    <MessageSquare size={18} aria-hidden="true" /> Dezacord explicat
                  </h4>
                  <p>
                    Dezaprobarea vine cu o explicație scrisă sau cu o schiță publicată. Ceilalți văd
                    obiecția și pot răspunde la ea.
                  </p>
                </li>
                <li>
                  <div className={styles.principleExample}>
                    <div className={styles.contextStack}>
                      <Image
                        src="/landing/terrace-detail.webp"
                        alt="Detaliul inițial al racordului terasă–atic"
                        width={180}
                        height={120}
                        sizes="180px"
                      />
                      <Image
                        src="/landing/terrace-sketch.webp"
                        alt="Schiță ilustrativă peste același racord"
                        width={180}
                        height={120}
                        sizes="180px"
                      />
                    </div>
                    <span className={styles.principleLabel}>Detaliu inițial → schiță</span>
                  </div>
                  <h4>
                    <Layers size={18} aria-hidden="true" /> Context păstrat
                  </h4>
                  <p>
                    Schița se publică peste detaliul de la care a pornit. Poți reveni la desenul
                    inițial și urmări contribuțiile în același teanc.
                  </p>
                </li>
              </ol>
              <p className={styles.principlesNote}>
                Exemple ilustrative, cu persoane și texte fictive.
              </p>
            </section>
          </div>
        </section>
        <section className={styles.finalCta} aria-labelledby="final-title">
          <FinalCtaScene>
            <p className={styles.eyebrow}>Următoarea discuție poate începe cu tine</p>
            <h2 id="final-title">
              Ce detaliu ai vrea
              <br />
              să pui pe masă?
            </h2>
            <p>O întrebare, o schiță sau o perspectivă din șantier. Ai un loc de unde să începi.</p>
            <div className={styles.finalAction}>
              <SignupLink />
            </div>
            <p className={styles.finalLogin}>
              Ai deja cont? <Link href="/login">Autentifică-te</Link>
            </p>
          </FinalCtaScene>
        </section>
      </main>
      <PublicFooter />
      <CookieConsent />
    </div>
  );
}
