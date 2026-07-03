import { Plus } from "lucide-react";
import Link from "next/link";

// CTA principal al platformei — fix pe ecran (nu în flow-ul unei coloane), ca să rămână mereu
// accesibil indiferent de scroll sau de câte categorii sunt expandate în sidebar (vezi CHANGELOG).
export function AddDetailFab() {
  return (
    <Link
      href="/details/new"
      aria-label="Adaugă detaliu"
      title="Adaugă detaliu"
      className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full border border-[#95492e] bg-primary px-5 py-3.5 font-semibold text-primary-foreground no-underline shadow-lg transition-colors hover:bg-[#974a2e]"
    >
      <Plus className="size-[18px]" strokeWidth={2.4} />
      <span className="hidden sm:inline">Adaugă detaliu</span>
    </Link>
  );
}
