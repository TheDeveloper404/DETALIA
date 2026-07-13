import { notFound, redirect } from "next/navigation";

import { ProfileView } from "@/components/profile-view";
import { auth } from "@/lib/auth";
import { isUuid } from "@/server/domain/ids";
import { getProfileView } from "@/server/services/profileService";

// Profil PUBLIC (adresabil prin userId) — aceeași ProfileView, read-only (fără „Editează profil").
// Distinct de /profile (propriul, cu editare) și /profile/edit (setări).
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { userId } = await params;
  if (!isUuid(userId)) notFound();
  // Propriul profil → pagina proprie (cu editare).
  if (userId === session.user.id) redirect("/profile");

  const data = await getProfileView(userId, session.user.id);
  if (!data) notFound();

  return (
    <main className="flex-1 pt-2">
      <ProfileView data={data} />
    </main>
  );
}
