"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { accept, createDraft, reject } from "@/server/services/sketchService";

// Accept/respinge propunere — doar autorul detaliului-mamă (authz în service). Fără justificare.
// actorUserId vine din sesiune; sketchId din formular. Pe authz greșit, service-ul respinge (FORBIDDEN) → no-op.

async function review(formData: FormData, decision: "accept" | "reject") {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const sketchId = String(formData.get("sketchId") ?? "");
  const detailId = String(formData.get("detailId") ?? "");

  if (decision === "accept") {
    await accept({ sketchId, actorUserId: session.user.id });
  } else {
    await reject({ sketchId, actorUserId: session.user.id });
  }
  revalidatePath(`/details/${detailId}`);
}

export async function acceptSketchAction(formData: FormData): Promise<void> {
  await review(formData, "accept");
}

export async function rejectSketchAction(formData: FormData): Promise<void> {
  await review(formData, "reject");
}

// Pornește o schiță peste detaliu: creează un DRAFT și duce autorul în editor.
// ORICE user cu rol declarat poate schița (nu doar autorul-mamă). NO_ROLE → onboarding.
export async function startSketchAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const detailId = String(formData.get("detailId") ?? "");
  const draft = await createDraft({ detailId, authorId: session.user.id });
  if (!draft.ok) {
    if (draft.error === "NO_ROLE") redirect("/onboarding");
    redirect(`/details/${detailId}`);
  } else {
    redirect(`/sketches/${draft.value.sketchId}/edit`);
  }
}
