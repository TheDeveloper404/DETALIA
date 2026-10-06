import Image from "next/image";
import { UserRound } from "lucide-react";

import { RolePill } from "@/components/role-pill";

import styles from "./public-pages.module.css";

// Demonstrație ilustrativă, nu o validare sau o recomandare de proiectare.
export function TechnicalSheet() {
  return (
    <figure className={styles.technicalSheet} aria-labelledby="detail-example-caption">
      <div className={styles.sheetLabel}>
        <span>DETALIU 01 — ȘARPANTĂ</span>
        <span>ÎNTREBARE → PERSPECTIVE</span>
      </div>
      <Image
        src="/landing/editorial-detail.webp"
        alt="Detaliu ilustrativ de șarpantă: o îmbinare este încercuită, cu întrebarea «Cum se rezolvă îmbinarea?»"
        width={1000}
        height={966}
        sizes="(max-width: 760px) 100vw, (max-width: 1100px) 55vw, 720px"
        preload
        className={styles.sheetDrawing}
      />
      <div className={`${styles.sheetObservation} ${styles.beneficiaryObservation}`}>
        <div className={styles.observationAuthor}>
          <UserRound size={16} aria-hidden="true" />
          <span>Perspectivă de beneficiar</span>
        </div>
        <RolePill roleMain="BENEFICIAR" subRole="Beneficiar" verified={false} />
        <p>Ce trebuie clarificat înainte să ajungă acest detaliu în șantier?</p>
      </div>
      <div className={`${styles.sheetObservation} ${styles.executorObservation}`}>
        <div className={styles.observationAuthor}>
          <UserRound size={16} aria-hidden="true" />
          <span>Perspectivă de executant</span>
        </div>
        <RolePill roleMain="EXECUTANT" subRole="Executant" verified={false} />
        <p>Aș arăta pe o schiță cum se face această îmbinare, pas cu pas.</p>
      </div>
      <figcaption id="detail-example-caption" className={styles.sheetCaption}>
        Exemplu ilustrativ · desen, schiță și observații în același context.
      </figcaption>
    </figure>
  );
}
