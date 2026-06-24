import Link from "next/link";

// Pagina 404 — afișată la `notFound()` (ex. un detaliu inexistent) sau rute necunoscute.
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="flex max-w-md flex-col items-center rounded-2xl border border-dashed border-border bg-card px-8 py-12 text-center">
        <div className="mb-5 font-mono text-4xl font-bold text-primary">404</div>
        <h1 className="mb-2 font-heading text-[22px] font-bold">Nu găsim pagina</h1>
        <p className="mb-6 leading-relaxed text-muted-foreground">
          Detaliul sau pagina pe care o cauți nu există sau a fost ștearsă.
        </p>
        <Link
          href="/feed"
          className="inline-flex items-center rounded-lg border border-[#95492e] bg-primary px-[22px] py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-[#974a2e]"
        >
          Mergi la feed
        </Link>
      </div>
    </main>
  );
}
