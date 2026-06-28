"use client";

import { useRef, useState } from "react";

import { saveCoverPosition } from "@/app/(app)/profile/actions";

// Banner-ul de cover din capul paginii de editare — repoziționare LinkedIn-style: tragi imaginea
// direct sus/jos chiar în banner, iar la eliberare poziția se salvează (object-position Y, 0..100).
export function EditCoverBand({
  cover,
  position,
}: {
  cover: string | null;
  position: number;
}) {
  const [pos, setPos] = useState(position);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startPos: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    if (!cover) return;
    drag.current = { startY: e.clientY, startPos: pos };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const h = ref.current?.offsetHeight ?? 120;
    // Tragi în jos → vezi partea de sus a imaginii → object-position scade.
    const delta = ((e.clientY - drag.current.startY) / h) * 100;
    setPos(Math.round(Math.min(100, Math.max(0, drag.current.startPos - delta))));
  }
  function onPointerUp() {
    if (!drag.current) return;
    drag.current = null;
    void saveCoverPosition(pos);
  }

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`relative h-[120px] bg-gradient-to-br from-secondary to-[#ece1d3] ${
        cover ? "cursor-grab touch-none active:cursor-grabbing" : ""
      }`}
    >
      {cover && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- repoziționare live; nu e asset optimizabil */}
          <img
            src={cover}
            alt=""
            draggable={false}
            className="absolute inset-0 size-full select-none object-cover"
            style={{ objectPosition: `50% ${pos}%` }}
          />
          <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10.5px] text-white">
            trage sus/jos pentru a repoziționa
          </span>
        </>
      )}
    </div>
  );
}
