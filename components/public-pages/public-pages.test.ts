import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Verificăm compoziția pagină → shell → formularul real, fără email/DB sau sesiune.
vi.mock("@/app/auth-actions", () => ({ signInWithEmailAction: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ host: "detalia.ro" })),
}));

import Home from "@/app/page";
import LoginPage from "@/app/login/page";
import SignupPage, { generateMetadata } from "@/app/signup/page";
import VerifyRequestPage from "@/app/verify-request/page";
import VerifyPage from "@/app/verify/page";
import GhidPage from "@/app/ghid/page";

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
      expect(html).not.toContain("Desen schematic animat — racord de fereastră");
      expect(html).not.toContain("Pauză animație");
      expect(html).not.toContain("<aside");
      expect(html).toContain("formOnlyMain");
      expect(html).toContain('id="formular" tabindex="-1"');
      expect(html).not.toContain("window-section-detail.webp");
      expect(html).not.toContain("column-base-detail.webp");
      expect(html).not.toContain("terrace-detail.webp");
      expect(html).not.toContain("hero-detail.png");
      expect(html).toContain("authEntry");
    },
  );

  it("explică principiile comunității prin exemple, în contextul rolurilor", () => {
    const html = renderToStaticMarkup(createElement(Home));
    const start = html.indexOf('aria-labelledby="principles-title"');
    const principles = html.slice(start, html.indexOf("</section>", start));
    expect(start).toBeGreaterThan(html.indexOf('aria-labelledby="roles-title"'));
    expect(principles).toContain("Vezi cine spune, de ce spune și la ce se referă.");
    expect((principles.match(/<li>/g) ?? []).length).toBe(3);
    expect(principles).toContain("Andrei Popa");
    expect(principles).toContain("Executant");
    expect(principles).toContain("o explicație scrisă sau cu o schiță publicată");
    expect(principles).toContain('alt="Detaliul inițial al racordului terasă–atic"');
    expect(principles).toContain('alt="Schiță ilustrativă peste același racord"');
    expect(principles).toContain("Exemple ilustrative, cu persoane și texte fictive.");
    expect(principles).not.toContain("<button");
  });

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
  it("verify-request arată ca login/signup (header landing, fără footer)", () => {
    const html = renderToStaticMarkup(createElement(VerifyRequestPage));
    expect(html).toContain("authEntry");
    expect(html).toContain("Verifică-ți email-ul");
    expect(html).not.toContain("<footer");
    expect(html).not.toContain("hero-detail.png");
  });

  it("verify (după click pe link): conținut centrat, fără desenul animat și fără footer", async () => {
    const html = renderToStaticMarkup(
      await VerifyPage({
        searchParams: Promise.resolve({
          u: "https://detalia.ro/api/auth/callback/resend?token=abc",
        }),
      }),
    );
    expect(html).toContain("Te conectăm…");
    expect(html).toContain("centeredMain");
    expect(html).not.toContain("Desen schematic animat");
    expect(html).not.toContain("Pauză animație");
    expect(html).not.toContain("<footer");
  });

  it("login/signup: fără footer, același header ca landing-ul, logo egal în header și footer", async () => {
    const tagOf = (html: string, tag: string) =>
      html.slice(html.indexOf(`<${tag}`), html.indexOf(`</${tag}>`));
    const openTagsOf = (fragment: string) =>
      fragment.match(/<(header|div)[^>]*class="[^"]*"/g)?.slice(0, 2);
    const home = renderToStaticMarkup(createElement(Home));
    const homeHeader = tagOf(home, "header");
    expect(homeHeader).toContain('height="44"');
    expect(openTagsOf(homeHeader)).toHaveLength(2);
    expect(tagOf(home, "footer")).toContain('height="44"');
    // Sloganul stă sub logo, în același bloc, separat de linkurile din dreapta.
    expect(tagOf(home, "footer")).toMatch(
      /class="[^"]*footerBrand[^"]*">.*?alt="DETALIA".*?<span>Detalii de execuție\. Perspective asumate\.<\/span><\/div><nav/,
    );

    for (const page of [LoginPage, SignupPage]) {
      const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
      expect(html).not.toContain("<footer");
      const header = tagOf(html, "header");
      expect(header).toContain('height="44"');
      expect(openTagsOf(header)).toEqual(openTagsOf(homeHeader));
    }
  });

  it("header public: Ghid + cont + LinkedIn + GitHub, LinkedIn și în footer", () => {
    const html = renderToStaticMarkup(createElement(Home));
    const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    const footer = html.slice(html.indexOf("<footer"), html.indexOf("</footer>"));
    for (const part of [header, footer]) {
      expect(part).toContain('href="/ghid"');
      expect(part).toContain('href="https://www.linkedin.com/company/144903896/"');
      expect(part).toContain('rel="noopener noreferrer"');
      expect(part).not.toContain("/admin/");
    }
    expect(header).toContain('aria-label="DETALIA pe LinkedIn"');
    expect(header).toContain('href="https://github.com/TheDeveloper404/DETALIA"');
    // Butoanele de cont sunt în header pe toate paginile publice (landing + ghid).
    const ghid = renderToStaticMarkup(createElement(GhidPage));
    const ghidHeader = ghid.slice(ghid.indexOf("<header"), ghid.indexOf("</header>"));
    for (const part of [header, ghidHeader]) {
      expect(part).toContain('href="/login"');
      expect(part).toContain('href="/signup"');
    }
    // Meniul mobil (<details>) conține toată navigația: Ghid, cont, LinkedIn, GitHub.
    const mobile = header.slice(header.indexOf("<details"), header.indexOf("</details>"));
    expect(mobile).toContain('aria-label="Meniu"');
    for (const href of [
      "/ghid",
      "/login",
      "/signup",
      "https://www.linkedin.com/company/144903896/",
      "https://github.com/TheDeveloper404/DETALIA",
    ]) {
      expect(mobile).toContain(`href="${href}"`);
    }
    // Footer: și GitHub, nu doar LinkedIn.
    expect(footer).toContain('href="https://github.com/TheDeveloper404/DETALIA"');
  });

  it("ghid: fiecare link din navigație duce la o secțiune existentă", () => {
    const html = renderToStaticMarkup(createElement(GhidPage));
    expect(html).toContain("<h1>Cum funcționează DETALIA</h1>");
    const targets = new Set([...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]));
    const ids = new Set([...html.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1]));
    expect(ids.size).toBe(16);
    targets.delete("continut");
    for (const target of targets) expect(ids.has(target), target).toBe(true);
    expect(html).toContain('id="continut"');
  });
});
