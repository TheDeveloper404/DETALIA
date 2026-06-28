import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AvatarInitials } from "@/components/avatar-initials";
import { auth } from "@/lib/auth";
import { ROLE_MAIN_LABELS, type RoleMain } from "@/server/domain/roles";
import { getUserProfile } from "@/server/repos/usersRepo";
import { getUserRole } from "@/server/services/roleService";

import {
  AvatarForm,
  CoverForm,
  EditDetailsForm,
  VerificationSection,
} from "../profile-forms";

// Setările proprii de profil (editare). Vizualizarea publică e la /profile (read) și /profile/[userId].
export default async function ProfileEditPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [profile, role] = await Promise.all([
    getUserProfile(session.user.id),
    getUserRole(session.user.id),
  ]);

  // Logat dar fără rol → trimitem la onboarding (profilul presupune un rol declarat).
  if (!role) {
    redirect("/onboarding");
  }

  const name = profile?.name ?? session.user.name ?? null;
  const email = profile?.email ?? session.user.email ?? null;
  const image = profile?.image ?? session.user.image ?? null;
  const cover = profile?.coverImage ?? null;
  const coverPosition = profile?.coverPosition ?? 50;
  const roleLabel = `${ROLE_MAIN_LABELS[role.roleMain as RoleMain] ?? role.roleMain}${role.subRole ? ` · ${role.subRole}` : ""}`;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-5">
      <Link
        href="/profile"
        className="mb-4 inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Înapoi la profil
      </Link>

      {/* Antet cu cover + avatar (preview live al imaginilor curente). */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="relative h-[120px] bg-gradient-to-br from-secondary to-[#ece1d3]">
          {cover && (
            <Image
              src={cover}
              alt=""
              fill
              sizes="768px"
              className="object-cover"
              style={{ objectPosition: `50% ${coverPosition}%` }}
            />
          )}
        </div>
        <div className="flex items-end gap-4 px-5 pb-4">
          <div className="-mt-9">
            <AvatarInitials
              name={name}
              imageUrl={image}
              size={72}
              className="border-4 border-card"
            />
          </div>
          <div className="min-w-0 pb-1">
            <div className="truncate text-lg font-bold">{name ?? "Profilul tău"}</div>
            <div className="truncate font-mono text-[12px] text-muted-foreground">
              {roleLabel}
              {role.verificationStatus === "VERIFIED" && <span className="text-[#d99a2b]"> ★</span>}
            </div>
            {email && <div className="truncate text-[12px] text-muted-foreground">{email}</div>}
          </div>
        </div>
      </div>

      {/* Carduri de editare — grid pe 2 coloane pe ecrane mari, mai puțin spațiu mort. */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:col-span-2">
          <h2 className="text-sm font-semibold">Detalii profil</h2>
          <p className="text-xs text-muted-foreground">
            Numele, titlul, secțiunea „Despre”, locația și website-ul apar pe profilul tău public.
          </p>
          <EditDetailsForm
            initialName={name}
            initialHeadline={profile?.headline ?? null}
            initialAbout={profile?.about ?? null}
            initialLocation={profile?.location ?? null}
            initialWebsite={profile?.website ?? null}
          />
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Poză de profil</h2>
          <AvatarForm current={image} />
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Imagine de cover</h2>
          <CoverForm current={cover} position={coverPosition} />
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:col-span-2">
          <h2 className="text-sm font-semibold">Rolul tău</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#ecdcc8] bg-[#f6ede4] px-2.5 py-1 font-mono text-[12px] text-primary">
              {roleLabel}
              {role.verificationStatus === "VERIFIED" && <span className="text-[#d99a2b]">★</span>}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Rolul e <strong>definitiv</strong> — îl alegi o singură dată, la crearea contului, fiindcă
            stabilește credibilitatea ta în comunitate. Dacă ai nevoie de o schimbare, scrie-ne la{" "}
            <a
              href="mailto:support@detalia.ro?subject=Schimbare%20rol&body=Rolul%20dorit%20%C8%99i%20motivul%3A"
              className="font-semibold text-primary hover:underline"
            >
              support@detalia.ro
            </a>{" "}
            cu rolul dorit și motivul.
          </p>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Verificarea rolului</h2>
          <VerificationSection status={role.verificationStatus} />
        </section>
      </div>
    </main>
  );
}
