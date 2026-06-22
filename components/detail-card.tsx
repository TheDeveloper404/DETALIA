// Card de detaliu în feed — prezentațional (server component). Imagine + titlu + text + autor(rol) + categorie.
import Image from "next/image";
import Link from "next/link";

import type { FeedItem } from "@/server/repos/detailsRepo";

import { AuthorBadge } from "./author-badge";

export function DetailCard({ detail }: { detail: FeedItem }) {
  return (
    <Link
      href={`/details/${detail.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="relative aspect-[4/3] w-full bg-zinc-100 dark:bg-zinc-800">
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
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            {detail.categoryName}
          </span>
        )}
        <h3 className="font-semibold leading-snug text-zinc-900 group-hover:underline dark:text-zinc-100">
          {detail.title}
        </h3>
        {detail.description && (
          <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
            {detail.description}
          </p>
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
