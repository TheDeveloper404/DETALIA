import { Download, FileText } from "lucide-react";
import Link from "next/link";

import { AvatarInitials } from "@/components/avatar-initials";
import { RolePill } from "@/components/role-pill";
import type { MaterialOfferForDetail } from "@/server/repos/materialOffersRepo";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// STRICT pentru autorul detaliului — apelantul (page.tsx) randează acest component DOAR dacă
// `isDetailAuthor`; datele în sine vin deja filtrate de `getMaterialOffersForOwner` (server), care
// întoarce listă goală pentru oricine altcineva. Dublă barieră intenționată (UI + service), nu doar UI.
export function MaterialOfferPanel({ offers }: { offers: MaterialOfferForDetail[] }) {
  if (offers.length === 0) return null;

  return (
    <section className="mt-4 border-t border-[#eee6da] pt-4">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-[#a59a88]">
        {offers.length} {offers.length === 1 ? "ofertă de materiale" : "oferte de materiale"} primite
      </p>
      <ul className="flex flex-col gap-3">
        {offers.map((o) => (
          <li key={o.offerId} className="rounded-lg border border-[#eee6da] bg-[#faf7f1] p-3">
            <div className="mb-2 flex items-center gap-2">
              <Link href={`/profile/${o.supplierId}`} className="flex min-w-0 items-center gap-2 no-underline">
                <AvatarInitials name={o.supplierName} imageUrl={o.supplierImage} size={26} />
                <span className="truncate text-sm font-semibold hover:underline">
                  {o.supplierName ?? "Anonim"}
                </span>
              </Link>
              <RolePill roleMain={o.roleMain} subRole={o.subRole} verified={o.verification === "VERIFIED"} />
            </div>
            {o.message && <p className="mb-2 whitespace-pre-wrap text-sm text-foreground">{o.message}</p>}
            {o.files.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {o.files.map((f) => (
                  <li key={f.id}>
                    <a
                      href={f.url}
                      download={f.fileName}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-md border border-[#eee6da] bg-card px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-muted"
                    >
                      <FileText className="size-3.5 shrink-0" strokeWidth={2} />
                      <span className="truncate">{f.fileName}</span>
                      <span className="shrink-0 text-muted-foreground">{formatSize(f.fileSize)}</span>
                      <Download className="ml-auto size-3.5 shrink-0" strokeWidth={2} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
