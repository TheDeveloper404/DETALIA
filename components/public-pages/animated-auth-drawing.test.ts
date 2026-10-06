import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

import { AnimatedAuthDrawing } from "@/components/public-pages/animated-auth-drawing";

describe("Desenul SVG de pe login/signup", () => {
  it("are titlu/descriere legate, control de pauză și geometrie nativă, fără raster", () => {
    const html = renderToStaticMarkup(createElement(AnimatedAuthDrawing));
    const svgId = html.match(/<svg id="([^"]+)"/)?.[1];
    expect(svgId).toBeTruthy();
    expect(html).toContain(`aria-controls="${svgId}"`);
    expect(html).toContain('role="img"');
    const labelIds = html.match(/aria-labelledby="([^"]+)"/)?.[1].split(" ");
    expect(labelIds).toHaveLength(2);
    for (const id of labelIds ?? []) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('type="button"');
    expect(html).toContain("Pauză animație");
    expect(html).toContain('data-paused="false"');
    expect(html).toContain('pathLength="1"');
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<image");
    expect(html).toContain("Exemplu ilustrativ, nu soluție tehnică de execuție.");
  });

  it("păstrează ordinea contur → hașuri → cote → racord", () => {
    const html = renderToStaticMarkup(createElement(AnimatedAuthDrawing));
    const stages = html.slice(html.indexOf("<ol"));
    const positions = ["Contur", "Hașuri", "Cote", "Racord"].map((name) => stages.indexOf(name));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("nu repetă ID-urile SVG când există două desene în aceeași pagină", () => {
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(AnimatedAuthDrawing),
        createElement(AnimatedAuthDrawing),
      ),
    );
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("CSS-ul oprește toate straturile și arată starea finală în reduced motion", () => {
    const css = postcss.parse(
      readFileSync("components/public-pages/auth-experience.module.css", "utf8"),
    );
    const reduced = css.nodes.find(
      (node) =>
        node.type === "atrule" &&
        node.name === "media" &&
        node.params === "(prefers-reduced-motion: reduce)",
    );
    expect(reduced?.type).toBe("atrule");
    if (!reduced || reduced.type !== "atrule") throw new Error("Lipsește reduced motion");
    const rules = new Map<string, Map<string, string>>();
    reduced.walkRules((rule) => {
      const declarations = new Map<string, string>();
      rule.walkDecls((declaration) => {
        declarations.set(declaration.prop, declaration.value);
      });
      rules.set(rule.selector, declarations);
    });
    const drawing =
      rules.get(".drawing .line, .drawing .jointPoint") ??
      rules.get(".drawing .line,\n  .drawing .jointPoint");
    expect(drawing?.get("animation")).toBe("none");
    expect(drawing?.get("stroke-dashoffset")).toBe("0");
    expect(drawing?.get("opacity")).toBe("1");
    expect(rules.get(".motionControl")?.get("display")).toBe("none");
    expect(rules.get(".reducedMotionCaption")?.get("display")).toBe("inline");
    let pauseRule = false;
    css.walkRules((rule) => {
      if (rule.selector.includes('[data-paused="true"]')) {
        rule.walkDecls("animation-play-state", (declaration) => {
          pauseRule = declaration.value === "paused";
        });
      }
    });
    expect(pauseRule).toBe(true);
  });
});
