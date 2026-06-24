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

import {
  type ProfileFormState,
  signOutAction,
  updateAvatarAction,
  updateCoverAction,
  updateRoleAction,
} from "./actions";

// Starea inițială a formularelor — definită aici (client), NU în „use server" (care exportă doar funcții async).
const initialProfileState: ProfileFormState = { error: null, ok: false };

type VerificationStatus = "DECLARED" | "PENDING" | "VERIFIED" | "REJECTED";

// `select` native stilizat ca un Input shadcn (subrolul are opțiune goală → evităm Radix Select).
const selectClass =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

function Feedback({ error, ok, okText }: { error: string | null; ok: boolean; okText: string }) {
  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {error}
      </p>
    );
  }
  if (ok) {
    return (
      <p
        role="status"
        className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
      >
        {okText}
      </p>
    );
  }
  return null;
}

export function AvatarForm() {
  const [state, formAction, pending] = useActionState(updateAvatarAction, initialProfileState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Feedback error={state.error} ok={state.ok} okText="Poza a fost actualizată." />
      <Input
        name="image"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        required
        className="h-10"
      />
      <span className="text-xs text-muted-foreground">PNG, JPG, WebP sau AVIF · max 8 MB</span>
      <Button type="submit" disabled={pending} className="h-10 self-start">
        {pending ? "Se încarcă…" : "Schimbă poza"}
      </Button>
    </form>
  );
}

export function CoverForm() {
  const [state, formAction, pending] = useActionState(updateCoverAction, initialProfileState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Feedback error={state.error} ok={state.ok} okText="Imaginea de cover a fost actualizată." />
      <Input
        name="cover"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        required
        className="h-10"
      />
      <span className="text-xs text-muted-foreground">
        Banda de sus a profilului · PNG, JPG, WebP sau AVIF · max 8 MB
      </span>
      <Button type="submit" disabled={pending} className="h-10 self-start">
        {pending ? "Se încarcă…" : "Schimbă coperta"}
      </Button>
    </form>
  );
}

export function EditRoleForm({
  initialRoleMain,
  initialSubRole,
}: {
  initialRoleMain: string;
  initialSubRole: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateRoleAction, initialProfileState);
  const [roleMain, setRoleMain] = useState<RoleMain | "">(
    (initialRoleMain as RoleMain) || "",
  );

  const subRoles = roleMain ? SUBROLES[roleMain] : [];
  // Păstrăm subrolul inițial doar cât timp rolul principal nu s-a schimbat.
  const subRoleDefault = roleMain === initialRoleMain ? (initialSubRole ?? "") : "";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Feedback error={state.error} ok={state.ok} okText="Rolul a fost actualizat." />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="roleMain">Rol principal</Label>
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
        <select
          key={roleMain}
          id="subRole"
          name="subRole"
          defaultValue={subRoleDefault}
          disabled={!roleMain}
          className={selectClass}
        >
          <option value="">Fără specializare</option>
          {subRoles.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" disabled={pending || !roleMain} className="h-10 self-start">
        {pending ? "Se salvează…" : "Salvează rolul"}
      </Button>
    </form>
  );
}

export function VerificationSection({ status }: { status: VerificationStatus }) {
  if (status === "VERIFIED") {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span className="text-amber-500">★</span>
        Rolul tău este verificat.
      </p>
    );
  }

  // MVP: verificarea pe bază de dovadă (OAR/CUI → aprobare) e pe HOLD până definim o metodă
  // sigură, cu frecare mică. Nu expunem un buton care duce într-un PENDING fără ieșire.
  // Rolul declarat rămâne funcțional 100%. (Re-activare: readuci formularul de cerere de verificare.)
  return (
    <p className="text-sm text-muted-foreground">
      Verificarea rolului va fi disponibilă în curând. Până atunci, rolul declarat este
      funcțional integral.
    </p>
  );
}

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="outline">
        Deconectare
      </Button>
    </form>
  );
}
