"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { deleteDraft } from "@/server/services/sketchService";

// Șterge o ciornă a userului curent. Ownership + starea DRAFT sunt verificate în service/repo.
export async function deleteDraftAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const sketchId = String(formData.get("sketchId") ?? "");
  if (sketchId) {
    await deleteDraft({ sketchId, authorId: session.user.id });
  }
  revalidatePath("/sketches/drafts");
}
