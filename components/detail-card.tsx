// Card de detaliu în feed — prezentațional (server component). Imagine + titlu + text + autor(rol) + categorie.
import Image from "next/image";
import Link from "next/link";

import type { FeedItem } from "@/server/repos/detailsRepo";

import { AuthorBadge } from "./author-badge";
import { Badge } from "./ui/badge";

export function DetailCard({ detail }: { detail: FeedItem }) {
  return (
    <Link
      href={`/details/${detail.id}`}
      className="group flex flex-col overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full bg-muted">
        <Image
          src={detail.imageUrl}
          alt={detail.title}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {detail.categoryName && (
          <Badge variant="secondary" className="w-fit">
            {detail.categoryName}
          </Badge>
        )}
        <h3 className="font-semibold leading-snug group-hover:underline">{detail.title}</h3>
        {detail.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{detail.description}</p>
        )}
        <div className="mt-auto pt-2">
          <AuthorBadge
            name={detail.authorName}
            roleMain={detail.authorRoleMain}
            subRole={detail.authorSubRole}
            verified={detail.authorVerification === "VERIFIED"}
          />
        </div>
      </div>
    </Link>
  );
}
