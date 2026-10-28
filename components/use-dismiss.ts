"use client";
import { useEffect, type RefObject } from "react";

// Regula comuna pentru meniuri: un meniu deschis se inchide la click oriunde in afara lui (inclusiv pe
// alt meniu) sau la Escape — doua meniuri nu raman deschise unul peste altul.
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, onClose]);
}
