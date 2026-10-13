"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

import styles from "./landing-experience.module.css";

export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const returningToTop = useRef(false);

  useEffect(() => {
    const updateVisibility = () => {
      if (window.scrollY <= 0) returningToTop.current = false;
      setVisible(returningToTop.current || window.scrollY > 400);
    };
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  function scrollToTop() {
    returningToTop.current = true;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, left: 0, behavior: reducedMotion ? "instant" : "smooth" });
  }

  return (
    <button
      type="button"
      className={styles.backToTop}
      hidden={!visible}
      aria-label="Înapoi sus"
      title="Înapoi sus"
      onClick={scrollToTop}
    >
      <ArrowUp size={20} aria-hidden="true" />
    </button>
  );
}
