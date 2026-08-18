import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Matrice de regresie pe invariantul „un detaliu de proiect (projectId != null) NU apare NICIODATĂ pe
// nicio cale de citire PUBLICĂ" — vezi CLAUDE.md §„Un invariant transversal nou nu produce un bug, ci
// câte unul în fiecare loc care nu trece prin poartă" (14 goluri găsite manual, 2026-08-09, feature
// „Proiect": feed, profil, rail-uri de autori, statistici, toate cu propriul `isNull(details.projectId)`
// repetat separat — niciun choke point comun). Un test per funcție ar fi echivalentul manual care a
// ratat de 14 ori; testul de aici seedează UN SINGUR set de date (1 detaliu public + 1 de proiect,
// același autor) și verifică toate căile de citire publice dintr-o dată, ca regresia să nu poată reapărea
// pe o cale nouă fără să pice cel puțin o assertion de-aici.
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  const schema = await import("@/db/schema");
  const { db } = await createTestDb();
  return { db, schema };
});

const { db } = await import("@/db");
const { details, users, projects, validations, comments, sketches } = await import("@/db/schema");
const { listFeed, countPublishedDetails } = await import("./detailsRepo");
const { listTopAuthors } = await import("./usersRepo");
const { listAuthorDetails, listAuthorSketches, getContributionCounts, getProfileStats } = await import(
  "./profileRepo"
);

async function makeUser(email: string) {
  const [row] = await db.insert(users).values({ email }).returning({ id: users.id });
  return row.id;
}

describe("Vizibilitate detalii de proiect — nu trebuie să apară pe NICIO cale publică", () => {
  let author: string;
  let voter: string;
  let publicDetailId: string;
  let projectDetailId: string;

  beforeAll(async () => {
    author = await makeUser("proj-vis-author@test.local");
    voter = await makeUser("proj-vis-voter@test.local");

    const [project] = await db
      .insert(projects)
      // Placeholder de fixture, NU un secret real — coloana e doar NOT NULL, valoarea n-are semnificație în acest test.
      .values({ ownerId: author, name: "Proiect privat", inviteToken: "fixture-placeholder-not-a-secret" })
      .returning({ id: projects.id });

    const [pub] = await db
      .insert(details)
      .values({ title: "Detaliu public", authorId: author })
      .returning({ id: details.id });
    publicDetailId = pub.id;

    const [prj] = await db
      .insert(details)
      .values({ title: "Detaliu de proiect", authorId: author, projectId: project.id })
      .returning({ id: details.id });
    projectDetailId = prj.id;

    // Interacțiuni SIMETRICE pe ambele detalii — dacă poarta lipsește pe vreo cale, cele două rânduri ar
    // ieși identice (sau cel de proiect ar apărea deloc) în loc de „doar publicul e vizibil".
    for (const targetId of [publicDetailId, projectDetailId]) {
      await db.insert(validations).values({ userId: voter, targetType: "DETAIL", targetId, position: "APPROVE" });
      await db.insert(comments).values({ targetType: "DETAIL", targetId, authorId: voter, body: "comentariu" });
      // Autor DIFERIT de al detaliului — listAuthorSketches exclude intenționat self-sketch-urile
      // (vezi comentariul din profileRepo.ts: „RĂMÂNE pe identitate", nu se numără ca „schiță trimisă").
      await db.insert(sketches).values({ detailId: targetId, authorId: voter, status: "PUBLISHED" });
    }
  });

  afterAll(async () => {
    await db.delete(sketches);
    await db.delete(comments);
    await db.delete(validations);
    await db.delete(details);
    await db.delete(projects);
    await db.delete(users);
  });

  it("listFeed: doar detaliul public", async () => {
    const rows = await listFeed({ limit: 10 });
    expect(rows.map((r) => r.id)).toContain(publicDetailId);
    expect(rows.map((r) => r.id)).not.toContain(projectDetailId);
  });

  it("countPublishedDetails: numără doar publicul", async () => {
    expect(await countPublishedDetails()).toBe(1);
  });

  it("listTopAuthors: contorul autorului nu include detaliul de proiect", async () => {
    const rows = await listTopAuthors(10);
    const row = rows.find((r) => r.id === author);
    expect(row?.detailCount).toBe(1);
  });

  it("profileRepo.listAuthorDetails: doar publicul, pe tab-ul de profil", async () => {
    const rows = await listAuthorDetails(author);
    expect(rows.map((r) => r.id)).toEqual([publicDetailId]);
  });

  it("profileRepo.listAuthorSketches: schița de pe detaliul de proiect nu apare", async () => {
    const rows = await listAuthorSketches(voter);
    expect(rows.map((r) => r.detailId)).toEqual([publicDetailId]);
  });

  it("profileRepo.getProfileStats: `published` numără doar detaliul public", async () => {
    const stats = await getProfileStats(author);
    expect(stats.published).toBe(1);
  });

  it("profileRepo.getContributionCounts: heatmap-ul public nu se aprinde din activitatea de proiect", async () => {
    const since = new Date(0);
    const map = await getContributionCounts(author, since);
    const total = [...map.values()].reduce((a, b) => a + b, 0);
    // Autorul a creat 2 detalii (unul public, unul de proiect) — doar cel PUBLIC trebuie să aprindă
    // heatmap-ul.
    expect(total).toBe(1);
  });
});
