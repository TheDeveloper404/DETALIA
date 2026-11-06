"use server";
import { requireActiveUserId } from "@/lib/require-active-user";
import { getRoleDirectoryPage } from "@/server/services/detailService";

export async function getRoleDirectoryPageAction(role: unknown, county: unknown, cursor: unknown) {
  await requireActiveUserId();
  try {
    const result = await getRoleDirectoryPage(role, county, cursor);
    if (result.ok) return result;
  } catch {
    // Eroarea ramane generica; lista se poate reincarca fara a expune detalii DB.
  }
  return { ok: false as const, error: "Lista nu s-a putut încărca. Încearcă din nou." };
}
