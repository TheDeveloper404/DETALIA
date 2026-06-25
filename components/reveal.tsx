"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

// Reveal la scroll: copilul intră (fade + ridicare ușoară) când ajunge în vizor. `delay` permite
// cascadarea mai multor elemente. Stilul stă în globals.css (.dt-reveal); fără CSS, conținutul rămâne
// vizibil (degradare lină). prefers-reduced-motion e respectat tot din CSS.
export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`dt-reveal${shown ? " is-in" : ""}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
