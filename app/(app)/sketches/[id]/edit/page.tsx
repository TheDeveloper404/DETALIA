import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getDetail } from "@/server/services/detailService";
import { getDraftForEdit } from "@/server/services/sketchService";

import { SketchEditor } from "./sketch-editor";

// Editor de schiță — accesibil DOAR cu un draft existent (creat din fereastra de Dezaprob).
// getDraftForEdit garantează: doar autorul, doar cât e DRAFT.
export default async function SketchEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const draft = await getDraftForEdit(id, session.user.id);
  if (!draft.ok) {
    notFound();
  }

  const detail = await getDetail(draft.value.detailId);
  if (!detail) {
    notFound();
  }

  return (
    <SketchEditor
      sketchId={id}
      detailId={detail.id}
      imageUrl={detail.imageUrl}
      initialStrokes={draft.value.strokes}
      detailTitle={detail.title}
      authorName={detail.authorName}
      authorRoleMain={detail.authorRoleMain}
      authorSubRole={detail.authorSubRole}
      authorVerified={detail.authorVerification === "VERIFIED"}
    />
  );
}
