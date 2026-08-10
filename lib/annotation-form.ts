// Parsare defensivă a stroke-urilor de adnotare trimise dintr-un câmp ascuns al formularului (creare
// SAU editare detaliu — vezi app/(app)/details/new/actions.ts și app/(app)/details/[id]/edit/actions.ts).
// Structura reală a stroke-urilor o validează `validateStrokes` din domain, pe server — aici doar
// decodăm forma brută. null = fără adnotare (câmp gol/absent/malformat/golit la „Gata").
export function parseAnnotationStrokes(raw: FormDataEntryValue | null): unknown[] | null {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}
