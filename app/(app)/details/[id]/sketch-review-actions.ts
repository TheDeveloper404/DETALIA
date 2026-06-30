"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { checkLimit, limiters } from "@/lib/rate-limit";
import { createDraft, deleteSketch } from "@/server/services/sketchService";

// Șterge o schiță din teanc (moderare post-publicare) — autorul schiței SAU autorul detaliului-mamă
// (authz în service). actorUserId din sesiune; sketchId din formular. Pe authz greșit → FORBIDDEN, no-op.
export async function deleteSketchAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const sketchId = String(formData.get("sketchId") ?? "");
  const detailId = String(formData.get("detailId") ?? "");

  // SEC-01: ștergerea declanșează scrieri DB (cascadă) + posibil email → limită per user; la depășire, no-op.
  if (!(await checkLimit(limiters.mutation, session.user.id)).ok) {
    redirect(`/details/${detailId}`);
  }

  await deleteSketch({ sketchId, actorUserId: session.user.id });
  revalidatePath(`/details/${detailId}`);
}

// Pornește o schiță peste detaliu: creează un DRAFT și duce autorul în editor.
// ORICE user cu rol declarat poate schița (nu doar autorul-mamă). NO_ROLE → onboarding.
export async function startSketchAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const detailId = String(formData.get("detailId") ?? "");

  if (!(await checkLimit(limiters.mutation, session.user.id)).ok) {
    redirect(`/details/${detailId}`);
  }

  const draft = await createDraft({ detailId, authorId: session.user.id });
  if (!draft.ok) {
    if (draft.error === "NO_ROLE") redirect("/onboarding");
    redirect(`/details/${detailId}`);
  } else {
    redirect(`/sketches/${draft.value.sketchId}/edit`);
  }
}
