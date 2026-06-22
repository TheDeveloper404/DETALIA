// Badge autor — nume + rol (mereu vizibil lângă nume) + steluță galbenă dacă rolul e VERIFICAT.
// Greutatea o judecă cititorul după rol; noi doar afișăm rolul corect și transparent (fără scoring).
import { ROLE_MAIN_LABELS, type RoleMain } from "@/server/domain/roles";

export function AuthorBadge({
  name,
  roleMain,
  subRole,
  verified,
}: {
  name: string | null;
  roleMain: string | null;
  subRole: string | null;
  verified: boolean;
}) {
  const roleLabel = roleMain ? (ROLE_MAIN_LABELS[roleMain as RoleMain] ?? roleMain) : null;

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
      <span className="font-medium text-zinc-900 dark:text-zinc-100">{name ?? "Anonim"}</span>
      {roleLabel && (
        <span className="text-zinc-500 dark:text-zinc-400">
          · {roleLabel}
          {subRole ? ` (${subRole})` : ""}
        </span>
      )}
      {verified && (
        <span
          title="Rol verificat"
          aria-label="Rol verificat"
          className="text-amber-500"
        >
          ★
        </span>
      )}
    </div>
  );
}
