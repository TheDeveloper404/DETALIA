"use client";

import { CircleHelp } from "lucide-react";
import { useState } from "react";

import { SupportDialog } from "@/components/support/support-dialog";

export function HelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ajutor"
        title="Ajutor"
        className="inline-flex h-12 w-12 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted max-[379px]:hidden"
      >
        <CircleHelp className="size-5 sm:size-7" strokeWidth={2} />
      </button>
      {open && <SupportDialog flow="menu" onClose={() => setOpen(false)} />}
    </>
  );
}
