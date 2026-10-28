"use server";
import { revalidatePath } from "next/cache";
import { requireActiveUserId } from "@/lib/require-active-user";
import { checkLimit, limiters } from "@/lib/rate-limit";
import { setFollow } from "@/server/services/followService";

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
