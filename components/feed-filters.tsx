"use client";
import { startTransition, useOptimistic } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ROLE_MAIN_LABELS } from "@/server/domain/roles";

export function FeedFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Bifa apare imediat; URL-ul real se actualizeaza abia dupa randarea pe server.
  const [params, setParams] = useOptimistic<URLSearchParams>(searchParams);
  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => {
      setParams(next);
      router.push("/feed?" + next.toString(), { scroll: false });
    });
  }
  return (
    <fieldset className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
      <legend className="sr-only">Filtre avansate</legend>
      <label className="flex items-center gap-2 text-sm">
        Rol autor
        <select
          aria-label="Rol autor"
          value={params.get("role") ?? ""}
          onChange={(e) => change("role", e.target.value)}
          className="min-h-11 rounded-lg border border-border bg-background px-2"
        >
          <option value="">Toate rolurile</option>
          {Object.entries(ROLE_MAIN_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={params.get("verified") === "1"}
          onChange={(e) => change("verified", e.target.checked ? "1" : "")}
        />
        Autor verificat
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={params.get("sketches") === "1"}
          onChange={(e) => change("sketches", e.target.checked ? "1" : "")}
        />
        Cu schițe
      </label>
    </fieldset>
  );
}
