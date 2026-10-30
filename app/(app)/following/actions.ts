"use server";
import { revalidatePath } from "next/cache";
import { requireActiveUserId } from "@/lib/require-active-user";
import { checkLimit, limiters } from "@/lib/rate-limit";
import { getFollowedUsers, setFollow } from "@/server/services/followService";

export async function getFollowedUsersAction(cursor: unknown = null) {
  const userId = await requireActiveUserId();
  try {
    const result = await getFollowedUsers(userId, cursor);
    if (result.ok) return result;
  } catch {
    // Eroarea ramane generica; lista se poate reincarca fara a expune detalii DB.
  }
  return { ok: false as const, error: "Lista nu s-a putut încărca. Încearcă din nou." };
}

export async function setFollowAction(kind: string, targetId: string, followed: boolean) {
  const userId = await requireActiveUserId();
  if (!(await checkLimit(limiters.mutation, userId)).ok)
    return { ok: false as const, error: "Prea multe acțiuni. Încearcă din nou mai târziu." };
  try {
    const result = await setFollow({ userId, kind, targetId, followed });
    if (!result.ok) return { ok: false as const, error: "Nu poți urmări această selecție." };
    revalidatePath("/feed");
    if (kind === "USER") revalidatePath("/profile/" + targetId);
    return result;
  } catch {
    return { ok: false as const, error: "Urmărirea nu s-a salvat. Încearcă din nou." };
  }
}
