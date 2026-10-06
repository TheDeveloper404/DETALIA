import type { Metadata } from "next";

import { LandingPage } from "@/components/public-pages/landing-page";

export const metadata: Metadata = {
  title: { absolute: "DETALIA — Detaliile bune se construiesc împreună" },
  description:
    "Publici un detaliu de execuție. Primești schițe și argumente de la profesioniști, cu autorul și rolul la vedere.",
};

export default function Home() {
  return <LandingPage />;
}
