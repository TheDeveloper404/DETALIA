"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { toggleSavedDetail } from "@/server/services/detailService";

// Comută „salvează detaliu" (bookmark) pentru userul din sesiune. `userId` vine DOAR din sesiune
// (nu din formular) → un user salvează/scoate strict pentru el (fără IDOR). Toggle-ul e reversibil.
// SEC-04 — EXCEPȚIE DELIBERATĂ: bookmark-ul e PRIVAT și inconsecvent (nu produce conținut vizibil altora),
// deci rămâne pe `auth()` — un SELECT de status per toggle ar costa degeaba (ca la autosave-ul de schiță).
export async function toggleSaveDetailAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const detailId = String(formData.get("detailId") ?? "");
  await toggleSavedDetail({ detailId, userId: session.user.id });

  // Re-randează pagina detaliului (starea butonului) + lista de salvate + feed-ul (bookmark pe card).
  revalidatePath(`/details/${detailId}`);
  revalidatePath("/saved");
  revalidatePath("/feed");
}

// Variantă apelabilă (nu form action) pentru bookmark-ul din cardul de feed — întoarce noua stare,
// ca butonul client să se poată reconcilia (același pattern ca approve/retract din FeedValidationActions).
export async function toggleSaveDetailForFeedAction(detailId: string): Promise<{ saved: boolean }> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const res = await toggleSavedDetail({ detailId, userId: session.user.id });
  revalidatePath(`/details/${detailId}`);
  revalidatePath("/saved");
  revalidatePath("/feed");
  return res;
}
