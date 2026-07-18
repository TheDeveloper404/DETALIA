import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EditProfileHeader } from "@/components/edit-profile-header";
import { auth } from "@/lib/auth";
import { getUserProfile } from "@/server/repos/usersRepo";
import { getUserRole } from "@/server/services/roleService";

import { DeleteAccountSection } from "../delete-account-section";
import { EditDetailsForm, VerificationSection } from "../profile-forms";

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
  // Doar meseria apare în platformă — rolul principal e doar grupare la alegere (lista_meserii.md).
  const roleLabel = role.subRole ?? role.roleMain;

  return (
    // Aceeași lățime ca vizualizarea de profil (ProfileView: max-w-[1080px]) — tranziția
    // /profile ↔ /profile/edit nu mai „sare" între două containere diferite.
    <main className="mx-auto w-full max-w-[1080px] flex-1 px-6 pb-16 pt-5">
      <Link
        href="/profile"
        className="mb-4 inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Înapoi la profil
      </Link>

      {/* Antet cu cover + avatar editabile „in place" (click pe imagine → schimbă/șterge). */}
      <EditProfileHeader
        name={name}
        email={email}
        roleLabel={roleLabel}
        verified={role.verificationStatus === "VERIFIED"}
        image={image}
        cover={cover}
        coverPosition={coverPosition}
      />

      {/* Carduri de editare. */}
      <div className="mt-5 flex flex-col gap-4">
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
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
            initialCompany={profile?.company ?? null}
            initialPhone={profile?.phone ?? null}
            initialPhoneVisible={profile?.phoneVisible ?? false}
            email={email}
            initialEmailVisible={profile?.emailVisible ?? false}
          />
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
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

          {/* Verificarea rolului — integrată în „Rolul tău" (nu mai e card separat). */}
          <div className="mt-1 border-t border-border pt-3">
            <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">
              Verificarea rolului
            </h3>
            <VerificationSection status={role.verificationStatus} />
          </div>
        </section>

        {/* Zonă periculoasă — ștergerea contului (GDPR). */}
        <DeleteAccountSection />
      </div>
    </main>
  );
}
