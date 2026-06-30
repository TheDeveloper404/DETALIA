"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { checkLimit, limiters } from "@/lib/rate-limit";
import { uploadSketchThumbnail } from "@/lib/storage";
import { publish, saveStrokes } from "@/server/services/sketchService";

export type SketchActionResult = { ok: boolean; error?: string };

const ERROR_MESSAGES: Record<string, string> = {
  SKETCH_NOT_FOUND: "Schița nu mai există.",
  DETAIL_NOT_FOUND: "Detaliul nu mai există.",
  FORBIDDEN: "Nu ai acces la această schiță.",
  INVALID_STATE: "Schița a fost deja publicată.",
  EMPTY_STROKES: "Desenează ceva înainte de a trimite.",
  INVALID_STROKES: "Desenul nu a putut fi salvat.",
  NO_ROLE: "Ai nevoie de un rol declarat.",
  RATE_LIMITED: "Prea multe trimiteri. Așteaptă un moment.",
};

function parseStrokes(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Salvează ciorna (autorul, doar cât e DRAFT). Nu redirecționează.
export async function saveStrokesAction(
  sketchId: string,
  strokesJson: string,
): Promise<SketchActionResult> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const res = await saveStrokes({
    sketchId,
    authorId: session.user.id,
    strokes: parseStrokes(strokesJson),
  });
  if (!res.ok) return { ok: false, error: ERROR_MESSAGES[res.error] ?? "Nu am putut salva." };
  return { ok: true };
}

// Publică schița (DRAFT → PUBLISHED, direct în teanc) + thumbnail PNG. Pe succes → redirect la detaliu.
export async function sendSketchAction(formData: FormData): Promise<SketchActionResult> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // SEC-01: publicarea declanșează scrieri DB + email către autorul-mamă → limită per user.
  if (!(await checkLimit(limiters.mutation, session.user.id)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }

  const sketchId = String(formData.get("sketchId") ?? "");
  const detailId = String(formData.get("detailId") ?? "");
  const strokes = parseStrokes(String(formData.get("strokes") ?? ""));

  // Thumbnail-ul e best-effort: dacă lipsește sau uploadul eșuează, publicăm fără el.
  let thumbnailUrl: string | null = null;
  const thumb = formData.get("thumbnail");
  if (thumb instanceof File && thumb.size > 0) {
    const upload = await uploadSketchThumbnail(thumb);
    if (upload.ok) thumbnailUrl = upload.url;
  }

  const res = await publish({ sketchId, authorId: session.user.id, strokes, thumbnailUrl });
  if (!res.ok) {
    if (res.error === "NO_ROLE") redirect("/onboarding");
    return { ok: false, error: ERROR_MESSAGES[res.error] ?? "Nu am putut publica." };
  }

  redirect(`/details/${detailId}`);
}
