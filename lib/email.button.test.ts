import { describe, expect, it } from "vitest";

import { magicLinkEmailHtml } from "./email";

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
