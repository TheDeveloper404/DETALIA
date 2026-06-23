// Coloana dreaptă a feed-ului — categorii populare + „în dezbatere acum" + nudge de validare pe rol.
// Prezentațional (props-driven). „În dezbatere" = detaliile cu cele mai multe comentarii (derivat din feed).
import Link from "next/link";

export type RailCategory = { id: string; name: string; count: number };
export type RailDebated = {
  id: string;
  title: string;
  commentCount: number;
  sketchCount: number;
};

export function FeedRail({
  categories,
  debated,
  basePath = "/feed",
}: {
  categories: RailCategory[];
  debated: RailDebated[];
  basePath?: string;
}) {
  return (
    <aside className="hidden flex-col gap-[18px] xl:sticky xl:top-[90px] xl:flex">
      {/* Categorii populare. */}
      {categories.length > 0 && (
        <div className="rounded-2xl bg-card p-[18px] ring-1 ring-foreground/10">
          <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Categorii populare
          </div>
          <ul className="flex list-none flex-col gap-[11px] p-0">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <Link
                  href={`${basePath}?cat=${c.id}`}
                  className="text-sm text-foreground/80 no-underline hover:text-primary"
                >
                  {c.name}
                </Link>
                <span className="font-mono text-[11.5px] text-primary">{c.count} detalii</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* În dezbatere acum. */}
      {debated.length > 0 && (
        <div className="rounded-2xl bg-card p-[18px] ring-1 ring-foreground/10">
          <div className="mb-3.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            În dezbatere acum
          </div>
          <ul className="flex list-none flex-col gap-3.5 p-0">
            {debated.map((d, i) => (
              <li key={d.id} className={i > 0 ? "border-t border-[#eee6da] pt-3.5" : undefined}>
                <Link
                  href={`/details/${d.id}`}
                  className="block font-semibold leading-snug text-foreground no-underline hover:text-primary"
                >
                  {d.title}
                </Link>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {d.commentCount} comentarii · {d.sketchCount} schițe
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Nudge: validează pe rolul tău. */}
      <div className="rounded-2xl border border-[#e6ddcf] bg-secondary p-[18px]">
        <div className="mb-1.5 font-bold text-foreground">Validează pe rolul tău</div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          O dezaprobare vine mereu cu o justificare. Părerea ta cântărește prin rolul afișat lângă nume.
        </p>
      </div>
    </aside>
  );
}
