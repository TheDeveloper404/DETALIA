"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { uploadAvatarImage, validateImageFile } from "@/lib/storage";
import { updateUserImage } from "@/server/repos/usersRepo";
import { declareRole } from "@/server/services/roleService";

export type DeclareRoleState = { error: string | null };

const ERROR_MESSAGES: Record<string, string> = {
  ALREADY_HAS_ROLE: "Ai deja un rol declarat.",
  INVALID_ROLE: "Selectează un rol valid.",
  INVALID_SUBROLE: "Subrolul ales nu corespunde rolului.",
  INVALID_TYPE: "Poza trebuie să fie PNG, JPG, WebP sau AVIF.",
  TOO_LARGE: "Poza e prea mare (max 8 MB).",
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

  // Poză opțională. Validăm tipul/dimensiunea ieftin ÎNAINTE de a declara rolul (fără upload),
  // ca o poză invalidă să nu lase rolul pe jumătate salvat.
  const imageFile = formData.get("image");
  const hasImage = imageFile instanceof File && imageFile.size > 0;
  if (hasImage) {
    const valid = validateImageFile(imageFile);
    if (!valid.ok) {
      return { error: ERROR_MESSAGES[valid.error] ?? "Poza nu a putut fi încărcată." };
    }
  }

  const result = await declareRole({ userId: session.user.id, roleMain, subRole });
  if (!result.ok) {
    return { error: ERROR_MESSAGES[result.error] ?? "Ceva n-a mers. Încearcă din nou." };
  }

  // Upload poza după ce rolul e salvat (best-effort — dacă pică, userul o poate adăuga ulterior din profil).
  if (hasImage) {
    const upload = await uploadAvatarImage(imageFile);
    if (upload.ok) {
      await updateUserImage(session.user.id, upload.url);
    }
  }

  // Rol declarat → acces imediat (frecare minimă la primul contact).
  redirect("/");
}
