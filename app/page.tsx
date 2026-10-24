import type { Metadata } from "next";

import { LandingPage } from "@/components/public-pages/landing-page";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: { absolute: "DETALIA — Detaliile bune se construiesc împreună" },
  description:
    "Publici un detaliu de execuție. Primești schițe și argumente de la profesioniști, cu autorul și rolul la vedere.",
  alternates: { canonical: "/" },
};

export default function Home() {
  // Date structurate (schema.org) pentru Google: cine e site-ul și sub ce nume apare în rezultate.
  // `application/ld+json` e bloc de date, nu se execută → CSP-ul (script-src cu nonce) nu i se aplică.
  // Pattern-ul oficial Next (ghidul JSON-LD): `<` escapat, ca JSON-ul să nu poată închide tag-ul <script>.
  const base = siteUrl();
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "Organization", name: "DETALIA", url: base, logo: `${base}/logo.svg` },
    { "@context": "https://schema.org", "@type": "WebSite", name: "DETALIA", url: base, inLanguage: "ro" },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <LandingPage />
    </>
  );
}
