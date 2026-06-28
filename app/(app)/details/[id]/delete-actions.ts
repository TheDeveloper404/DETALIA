"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { deleteDetail } from "@/server/services/detailService";

// Ștergerea unui detaliu de către autorul lui. Authz reală e în service (ownership);
// aici doar verificăm sesiunea și delegăm. La eșec (FORBIDDEN/NOT_FOUND) nu dezvăluim
// nimic — întoarcem în feed la fel ca la succes.
export async function deleteDetailAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const detailId = String(formData.get("detailId") ?? "");
  await deleteDetail({ detailId, userId: session.user.id });

  revalidatePath("/feed");
  redirect("/feed");
}
