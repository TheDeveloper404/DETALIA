"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { checkLimit, limiters } from "@/lib/rate-limit";
import { requireActiveUserId } from "@/lib/require-active-user";
import { deleteDetail } from "@/server/services/detailService";

// Ștergerea unui detaliu de către autorul lui. Authz reală e în service (ownership);
// aici doar verificăm sesiunea și delegăm. La eșec (FORBIDDEN/NOT_FOUND) nu dezvăluim
// nimic — întoarcem în feed la fel ca la succes.
export async function deleteDetailAction(formData: FormData): Promise<void> {
  // SEC-04: ștergerea cascadează peste conținutul ALTORA (schițe/comentarii/validări de pe detaliu) — un cont
  // suspendat nu trebuie să-și mai poată nuci contribuțiile (evadare de moderare). Consecvent cu create/update.
  const userId = await requireActiveUserId();

  // SEC-A5: aceeași cotă ca restul mutațiilor (uniformizare; abuzul e oricum limitat la propriul conținut).
  if (!(await checkLimit(limiters.mutation, userId)).ok) redirect("/feed");

  const detailId = String(formData.get("detailId") ?? "");
  await deleteDetail({ detailId, userId });

  revalidatePath("/feed");
  redirect("/feed");
}
