"use client";

import { useActionState, useState } from "react";

import {
  ROLE_MAINS,
  ROLE_MAIN_LABELS,
  SUBROLES,
  type RoleMain,
} from "@/server/domain/roles";

import { declareRoleAction, type DeclareRoleState } from "./actions";

const initialState: DeclareRoleState = { error: null };

export function RoleForm() {
  const [state, formAction, pending] = useActionState(declareRoleAction, initialState);
  const [roleMain, setRoleMain] = useState<RoleMain | "">("");

  const subRoles = roleMain ? SUBROLES[roleMain] : [];

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {state.error}
        </p>
      )}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Rolul tău</span>
        <select
          name="roleMain"
          required
          value={roleMain}
          onChange={(e) => setRoleMain(e.target.value as RoleMain)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="" disabled>
            Alege rolul…
          </option>
          {ROLE_MAINS.map((r) => (
            <option key={r} value={r}>
              {ROLE_MAIN_LABELS[r]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">
          Specializare <span className="text-zinc-400">(opțional)</span>
        </span>
        <select
          name="subRole"
          disabled={!roleMain}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Fără specializare</option>
          {subRoles.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={pending || !roleMain}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Se salvează…" : "Continuă"}
      </button>
    </form>
  );
}
