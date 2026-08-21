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
const {
  details,
  users,
  projects,
  projectMembers,
  savedDetails,
  supplierOffers,
  validations,
  comments,
  sketches,
  notifications,
} = await import("@/db/schema");
const { listFeed, countPublishedDetails, listSavedDetails, listOfferedDetails } = await import("./detailsRepo");
const { listTopAuthors } = await import("./usersRepo");
const { listAuthorDetails, listAuthorSketches, getContributionCounts, getProfileStats } = await import(
  "./profileRepo"
);
const { getPublicSketchTeaser } = await import("./sketchesRepo");
const { getNotifications } = await import("@/server/services/notificationService");
const { insertNotification } = await import("./notificationsRepo");

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

// SEC-D01 (audit securitate 2026-08-20): `hasProjectAccessForUser` (detailsRepo.ts) e corect scris și
// aplicat pe listSavedDetails/listOfferedDetails, dar rămăsese fără test de regresie — spre deosebire
// de căile PUBLICE de mai sus. Riscul concret: predicatul trăiește în clauza WHERE (nu în lista de
// SELECT), deci coloanele necalificate din subquery-urile corelate (`project_members.project_id`)
// rămân sigure azi (verificat direct în sursa Drizzle instalată) — DAR dacă cineva îl mută vreodată în
// SELECT (cum s-a întâmplat recidivant cu sketchCount/commentCount), corelarea devine mereu adevărată
// silențios, fără eroare SQL, și un membru eliminat și-ar recăpăta acces la listele lui private.
describe("Vizibilitate proiect pe listele PRIVATE — /saved și Ofertele mele (SEC-D01)", () => {
  let owner: string;
  let removedMember: string;
  let publicDetailId: string;
  let projectDetailId: string;

  beforeAll(async () => {
    owner = await makeUser("proj-priv-owner@test.local");
    removedMember = await makeUser("proj-priv-removed@test.local");

    const [project] = await db
      .insert(projects)
      .values({ ownerId: owner, name: "Proiect privat D01", inviteToken: "fixture-placeholder-not-a-secret" })
      .returning({ id: projects.id });

    // Membru ADĂUGAT apoi ELIMINAT (removedAt setat) — exact scenariul din care a pornit invariantul.
    await db.insert(projectMembers).values({ projectId: project.id, userId: removedMember, removedAt: new Date() });

    const [pub] = await db
      .insert(details)
      .values({ title: "Detaliu public D01", authorId: owner })
      .returning({ id: details.id });
    publicDetailId = pub.id;

    const [prj] = await db
      .insert(details)
      .values({ title: "Detaliu de proiect D01", authorId: owner, projectId: project.id })
      .returning({ id: details.id });
    projectDetailId = prj.id;

    // Fostul membru a salvat/ofertat AMBELE detalii cât încă avea acces.
    for (const detailId of [publicDetailId, projectDetailId]) {
      await db.insert(savedDetails).values({ userId: removedMember, detailId });
      await db.insert(supplierOffers).values({ userId: removedMember, detailId });
    }
  });

  afterAll(async () => {
    await db.delete(supplierOffers);
    await db.delete(savedDetails);
    await db.delete(details);
    await db.delete(projectMembers);
    await db.delete(projects);
    await db.delete(users);
  });

  it("listSavedDetails: membrul eliminat nu mai vede detaliul de proiect salvat anterior", async () => {
    const rows = await listSavedDetails(removedMember);
    expect(rows.map((r) => r.id)).toEqual([publicDetailId]);
  });

  it("listOfferedDetails: membrul eliminat nu mai vede oferta pe detaliul de proiect", async () => {
    const rows = await listOfferedDetails(removedMember);
    expect(rows.map((r) => r.id)).toEqual([publicDetailId]);
  });
});

// Cele două căi rămase, documentate ca neacoperite în CLAUDE.md §„Un invariant transversal nou..."
// până acum (/s/[id] și notify*) — ambele deja gărzuite în cod (2026-08-09 / SEC-011 2026-08-11),
// dar fără test de regresie propriu. Adăugate aici, nu redesign — invariantul ține deja.
describe("Vizibilitate proiect pe /s/[id] (teaser public de schiță)", () => {
  let author: string;
  let publicSketchId: string;
  let projectSketchId: string;

  beforeAll(async () => {
    author = await makeUser("proj-vis-sketch-author@test.local");

    const [project] = await db
      .insert(projects)
      .values({ ownerId: author, name: "Proiect schiță", inviteToken: "fixture-placeholder-not-a-secret" })
      .returning({ id: projects.id });

    const [pub] = await db
      .insert(details)
      .values({ title: "Detaliu public pt schiță", authorId: author })
      .returning({ id: details.id });

    const [prj] = await db
      .insert(details)
      .values({ title: "Detaliu de proiect pt schiță", authorId: author, projectId: project.id })
      .returning({ id: details.id });

    const [pubSketch] = await db
      .insert(sketches)
      .values({ detailId: pub.id, authorId: author, status: "PUBLISHED", thumbnailUrl: "https://x/pub.png" })
      .returning({ id: sketches.id });
    publicSketchId = pubSketch.id;

    const [prjSketch] = await db
      .insert(sketches)
      .values({ detailId: prj.id, authorId: author, status: "PUBLISHED", thumbnailUrl: "https://x/prj.png" })
      .returning({ id: sketches.id });
    projectSketchId = prjSketch.id;
  });

  afterAll(async () => {
    await db.delete(sketches);
    await db.delete(details);
    await db.delete(projects);
    await db.delete(users);
  });

  it("schița pe detaliu public e vizibilă pe teaser", async () => {
    const row = await getPublicSketchTeaser(publicSketchId);
    expect(row?.id).toBe(publicSketchId);
  });

  it("schița pe detaliu de proiect NU e vizibilă pe teaser-ul public, indiferent de viewer", async () => {
    const row = await getPublicSketchTeaser(projectSketchId);
    expect(row).toBeNull();
  });
});

describe("Vizibilitate proiect pe notify* — titlul se ascunde dacă destinatarul pierde accesul (SEC-011)", () => {
  let owner: string;
  let removedMember: string;
  let publicDetailId: string;
  let projectDetailId: string;

  beforeAll(async () => {
    owner = await makeUser("proj-vis-notif-owner@test.local");
    removedMember = await makeUser("proj-vis-notif-removed@test.local");

    const [project] = await db
      .insert(projects)
      .values({ ownerId: owner, name: "Proiect notif", inviteToken: "fixture-placeholder-not-a-secret" })
      .returning({ id: projects.id });

    await db.insert(projectMembers).values({ projectId: project.id, userId: removedMember, removedAt: new Date() });

    const [pub] = await db
      .insert(details)
      .values({ title: "Detaliu public notif", authorId: owner })
      .returning({ id: details.id });
    publicDetailId = pub.id;

    const [prj] = await db
      .insert(details)
      .values({ title: "Detaliu de proiect notif", authorId: owner, projectId: project.id })
      .returning({ id: details.id });
    projectDetailId = prj.id;

    // Notificări primite de fostul membru CÂT ÎNCĂ AVEA acces (ex. a fost adăugat ca "SKETCH_PROPOSED").
    await insertNotification({
      recipientUserId: removedMember,
      type: "SKETCH_PROPOSED",
      payloadJson: { detailId: publicDetailId, detailTitle: "Detaliu public notif" },
    });
    await insertNotification({
      recipientUserId: removedMember,
      type: "SKETCH_PROPOSED",
      payloadJson: { detailId: projectDetailId, detailTitle: "Detaliu de proiect notif" },
    });
  });

  afterAll(async () => {
    await db.delete(notifications);
    await db.delete(details);
    await db.delete(projectMembers);
    await db.delete(projects);
    await db.delete(users);
  });

  it("titlul detaliului public rămâne vizibil", async () => {
    const rows = await getNotifications(removedMember);
    const row = rows.find((r) => (r.payloadJson as { detailId?: string }).detailId === publicDetailId);
    expect((row?.payloadJson as { detailTitle?: string }).detailTitle).toBe("Detaliu public notif");
  });

  it("titlul detaliului de proiect e ascuns după eliminarea din proiect", async () => {
    const rows = await getNotifications(removedMember);
    const row = rows.find((r) => (r.payloadJson as { detailId?: string }).detailId === projectDetailId);
    expect((row?.payloadJson as { detailTitle?: string }).detailTitle).toBe("un detaliu la care nu mai ai acces");
  });
});
