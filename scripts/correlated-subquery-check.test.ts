import { describe, expect, it } from "vitest";

import { findViolations } from "./correlated-subquery-check.lib.mjs";

describe("findViolations — gardă subquery corelat necalificat", () => {
  it("prinde exact bug-ul istoric: coloană a tabelului exterior necalificată într-un subquery corelat", () => {
    const source = `
      const badCount = sql\`(select count(*)::int from \${validations}
         where \${validations.targetType} = 'DETAIL' and \${validations.targetId} = \${details.id})\`;
    `;
    const violations = findViolations(source);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ ownTable: "validations", table: "details", column: "id" });
  });

  it("nu flagează referințe la propriul tabel al subquery-ului (fals-pozitiv evitat)", () => {
    const source = `
      const okCount = sql\`(select count(*)::int from \${validations}
         where \${validations.targetType} = 'DETAIL' and \${validations.targetId} = \${detailsId})\`;
    `;
    expect(findViolations(source)).toHaveLength(0);
  });

  it("ignoră fragmentele sql fără select+from (nu sunt subquery corelat)", () => {
    const source = "const flag = sql`${details.title} ilike ${term}`;";
    expect(findViolations(source)).toHaveLength(0);
  });

  it("nu flagează o constantă pre-calificată (fără punct, ex. ${detailsId})", () => {
    const source = `
      const detailsId = sql\`\${sql.identifier("details")}.\${sql.identifier("id")}\`;
      const okCount = sql\`(select count(*)::int from \${comments} where \${comments.targetId} = \${detailsId})\`;
    `;
    expect(findViolations(source)).toHaveLength(0);
  });

  it("union all: fiecare braț își referă legitim propriul tabel → zero fals-pozitive", () => {
    const source = `
      const rows = sql\`(
        select \${validations.userId} as uid from \${validations} where \${validations.targetId} = \${detailsId}
        union all
        select \${comments.authorId} as uid from \${comments} where \${comments.targetId} = \${detailsId}
        union all
        select \${sketches.authorId} as uid from \${sketches} where \${sketches.detailId} = \${detailsId}
      )\`;
    `;
    expect(findViolations(source)).toHaveLength(0);
  });

  it("union all: un braț referă necalificat coloana ALTUI tabel (nu al lui, nu al vreunui braț) → flagat", () => {
    const source = `
      const rows = sql\`(
        select \${validations.userId} from \${validations} where \${validations.targetId} = \${details.id}
        union all
        select \${comments.authorId} from \${comments} where \${comments.targetId} = \${detailsId}
      )\`;
    `;
    const violations = findViolations(source);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ table: "details", column: "id" });
  });

  it("union all: un braț referă un tabel introdus DOAR de alt braț → flagat (scope pe braț, nu pe template)", () => {
    const source = `
      const rows = sql\`(
        select \${validations.userId} from \${validations} where \${validations.targetId} = \${comments.id}
        union all
        select \${comments.authorId} from \${comments} where \${comments.targetId} = \${detailsId}
      )\`;
    `;
    const violations = findViolations(source);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ table: "comments", column: "id", ownTable: "validations" });
  });

  it("prinde mai multe subquery-uri corelate independent, în același fișier", () => {
    const source = `
      const a = sql\`(select count(*)::int from \${validations} where \${validations.targetId} = \${details.id})\`;
      const b = sql\`(select count(*)::int from \${sketches} where \${sketches.authorId} = \${users.id})\`;
    `;
    const violations = findViolations(source);
    expect(violations).toHaveLength(2);
    expect(violations.map((v) => v.ownTable)).toEqual(["validations", "sketches"]);
  });
});
