import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getCanvasForEdit } from "@/server/services/canvasService";

import CanvasEditor from "./canvas-editor";

// Editor de Planșă — DOAR owner-ul (getCanvasForEdit întoarce NOT_FOUND altfel; conținut strict privat).
export default async function CanvasEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const res = await getCanvasForEdit({ canvasId: id, ownerId: session.user.id });
  if (!res.ok) {
    notFound();
  }

  return (
    <CanvasEditor
      canvasId={res.value.id}
      name={res.value.name}
      initialState={res.value.state}
      items={res.value.items}
    />
  );
}
