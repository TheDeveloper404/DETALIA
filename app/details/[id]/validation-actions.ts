"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { approve, disapprove, retract } from "@/server/services/validationService";

export type DisapproveState = { error: string | null };

const ERROR_MESSAGES: Record<string, string> = {
  TARGET_NOT_FOUND: "Detaliul nu mai există.",
  JUSTIFICATION_REQUIRED: "Dezaprobarea cere o justificare.",
  JUSTIFICATION_TOO_LONG: "Justificarea e prea lungă (max 5000 de caractere).",
};

// detailId vine din formular (al paginii curente); userId vine EXCLUSIV din sesiune (fără IDOR).
function readDetailId(formData: FormData): string {
  return String(formData.get("detailId") ?? "");
}

export async function approveDetailAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const detailId = readDetailId(formData);
  const res = await approve({ userId: session.user.id, targetType: "DETAIL", targetId: detailId });
  if (!res.ok && res.error === "NO_ROLE") redirect("/onboarding");

  revalidatePath(`/details/${detailId}`);
}

export async function retractDetailAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const detailId = readDetailId(formData);
  await retract({ userId: session.user.id, targetType: "DETAIL", targetId: detailId });

  revalidatePath(`/details/${detailId}`);
}

export async function disapproveDetailAction(
  _prev: DisapproveState,
  formData: FormData,
): Promise<DisapproveState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const detailId = readDetailId(formData);
  const justification = String(formData.get("justification") ?? "");

  const res = await disapprove({
    userId: session.user.id,
    targetType: "DETAIL",
    targetId: detailId,
    justification,
  });

  if (!res.ok) {
    if (res.error === "NO_ROLE") redirect("/onboarding");
    return { error: ERROR_MESSAGES[res.error] ?? "Ceva n-a mers. Încearcă din nou." };
  }

  revalidatePath(`/details/${detailId}`);
  return { error: null };
}
