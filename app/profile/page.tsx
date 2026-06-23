import { redirect } from "next/navigation";

import { AuthorBadge } from "@/components/author-badge";
import { auth } from "@/lib/auth";
import { getUserRole } from "@/server/services/roleService";
import { getUserProfile } from "@/server/repos/usersRepo";

import {
  AvatarForm,
  EditRoleForm,
  SignOutButton,
  VerificationSection,
} from "./profile-forms";

export default async function ProfilePage() {
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

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 p-6 sm:p-8">
      <header className="flex items-center gap-4">
        <Avatar image={image} name={name} size={64} />
        <div className="flex flex-col gap-1">
          <AuthorBadge
            name={name}
            roleMain={role.roleMain}
            subRole={role.subRole}
            verified={role.verificationStatus === "VERIFIED"}
          />
          {email && <span className="text-sm text-muted-foreground">{email}</span>}
        </div>
      </header>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-sm font-semibold">Poză de profil</h2>
        <AvatarForm />
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-sm font-semibold">Rolul tău</h2>
        <p className="text-xs text-muted-foreground">
          Rolul apare lângă numele tău în comunitate. Dacă îl schimbi după ce a fost verificat,
          verificarea se reia.
        </p>
        <EditRoleForm initialRoleMain={role.roleMain} initialSubRole={role.subRole} />
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-sm font-semibold">Verificarea rolului</h2>
        <VerificationSection status={role.verificationStatus} />
      </section>

      <section className="border-t border-border pt-6">
        <SignOutButton />
      </section>
    </main>
  );
}

// Avatar simplu — poza dacă există, altfel inițiala pe fundal neutru.
function Avatar({
  image,
  name,
  size,
}: {
  image: string | null;
  name: string | null;
  size: number;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground"
      style={{ width: size, height: size, fontSize: size / 2.5 }}
    >
      {initial}
    </span>
  );
}
