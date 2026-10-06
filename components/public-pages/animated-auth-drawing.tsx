"use client";

import { useId, useState } from "react";
import { Pause, Play } from "lucide-react";

import styles from "@/components/public-pages/auth-experience.module.css";

// Desen schematic decorativ, nu detaliu de execuție sau soluție tehnică validată.
const CONTOURS = [
  "M286 278H434V472H286Z M434 278H470V472H434",
  "M160 251L330 218H346V236L170 268H160Z M170 268V280H160V251",
  "M434 218H570V240H552V252H434Z",
  "M346 60V155 M388 60V155 M356 60V155 M378 60V155",
];
const PROFILES = [
  "M334 155H348V168H388V155H402V218H434V278H286V266H334Z",
  "M348 168H388V205H348Z M348 215H388V255H348Z",
  "M334 180H344V205H334 M392 180H402V205H392Z",
  "M334 218H342V255H334 M396 218H412V262H396Z",
  "M286 278V290H434 M302 290V472 M416 290V472",
  "M306 350H412 M306 362H412 M306 422H412 M306 434H412",
  "M434 252H552 M448 278V472 M460 278V472",
  "M352 151H382V161H352Z",
];
const DIMENSIONS = [
  "M132 251H152 M132 472H278 M140 240V484 M134 257L146 245 M134 478L146 466",
  "M160 205V190 M330 205V190 M148 196H342 M154 202L166 190 M324 202L336 190",
  "M434 205V180 M570 205V180 M422 186H582 M428 192L440 180 M564 192L576 180",
  "M286 488V514 M470 488V514 M274 506H482 M280 512L292 500 M464 512L476 500",
];
const HATCHES = Array.from({ length: 32 }, (_, index) => {
  const x = 96 + index * 16;
  return `M${x} 484l260-260`;
});

export function AnimatedAuthDrawing() {
  const id = useId();
  const [paused, setPaused] = useState(false);
  const diagramId = `${id}-diagram`;
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const hatchId = `${id}-hatch`;

  return (
    <div className={styles.drawing} data-paused={paused}>
      <svg
        id={diagramId}
        className={styles.diagram}
        viewBox="0 0 720 550"
        role="img"
        aria-labelledby={`${titleId} ${descriptionId}`}
      >
        <title id={titleId}>Desen schematic animat — racord de fereastră</title>
        <desc id={descriptionId}>
          Secțiune 2D cu profil de fereastră, glafuri și straturile peretelui. Conturul, hașurile,
          cotele fără valori și marcajul racordului se trasează succesiv. Exemplu ilustrativ, nu
          soluție tehnică de execuție.
        </desc>
        <defs>
          <clipPath id={hatchId}>
            <path d="M286 290H302V472H286Z M306 292H412V346H306Z M306 366H412V418H306Z M306 438H412V472H306Z M416 290H434V472H416Z M448 278H460V472H448Z M160 251L330 218H334V230L170 263H160Z M434 218H570V240H552V245H434Z" />
          </clipPath>
        </defs>
        <g className={styles.guideLines} aria-hidden="true">
          <path d="M80 278H640 M366 32V522" />
          <path d="M80 32h20M80 32v20 M640 32h-20M640 32v20 M80 522h20M80 522v-20 M640 522h-20M640 522v-20" />
        </g>
        <g className={styles.contours}>
          {CONTOURS.map((d) => (
            <path key={d} d={d} pathLength={1} className={styles.line} />
          ))}
        </g>
        <g className={styles.profiles}>
          {PROFILES.map((d) => (
            <path key={d} d={d} pathLength={1} className={styles.line} />
          ))}
        </g>
        <g className={styles.hatches} clipPath={`url(#${hatchId})`}>
          {HATCHES.map((d) => (
            <path key={d} d={d} pathLength={1} className={styles.line} />
          ))}
        </g>
        <g className={styles.dimensions}>
          {DIMENSIONS.map((d) => (
            <path key={d} d={d} pathLength={1} className={styles.line} />
          ))}
        </g>
        <g className={styles.joint}>
          <circle cx="421" cy="267" r="28" pathLength={1} className={styles.line} />
          <path d="M446 254l48-35h88" pathLength={1} className={styles.line} />
          <circle className={styles.jointPoint} cx="421" cy="267" r="4" />
        </g>
      </svg>
      <div className={styles.drawingToolbar}>
        <p className={styles.drawingCaption}>Exemplu schematic · nu detaliu de execuție</p>
        <button
          type="button"
          className={styles.motionControl}
          aria-controls={diagramId}
          onClick={() => setPaused((current) => !current)}
        >
          {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
          {paused ? "Reia animația" : "Pauză animație"}
        </button>
        <span className={styles.reducedMotionCaption}>Desen fără animație</span>
      </div>
      <ol className={styles.drawingStages} aria-label="Ordinea trasării desenului">
        <li>
          <span>01</span> Contur
        </li>
        <li>
          <span>02</span> Hașuri
        </li>
        <li>
          <span>03</span> Cote
        </li>
        <li>
          <span>04</span> Racord
        </li>
      </ol>
    </div>
  );
}
