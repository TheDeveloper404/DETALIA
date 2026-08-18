"use client";

import { Hand } from "lucide-react";
import { useActionState } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import { RolePill } from "@/components/role-pill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SupplierOfferRow } from "@/server/repos/supplierOffersRepo";

import { toggleSupplierOfferAction, type SupplierOfferState } from "./supplier-offer-actions";

// Buton „ridic mâna" Furnizor — DOAR pe detaliu (nu per-schiță, materialele țin de detaliul de bază).
// Randat lângă „Schițează" (2026-08-18, raportat) — separat de `SupplierOfferPanel` (lista publică),
// care rămâne unde era; doar acțiunea (toggle-ul) s-a mutat.
export function SupplierOfferButton({
  detailId,
  isOffering,
}: {
  detailId: string;
  isOffering: boolean;
}) {
  const initialState: SupplierOfferState = { error: null, offering: isOffering };
  const [state, formAction, pending] = useActionState(toggleSupplierOfferAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="detailId" value={detailId} />
      <Button
        type="submit"
        size="sm"
        variant={state.offering ? "default" : "outline"}
        disabled={pending}
        className={cn(
          "gap-1.5 shadow-md",
          state.offering && "border-primary bg-primary text-primary-foreground",
        )}
      >
        <Hand className="size-4" strokeWidth={2} />
        {state.offering ? "Nu mai pot oferta" : "Pot să ofertez materiale"}
      </Button>
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}

// Lista publică a furnizorilor care pot oferta materiale pe acest detaliu — vizibilă TUTUROR (nu doar
// furnizorilor), dacă există măcar unul. Acțiunea de ofertat (butonul) s-a mutat în `SupplierOfferButton`.
export function SupplierOfferPanel({ offers }: { offers: SupplierOfferRow[] }) {
  if (offers.length === 0) return null;

  return (
    <section className="mt-4 border-t border-[#eee6da] pt-4">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-[#a59a88]">
        {offers.length} {offers.length === 1 ? "furnizor poate" : "furnizori pot"} oferta materiale
      </p>
      <ul className="flex flex-col gap-2">
        {offers.map((o) => (
          <li key={o.userId} className="flex items-center gap-2">
            <AvatarInitials name={o.userName} imageUrl={o.userImage} size={26} />
            <span className="truncate text-sm font-semibold">{o.userName ?? "Anonim"}</span>
            <RolePill roleMain={o.roleMain} subRole={o.subRole} verified={o.verification === "VERIFIED"} />
          </li>
        ))}
      </ul>
    </section>
  );
}
