import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { adminLoginEmailHtml, magicLinkEmailHtml, magicLinkEmailText } from "./email";

// Butonul din emailuri urmează CTA-ul din landing: colțuri aproape drepte, etichetă mono majusculă.
describe("emailButton — stilul CTA-ului din landing", () => {
  it("magic link: buton cu colțuri de 2 px, mono, majuscule", () => {
    const html = magicLinkEmailHtml("https://detalia.ro/verify?u=x", 15);
    expect(html).toContain("border-radius:2px");
    expect(html).not.toContain("border-radius:10px");
    expect(html).toContain("text-transform:uppercase");
    expect(html).toContain("'IBM Plex Mono'");
  });
});

describe("emailuri — brand și link de conectare", () => {
  it("folosește un logo PNG oficial disponibil în public, cu text alternativ", () => {
    const html = magicLinkEmailHtml("https://detalia.ro/verify?u=x", 15);
    expect(html).toContain('src="https://detalia.ro/brand/logo-email.png" alt="DETALIA"');
    const logo = readFileSync(resolve("public/brand/logo-email.png"));
    expect(logo.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("păstrează destinația completă și TTL-ul în HTML și text simplu", () => {
    const url =
      "https://detalia.ro/verify?u=https%3A%2F%2Fdetalia.ro%2Fcallback%3Ftoken%3Dtest&next=%2Ffeed";
    const html = magicLinkEmailHtml(url, 30);
    const text = magicLinkEmailText(url, 30);
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    expect(links).toEqual([url.replaceAll("&", "&amp;"), url.replaceAll("&", "&amp;")]);
    expect(html).toContain("30 de minute");
    expect(html).toContain("o singură dată");
    expect(text).toContain(url);
    expect(text).toContain("30 de minute");
    expect(text).toContain("o singură dată");
  });

  it("păstrează accentul și eticheta distincte ale emailului de admin", () => {
    const html = adminLoginEmailHtml("https://detalia.ro/admin-page/verify?token=test", 15);
    expect(html).toContain('alt="DETALIA"');
    expect(html).toContain("PANOU ADMIN");
    expect(html).toContain("border-top:3px solid #33465e");
    expect(html).toContain("Intră în panoul de admin");
  });
});
