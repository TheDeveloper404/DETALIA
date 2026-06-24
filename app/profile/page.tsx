import { redirect } from "next/navigation";

import { ProfileView } from "@/components/profile-view";
import { auth } from "@/lib/auth";
import { getProfileView } from "@/server/services/profileService";
import { getUserRole } from "@/server/services/roleService";

// Profilul propriu (vizualizare, pe date reale). Editarea e la /profile/edit; profilul altui user la /profile/[userId].
export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Logat dar fără rol → onboarding (profilul presupune un rol declarat).
  const role = await getUserRole(session.user.id);
  if (!role) {
    redirect("/onboarding");
  }

  const data = await getProfileView(session.user.id, session.user.id);
  if (!data) {
    redirect("/onboarding");
  }

  return (
    <main className="flex-1 pt-2">
      <ProfileView data={data} />
    </main>
  );
}
