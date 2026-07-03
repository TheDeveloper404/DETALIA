"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { checkLimit, limiters } from "@/lib/rate-limit";
import { deleteDraft } from "@/server/services/sketchService";

// Șterge o ciornă a userului curent. Ownership + starea DRAFT sunt verificate în service/repo.
export async function deleteDraftAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // SEC-A5: aceeași cotă ca restul mutațiilor (uniformizare).
  if (!(await checkLimit(limiters.mutation, session.user.id)).ok) return;

  const sketchId = String(formData.get("sketchId") ?? "");
  if (sketchId) {
    await deleteDraft({ sketchId, authorId: session.user.id });
  }
  revalidatePath("/sketches/drafts");
}
