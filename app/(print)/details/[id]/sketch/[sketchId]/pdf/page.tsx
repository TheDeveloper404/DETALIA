import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDetail } from "@/server/services/detailService";
import { getPrintStack } from "@/server/services/sketchService";
import { StackPrintDocument } from "../../../pdf/stack-print-document";
import "../../../pdf/print.css";

export const metadata: Metadata = { title: "Export PDF", robots: { index: false, follow: false } };

export default async function SketchPdfPage({ params, searchParams }: {
  params: Promise<{ id: string; sketchId: string }>;
  searchParams?: Promise<{ stack?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id, sketchId } = await params;
  const detail = await getDetail(id, session.user.id);
  if (!detail) notFound();
  const query = await searchParams;
  const stack = await getPrintStack(detail.id, typeof query?.stack === "string" ? query.stack.split(",") : query?.stack, sketchId);
  if (!stack) notFound();
  return <StackPrintDocument detail={detail} stack={stack} />;
}
