"use client";

// Autocomplete pentru „Locație" — înlocuiește input+datalist nativ (Chromium arăta lista ÎNTREAGĂ
// (~200 orașe) pe click, cât tot ecranul, înainte să scrii ceva). Aici: nimic nu apare până nu tastezi,
// apoi o listă scurtă filtrată sub câmp. Rămâne text liber (nu validăm ca enum pe server) — userul poate
// scrie și o comună care nu e în listă; sugestiile sunt doar UX.
import { useEffect, useRef, useState } from "react";

import { RO_CITIES } from "@/lib/ro-cities";

const MAX_SUGGESTIONS = 8;

export function CityAutocomplete({
  id,
  name,
  defaultValue = "",
  placeholder,
  maxLength,
  className,
  style,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const q = value.trim().toLowerCase();
  const suggestions =
    q.length === 0
      ? []
      : RO_CITIES.filter((c) => c.toLowerCase().includes(q)).slice(0, MAX_SUGGESTIONS);

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        name={name}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        className={className}
        style={style}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (q.length > 0) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-lg border border-border bg-card py-1 shadow-lg">
          {suggestions.map((city) => (
            <li key={city}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-secondary"
                onClick={() => {
                  setValue(city);
                  setOpen(false);
                }}
              >
                {city}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
