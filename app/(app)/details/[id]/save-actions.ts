"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { toggleSavedDetail } from "@/server/services/detailService";

// Comută „salvează detaliu" (bookmark) pentru userul din sesiune. `userId` vine DOAR din sesiune
// (nu din formular) → un user salvează/scoate strict pentru el (fără IDOR). Toggle-ul e reversibil.
export async function toggleSaveDetailAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const detailId = String(formData.get("detailId") ?? "");
  await toggleSavedDetail({ detailId, userId: session.user.id });

  // Re-randează pagina detaliului (starea butonului) + lista de salvate.
  revalidatePath(`/details/${detailId}`);
  revalidatePath("/saved");
}
