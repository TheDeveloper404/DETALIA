"use client";

// Popup „cine a apreciat" un comentariu — același tipar de modal ca SendToCanvasModal (overlay +
// panou centrat, corp scrollabil), nu popover ancorat (lista poate avea zeci de nume).
import { X } from "lucide-react";
import Link from "next/link";

import { AvatarInitials } from "@/components/avatar-initials";
import { RolePill } from "@/components/role-pill";

export type CommentLiker = {
  id: string;
  name: string | null;
  image: string | null;
  roleMain: string | null;
  subRole: string | null;
  verified: boolean;
};

export function CommentLikersModal({ likers, onClose }: { likers: CommentLiker[]; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Cine a apreciat"
        className="fixed left-1/2 top-1/2 z-50 w-[min(22rem,90vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
          <span className="text-sm font-semibold">
            {likers.length} {likers.length === 1 ? "apreciere" : "aprecieri"}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        <ul className="max-h-72 divide-y divide-[#eee6da] overflow-y-auto p-1.5">
          {likers.map((u) => (
            <li key={u.id}>
              <Link
                href={`/profile/${u.id}`}
                onClick={onClose}
                className="flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-muted"
              >
                <AvatarInitials name={u.name} imageUrl={u.image} size={30} />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{u.name ?? "Anonim"}</span>
                <RolePill roleMain={u.roleMain} subRole={u.subRole} verified={u.verified} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
