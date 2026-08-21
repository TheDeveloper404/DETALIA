import { describe, expect, it } from "vitest";

import { findViolations } from "./visibility-guard-check.lib.mjs";

describe("findViolations — gardă vizibilitate detalii de proiect (invariant transversal)", () => {
  it("prinde o funcție nouă care citește details fără nicio gardă de scopare", () => {
    const source = `
      export async function listNewRail(limit: number) {
        return db.select().from(details).where(eq(details.status, "PUBLISHED")).limit(limit);
      }
    `;
    const violations = findViolations(source);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ functionName: "listNewRail" });
  });

  it("nu flagează funcțiile deja gărzuite cu isNull(details.projectId)", () => {
    const source = `
      export async function listFeed(input: { limit: number }) {
        const conds = [eq(details.status, "PUBLISHED"), isNull(details.projectId)];
        return db.select().from(details).where(and(...conds));
      }
    `;
    expect(findViolations(source)).toHaveLength(0);
  });

  it("nu flagează gardul prin SQL raw (pattern usersRepo.listTopAuthors)", () => {
    const source = `
      export async function listTopAuthors(limit: number) {
        const detailCount = sql\`(select count(*)::int from \${details}
           where \${details.authorId} = \${users.id} and \${details.projectId} is null)\`;
        return db.select({ detailCount }).from(users).where(sql\`\${detailCount} > 0\`);
      }
    `;
    expect(findViolations(source)).toHaveLength(0);
  });

  it("nu flagează gardul prin hasProjectAccessForUser (pattern listSavedDetails)", () => {
    const source = `
      export async function listSavedDetails(userId: string) {
        return db.select().from(details).where(hasProjectAccessForUser(userId));
      }
    `;
    expect(findViolations(source)).toHaveLength(0);
  });

  it("nu flagează scopare explicită pe UN proiect (pattern listProjectDetails, gate e la service)", () => {
    const source = `
      export async function listProjectDetails(projectId: string) {
        return db.select().from(details).where(and(eq(details.status, "PUBLISHED"), eq(details.projectId, projectId)));
      }
    `;
    expect(findViolations(source)).toHaveLength(0);
  });

  it("nu flagează polaritatea inversă 'is not null' (pattern targetNotInProject)", () => {
    const source = `
      function targetNotInProject(outerTable: string) {
        return sql\`not exists (select 1 from \${details} where \${details.projectId} is not null)\`;
      }
    `;
    expect(findViolations(source)).toHaveLength(0);
  });

  it("nu flagează funcții care nu ating deloc tabela details", () => {
    const source = `
      export async function getUserContact(userId: string) {
        return db.select().from(users).where(eq(users.id, userId));
      }
    `;
    expect(findViolations(source)).toHaveLength(0);
  });

  it("prinde mai multe funcții independent, în același fișier", () => {
    const source = `
      export async function listA(limit: number) {
        return db.select().from(details).limit(limit);
      }
      export function listB(limit: number) {
        return db.select().from(details).limit(limit);
      }
    `;
    const violations = findViolations(source);
    expect(violations).toHaveLength(2);
    expect(violations.map((v) => v.functionName)).toEqual(["listA", "listB"]);
  });
});
