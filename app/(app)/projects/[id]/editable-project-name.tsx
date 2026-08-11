"use client";

import { useRef, useState } from "react";

import { PROJECT_NAME_MAX_LENGTH } from "@/server/domain/project";

import { renameProjectAction } from "../actions";

// Nume de proiect editabil INLINE — dublu-click intră în editare, la fel ca numele setat la creare,
// dar redeschis oricând. Salvează DOAR la Enter — blur/Escape anulează fără să salveze (pattern identic
// cu redenumirea planșei, `canvases-list.tsx`). Important: `onBlur` NU declanșează save — un `input`
// focusat care se demontează (Enter → setEditing(false)) primește un blur nativ al browserului; dacă
// blur ar re-apela save(), ar porni un al doilea request cu draft-ul din closure-ul vechi (dublu submit
// silențios, plus erorile de la el n-ar mai avea unde să se afișeze). Server-ul rămâne sursa de adevăr
// (owner-only, `renameProject`).
export function EditableProjectName({
  projectId,
  initialName,
  editable,
}: {
  projectId: string;
  initialName: string;
  editable: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    if (!editable) return;
    setDraft(name);
    setError(null);
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  }

  async function save() {
    const trimmed = draft.trim();
    if (trimmed === name) {
      setEditing(false);
      return;
    }
    const res = await renameProjectAction(projectId, trimmed);
    if (!res.ok) {
      setError(res.error ?? "Nu am putut redenumi proiectul.");
      return;
    }
    setName(trimmed);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void save();
            }
            if (e.key === "Escape") setEditing(false);
          }}
          maxLength={PROJECT_NAME_MAX_LENGTH}
          autoFocus
          className="rounded-md border border-primary/40 bg-card px-2 py-1 font-heading text-[26px] font-extrabold tracking-tight outline-none"
        />
        {error && <p className="font-mono text-[11px] text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <h1
      onDoubleClick={startEdit}
      title={editable ? "Dublu-click pentru a redenumi" : undefined}
      className={`font-heading text-[26px] font-extrabold tracking-tight ${editable ? "cursor-text" : ""}`}
    >
      {name}
    </h1>
  );
}
