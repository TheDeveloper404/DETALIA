import Link from "next/link";

// Empty state al feed-ului — cardul cu bordură întreruptă din design. Mesaj diferit dacă e filtrat pe categorie.
export function FeedEmpty({
  filtered,
  addHref = "/details/new",
}: {
  filtered: boolean;
  addHref?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#d8cfc0] bg-card px-8 py-16 text-center">
      <div className="mb-[22px] flex size-16 items-center justify-center rounded-2xl border border-[#e6ddcf] bg-secondary">
        <svg
          width="30"
          height="30"
          viewBox="0 0 48 48"
          fill="none"
          stroke="#a9573a"
          strokeWidth="2"
          strokeLinejoin="round"
        >
          <rect x="10" y="8" width="28" height="32" rx="2" />
          <path d="M16 18h16M16 24h16M16 30h10" />
        </svg>
      </div>
      <h2 className="mb-2 text-[22px] font-bold">
        {filtered ? "Nicio categorie nu are detalii încă" : "Niciun detaliu aici încă"}
      </h2>
      <p className="mb-6 max-w-[42ch] leading-relaxed text-muted-foreground">
        Fii primul care pune un detaliu de execuție la dezbatere. Publici desenul, breasla îl
        cântărește pe roluri.
      </p>
      <Link
        href={addHref}
        className="inline-flex items-center gap-2 rounded-[10px] border border-[#95492e] bg-primary px-[22px] py-3 font-semibold text-primary-foreground no-underline transition-colors hover:bg-[#974a2e]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Adaugă primul detaliu
      </Link>
    </div>
  );
}
