"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { declareRole } from "@/server/services/roleService";

export type DeclareRoleState = { error: string | null };

const ERROR_MESSAGES: Record<string, string> = {
  ALREADY_HAS_ROLE: "Ai deja un rol declarat.",
  INVALID_ROLE: "Selectează un rol valid.",
  INVALID_SUBROLE: "Subrolul ales nu corespunde rolului.",
};

export async function declareRoleAction(
  _prev: DeclareRoleState,
  formData: FormData,
): Promise<DeclareRoleState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roleMain = String(formData.get("roleMain") ?? "");
  const rawSubRole = formData.get("subRole");
  const subRole = rawSubRole ? String(rawSubRole) : null;

  const result = await declareRole({ userId: session.user.id, roleMain, subRole });

  if (!result.ok) {
    return { error: ERROR_MESSAGES[result.error] ?? "Ceva n-a mers. Încearcă din nou." };
  }

  // Rol declarat → acces imediat (frecare minimă la primul contact).
  redirect("/");
}
