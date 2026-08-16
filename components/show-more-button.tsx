// Buton „Vezi mai multe" pentru liste tăiate la un plafon fix (profil: detalii/schițe/activitate;
// validation-panel: pozițiile aprob/dezaprob) — evită un perete lung de rânduri înainte de a ajunge
// la restul paginii. Extras din profile-view.tsx (2026-08-16) la a doua reutilizare.
export function ShowMoreButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 w-full rounded-lg border border-border bg-card py-2.5 text-sm font-semibold text-foreground/80 transition-colors hover:border-primary hover:text-primary"
    >
      Vezi mai multe
    </button>
  );
}
