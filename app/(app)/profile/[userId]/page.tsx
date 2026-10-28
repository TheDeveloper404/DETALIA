import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { FollowButton } from "@/components/follow-button";
import { getFollowState } from "@/server/services/followService";
import { ProfileView } from "@/components/profile-view";
import { auth } from "@/lib/auth";
import { isUuid } from "@/server/domain/ids";
import { getProfileView } from "@/server/services/profileService";

// Profil PUBLIC (adresabil prin userId) — aceeași ProfileView, read-only (fără „Editează profil").
// Distinct de /profile (propriul, cu editare) și /profile/edit (setări).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const session = await auth();
  if (!session?.user?.id) return { title: "Profil" };
  const { userId } = await params;
  if (!isUuid(userId)) return { title: "Profil" };
  const data = await getProfileView(userId, session.user.id);
  return { title: data ? data.name : "Profil" };
}

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

  const followed = await getFollowState(session.user.id, "USER", userId);
  return (
    <main className="flex-1 pt-2">
      <div className="mx-auto flex max-w-[1080px] justify-end px-6 py-2"><FollowButton kind="USER" targetId={userId} followed={followed} label={data.name ?? "utilizatorul"} /></div>
      <ProfileView data={data} />
    </main>
  );
}
