"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./landing-experience.module.css";

/** Decorul se așază o singură dată; conținutul rămâne accesibil și fără JavaScript. */
export function FinalCtaScene({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const node = stageRef.current;
    if (
      !node ||
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setEntered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={stageRef}
      className={`${styles.sectionInner} ${styles.finalStage}`}
      data-entered={entered}
    >
      <div className={styles.finalScene} aria-hidden="true">
        <svg className={styles.finalTable} viewBox="0 0 1400 660" fill="none">
          <path
            className={styles.finalTableOutline}
            pathLength="1"
            d="M-80 450 700 170 1480 450 700 730Z M-80 474 700 754 1480 474 M140 532v68 M1260 532v68"
          />
          <path d="M92 410h48m-24-24v48 M1260 410h48m-24-24v48 M676 630h48m-24-24v48" />
          <path d="m210 458 210 76m560 0 210-76" strokeDasharray="4 8" />
        </svg>
        <div className={`${styles.finalSheetArrival} ${styles.finalSheetLeft}`}>
          <div className={styles.finalSheet}>
            <Image
              src="/landing/gate-detail.jpg"
              alt=""
              width={1281}
              height={771}
              sizes="(max-width: 600px) 180px, (max-width: 1200px) 260px, 360px"
            />
            <div className={styles.finalSheetStamp}>
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
        <div className={`${styles.finalSheetArrival} ${styles.finalSheetRight}`}>
          <div className={styles.finalSheet}>
            <Image
              src="/landing/roof-ridge-detail.jpg"
              alt=""
              width={1749}
              height={841}
              sizes="(max-width: 600px) 180px, (max-width: 1200px) 260px, 360px"
            />
            <div className={styles.finalSheetStamp}>
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
      <div className={styles.finalCopy}>{children}</div>
    </div>
  );
}
