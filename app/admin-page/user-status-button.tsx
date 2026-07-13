"use client";

import { setUserStatusAction } from "./actions";

// Buton per rând (suspendare/reactivare) — confirmare înainte de submit (acțiune cu impact real pe cont,
// chiar dacă reversibilă). Formularul RSC nu poate avea `onSubmit` cu `preventDefault` ușor combinat cu
// server action, deci verificăm în `onClick` pe buton, înainte ca formularul să apuce să trimită.
export function UserStatusButton({
  userId,
  email,
  status,
}: {
  userId: string;
  email: string;
  status: "ACTIVE" | "SUSPENDED";
}) {
  const suspending = status === "ACTIVE";
  const label = suspending ? "Suspendă" : "Reactivează";
  const confirmMessage = suspending
    ? `Suspenzi contul ${email}? Nu va mai putea accesa platforma până îl reactivezi.`
    : `Reactivezi contul ${email}?`;

  return (
    <form action={setUserStatusAction.bind(null, userId, suspending ? "SUSPENDED" : "ACTIVE")}>
      <button
        type="submit"
        onClick={(e) => {
          if (!window.confirm(confirmMessage)) e.preventDefault();
        }}
        className="rounded border border-border px-2 py-1 text-[12px] font-medium hover:bg-secondary"
      >
        {label}
      </button>
    </form>
  );
}
