"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { type ProfileFormState, signOutAction, updateProfileDetailsAction } from "./actions";

// Starea inițială a formularelor — definită aici (client), NU în „use server" (care exportă doar funcții async).
const initialProfileState: ProfileFormState = { error: null, ok: false };

type VerificationStatus = "DECLARED" | "PENDING" | "VERIFIED" | "REJECTED";

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

// Editarea datelor de profil (nume, headline, about, locație, website). Rolul NU se editează aici (e definitiv).
export function EditDetailsForm({
  initialName,
  initialHeadline,
  initialAbout,
  initialLocation,
  initialWebsite,
}: {
  initialName: string | null;
  initialHeadline: string | null;
  initialAbout: string | null;
  initialLocation: string | null;
  initialWebsite: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    updateProfileDetailsAction,
    initialProfileState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Feedback error={state.error} ok={state.ok} okText="Profilul a fost actualizat." />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Nume afișat</Label>
        <Input id="name" name="name" required maxLength={100} defaultValue={initialName ?? ""} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="headline">
          Titlu/headline <span className="font-normal text-muted-foreground">(opțional)</span>
        </Label>
        <Input
          id="headline"
          name="headline"
          maxLength={120}
          placeholder="ex: Arhitect · birou propriu"
          defaultValue={initialHeadline ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="about">
          Despre <span className="font-normal text-muted-foreground">(opțional)</span>
        </Label>
        <Textarea
          id="about"
          name="about"
          maxLength={1000}
          rows={4}
          placeholder="Câteva rânduri despre tine, experiența și domeniile în care lucrezi."
          defaultValue={initialAbout ?? ""}
        />
        <span className="text-xs text-muted-foreground">Apare pe profilul tău public, sub date.</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location">
            Locație <span className="font-normal text-muted-foreground">(opțional)</span>
          </Label>
          <Input
            id="location"
            name="location"
            maxLength={120}
            placeholder="ex: Cluj-Napoca"
            defaultValue={initialLocation ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="website">
            Website <span className="font-normal text-muted-foreground">(opțional)</span>
          </Label>
          <Input
            id="website"
            name="website"
            maxLength={200}
            placeholder="ex: detalia.ro"
            defaultValue={initialWebsite ?? ""}
          />
        </div>
      </div>

      <Button type="submit" disabled={pending} className="h-10 self-start">
        {pending ? "Se salvează…" : "Salvează profilul"}
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
      <strong className="font-semibold text-foreground">Această funcție nu este încă disponibilă.</strong>{" "}
      Până atunci, rolul declarat este funcțional integral.
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
