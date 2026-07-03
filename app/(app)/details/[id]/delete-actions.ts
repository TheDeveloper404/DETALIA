"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { checkLimit, limiters } from "@/lib/rate-limit";
import { deleteDetail } from "@/server/services/detailService";

// Ștergerea unui detaliu de către autorul lui. Authz reală e în service (ownership);
// aici doar verificăm sesiunea și delegăm. La eșec (FORBIDDEN/NOT_FOUND) nu dezvăluim
// nimic — întoarcem în feed la fel ca la succes.
export async function deleteDetailAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // SEC-A5: aceeași cotă ca restul mutațiilor (uniformizare; abuzul e oricum limitat la propriul conținut).
  if (!(await checkLimit(limiters.mutation, session.user.id)).ok) redirect("/feed");

  const detailId = String(formData.get("detailId") ?? "");
  await deleteDetail({ detailId, userId: session.user.id });

  revalidatePath("/feed");
  redirect("/feed");
}
