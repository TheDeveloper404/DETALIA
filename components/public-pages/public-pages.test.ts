import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Verificăm compoziția pagină → shell → formularul real, fără email/DB sau sesiune.
vi.mock("@/app/auth-actions", () => ({ signInWithEmailAction: vi.fn() }));

import Home from "@/app/page";
import LoginPage from "@/app/login/page";
import SignupPage, { generateMetadata } from "@/app/signup/page";
import VerifyRequestPage from "@/app/verify-request/page";

describe("Paginile publice — integrare de randare", () => {
  it("păstrează logo-ul oficial, CTA-urile și ancorele fără splash", () => {
    const html = renderToStaticMarkup(createElement(Home));
    expect(html).toContain('src="/logo.svg"');
    expect(html).not.toContain('src="/logo-dark.svg"');
    expect(html).toContain('href="/signup"');
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="#cum-functioneaza"');
    expect(html).toContain('id="cum-functioneaza"');
    expect(html).toContain('id="proiecte-planse"');
    expect(html).not.toContain("dt-intro");
    const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    expect(header).not.toContain('href="#cum-functioneaza"');
    expect(header).not.toContain('href="#proiecte-planse"');
    expect(html).toContain('role="tablist" aria-label="Etapele unui detaliu"');
    expect(html).toContain('aria-label="Alege spațiul de lucru"');
    expect(html).toContain('aria-label="Perspective profesionale"');
    expect(html).toContain("Exemplu ilustrativ, cu persoane și texte fictive.");
    expect(html).not.toContain("column-base-detail.webp");
    expect(html).not.toContain("window-section-detail.webp");
    expect(html).not.toContain("Desen schematic animat — racord de fereastră");
  });

  it.each([
    { page: LoginPage, path: "/login", callback: "/feed?welcome=1", title: "Bine ai revenit." },
    {
      page: SignupPage,
      path: "/signup",
      callback: "/onboarding",
      title: "Adu perspectiva ta în detaliu.",
    },
  ])(
    "păstrează formularul passwordless și destinația pentru $path",
    async ({ page, path, callback, title }) => {
      const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
      expect(html).toContain(title);
      expect(html).toContain('name="email"');
      expect(html).toContain('type="email"');
      expect(html).toContain('autoComplete="email"');
      expect(html).toContain('name="authPath" value="' + path + '"');
      expect(html).toContain(
        'name="callbackUrl" value="' + callback.replaceAll("&", "&amp;") + '"',
      );
      expect(html).not.toContain('type="password"');
      expect((html.match(/alt="DETALIA"/g) ?? []).length).toBe(1);
      expect(html).toContain("Desen schematic animat — racord de fereastră");
      expect(html).toContain("Pauză animație");
      expect(html).toContain('data-paused="false"');
      expect(html).toContain('id="formular" tabindex="-1"');
      expect(html).not.toContain("window-section-detail.webp");
      expect(html).not.toContain("column-base-detail.webp");
      expect(html).not.toContain("terrace-detail.webp");
      expect(html).not.toContain("hero-detail.png");
      expect(html).toContain("authEntry");
    },
  );

  it("păstrează callback-ul primit și afișează erorile fără internals", async () => {
    const html = renderToStaticMarkup(
      await LoginPage({
        searchParams: Promise.resolve({ callbackUrl: "/saved", error: "Verification" }),
      }),
    );
    expect(html).toContain('name="callbackUrl" value="/saved"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Link-ul a expirat sau a fost deja folosit. Cere unul nou.");
  });

  it("păstrează metadata specială pentru referral", async () => {
    expect(await generateMetadata({ searchParams: Promise.resolve({ ref: "demo" }) })).toEqual({
      title: { absolute: "Te invit în DETALIA" },
    });
  });
  it("nu aplică prezentarea animată paginilor de confirmare care folosesc shell-ul implicit", () => {
    const html = renderToStaticMarkup(createElement(VerifyRequestPage));
    expect(html).toContain("hero-detail.png");
    expect(html).not.toContain("column-base-detail.webp");
    expect(html).not.toContain("window-section-detail.webp");
    expect(html).not.toContain("terrace-detail.webp");
    expect(html).not.toContain("authEntry");
    expect(html).not.toContain("Pauză animație");
  });
});
