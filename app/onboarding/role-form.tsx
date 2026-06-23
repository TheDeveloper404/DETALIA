"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ROLE_MAINS,
  ROLE_MAIN_LABELS,
  SUBROLES,
  type RoleMain,
} from "@/server/domain/roles";

import { declareRoleAction, type DeclareRoleState } from "./actions";

const initialState: DeclareRoleState = { error: null };

// `select` native stilizat ca un Input shadcn (subrolul are opțiune goală → evităm Radix Select).
const selectClass =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

export function RoleForm() {
  const [state, formAction, pending] = useActionState(declareRoleAction, initialState);
  const [roleMain, setRoleMain] = useState<RoleMain | "">("");

  const subRoles = roleMain ? SUBROLES[roleMain] : [];

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="roleMain">Rolul tău</Label>
        <select
          id="roleMain"
          name="roleMain"
          required
          value={roleMain}
          onChange={(e) => setRoleMain(e.target.value as RoleMain)}
          className={selectClass}
        >
          <option value="" disabled>
            Alege rolul…
          </option>
          {ROLE_MAINS.map((r) => (
            <option key={r} value={r}>
              {ROLE_MAIN_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="subRole">
          Specializare <span className="font-normal text-muted-foreground">(opțional)</span>
        </Label>
        <select id="subRole" name="subRole" disabled={!roleMain} className={selectClass}>
          <option value="">Fără specializare</option>
          {subRoles.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="image">
          Poză de profil <span className="font-normal text-muted-foreground">(opțional)</span>
        </Label>
        <Input
          id="image"
          name="image"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          className="h-10"
        />
        <span className="text-xs text-muted-foreground">PNG, JPG, WebP sau AVIF · max 8 MB</span>
      </div>

      <Button type="submit" disabled={pending || !roleMain} className="h-10 w-full">
        {pending ? "Se salvează…" : "Continuă"}
      </Button>
    </form>
  );
}
