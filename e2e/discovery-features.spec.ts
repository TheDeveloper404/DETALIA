import { encode } from "@auth/core/jwt";
import { SESSION_MAX_AGE_SECONDS } from "../lib/session-config";
import { expect, test } from "@playwright/test";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  categories,
  categoryFollows,
  comments,
  detailCategories,
  details,
  notifications,
  roles,
  sessions,
  sketches,
  userFollows,
  users,
} from "../db/schema";
import { addComment } from "../server/services/commentService";
import { getSeed } from "./seed";

let authorId: string,
  categoryId: string,
  detailIds: string[],
  title: string,
  otherTitle: string,
  authorName: string,
  categoryName: string;
test.beforeEach(async () => {
  const suffix = crypto.randomUUID();
  authorName = "Discovery Author " + suffix;
  categoryName = "Discovery Cat " + suffix;
  title = "Discovery " + suffix;
  otherTitle = title + " alt autor";
  const [author] = await db
    .insert(users)
    .values({ name: authorName, seenDetailTour: true, email: suffix + "@e2e-discovery.test" })
    .returning();
  authorId = author.id;
  await db.insert(roles).values({
    userId: authorId,
    roleMain: "PROIECTANT",
    subRole: "Arhitect",
    verificationStatus: "VERIFIED",
  });
  const [cat] = await db
    .insert(categories)
    .values({ name: categoryName, slug: suffix })
    .returning();
  categoryId = cat.id;
  const imageUrl = "/pwa-192.png";
  const rows = await db
    .insert(details)
    .values([
      { title, authorId, description: "Descriere export Discovery", imageUrl },
      { title: otherTitle, authorId: getSeed().testerUserId, imageUrl },
    ])
    .returning();
  detailIds = rows.map((r) => r.id);
  await db.insert(detailCategories).values(detailIds.map((detailId) => ({ detailId, categoryId })));
  await db
    .insert(sketches)
    .values({ detailId: detailIds[0], authorId: getSeed().testerUserId, status: "PUBLISHED" });
});
test.afterEach(async () => {
  if (!detailIds?.length) return;
  const rows = await db
    .select({ id: notifications.id, payload: notifications.payloadJson })
    .from(notifications)
    .where(inArray(notifications.recipientUserId, [authorId, getSeed().testerUserId]));
  const ids = rows
    .filter((r) => detailIds.includes((r.payload as { detailId?: string })?.detailId ?? ""))
    .map((r) => r.id);
  if (ids.length) await db.delete(notifications).where(inArray(notifications.id, ids));
  await db
    .delete(comments)
    .where(and(eq(comments.targetType, "DETAIL"), inArray(comments.targetId, detailIds)));
  await db.delete(sketches).where(inArray(sketches.detailId, detailIds));
  await db.delete(details).where(inArray(details.id, detailIds));
  await db.delete(categoryFollows).where(eq(categoryFollows.categoryId, categoryId));
  await db.delete(categories).where(eq(categories.id, categoryId));
  await db.delete(userFollows).where(eq(userFollows.followedUserId, authorId));
  await db.delete(roles).where(eq(roles.userId, authorId));
  await db.delete(sessions).where(eq(sessions.userId, authorId));
  await db.delete(users).where(eq(users.id, authorId));
  detailIds = [];
});

// **Urmarire:** userul poate urmari/opri urmarirea unui user sau a unei categorii; setarea aceleiasi stari repetat nu o inverseaza. In „Filtre”, „Oameni urmăriți” arata detaliile autorilor urmariti, „Categorii urmărite” pe cele din categoriile urmarite; ambele bifate = oricare dintre ele, cu vizibilitatea si ordinea cronologica existente. Identitatea unui autor anonimizat nu poate fi dedusa prin filtrul de oameni urmariti.
test("follow/unfollow user si categorie controleaza feed-ul Urmariti", async ({ page }) => {
  const follow = page.getByRole("button", { name: "Urmărește", exact: true });
  const unfollow = page.getByRole("button", { name: "Anulează urmărirea", exact: true });
  await page.goto("/profile/" + authorId);
  await follow.click();
  await expect(unfollow).toBeVisible();
  await page.goto("/feed?following=1&q=" + encodeURIComponent(title));
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: otherTitle, exact: true })).toHaveCount(0);
  await page.goto("/profile/" + authorId);
  await unfollow.click();
  await expect(follow).toBeVisible();
  await page.goto("/feed?following=1&q=" + encodeURIComponent(title));
  await expect(page.getByRole("heading", { name: title, exact: true })).toHaveCount(0);
  await page.goto("/feed?cat=" + categoryId + "&q=" + encodeURIComponent(title));
  await expect(page.getByRole("heading", { name: categoryName, exact: true })).toBeVisible();
  await follow.click();
  await expect(unfollow).toBeVisible();
  const filters = page.getByRole("button", { name: /^Filtre/ });
  const people = page.getByRole("checkbox", { name: "Oameni urmăriți", exact: true });
  const categories = page.getByRole("checkbox", { name: "Categorii urmărite", exact: true });
  const apply = page.getByRole("button", { name: "Aplică", exact: true });
  await filters.click();
  await categories.check();
  await apply.click();
  await expect(page).toHaveURL((url) => url.searchParams.get("followcat") === "1");
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: otherTitle, exact: true })).toBeVisible();
  // Categoria urmarita nu apare la „Oameni urmăriți" (autorul nu mai e urmarit).
  await filters.click();
  await categories.uncheck();
  await people.check();
  await apply.click();
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("following") === "1" && !url.searchParams.has("followcat"),
  );
  await expect(page.getByRole("heading", { name: title, exact: true })).toHaveCount(0);
  await page.goto("/feed?followcat=1&cat=" + categoryId + "&q=" + encodeURIComponent(title));
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await unfollow.click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toHaveCount(0);
});

// **Cautare avansata** (meniul „Filtre", 2026-10-28): „Oameni urmăriți", „Categorii urmărite", „Așteaptă ajutor", rolul autorului si judetul detaliului se combina cu cautarea si categoria; rezultatele si paginarea folosesc aceleasi conditii. Rolul urmeaza ceea ce se afiseaza, inclusiv snapshot-ul autorului retras. Judetul e optional la publicare, doar pentru detaliile din Romania; un detaliu fara judet apare doar cand nu e ales niciun judet.
test("filtrele se aplica o data, se combina cu cautarea si se reseteaza", async ({ page }) => {
  await page.goto("/feed?cat=" + categoryId + "&q=" + encodeURIComponent(title));
  const filters = page.getByRole("button", { name: /^Filtre/ });
  const role = page.getByRole("combobox", { name: "Rol autor", exact: true });
  const county = page.getByRole("combobox", { name: "Județ", exact: true });
  const apply = page.getByRole("button", { name: "Aplică", exact: true });
  // Focusul intra in panou si revine pe „Filtre" la inchidere.
  await filters.click();
  await expect(page.getByRole("dialog", { name: "Filtre" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(filters).toBeFocused();
  // Nimic nu se schimba pana la „Aplică".
  await filters.click();
  await role.selectOption("PROIECTANT");
  await expect(role).toHaveValue("PROIECTANT");
  expect(new URL(page.url()).searchParams.has("role")).toBe(false);
  await apply.click();
  await expect(page).toHaveURL((url) => url.searchParams.get("role") === "PROIECTANT");
  await expect(page.getByRole("button", { name: "Filtre, 1 active", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  // „Resetează" din panou goleste filtrele, dar pastreaza cautarea si categoria.
  await filters.click();
  await page.getByRole("button", { name: "Resetează", exact: true }).click();
  await apply.click();
  await expect(page).toHaveURL(
    (url) =>
      !url.searchParams.has("role") &&
      url.searchParams.get("cat") === categoryId &&
      url.searchParams.get("q") === title,
  );
  // Judetul: detaliul fara judet dispare la un judet ales.
  await filters.click();
  await role.selectOption("PROIECTANT");
  await county.selectOption("Cluj");
  await apply.click();
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("role") === "PROIECTANT" && url.searchParams.get("judet") === "Cluj",
  );
  await expect(page.getByRole("heading", { name: title, exact: true })).toHaveCount(0);
  await page
    .getByRole("searchbox", { name: "Caută detalii", exact: true })
    .fill(title + " inexistent");
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get("q") === title + " inexistent" &&
      url.searchParams.get("cat") === categoryId &&
      url.searchParams.get("judet") === "Cluj" &&
      url.searchParams.get("role") === "PROIECTANT",
  );
  await expect(page.getByRole("button", { name: "Filtre, 2 active", exact: true })).toBeVisible();
  // Panoul redeschis arata filtrele aplicate; scoaterea judetului se aplica tot la „Aplică".
  await filters.click();
  await expect(county).toHaveValue("Cluj");
  await county.selectOption("");
  await apply.click();
  await expect(page).toHaveURL(
    (url) => !url.searchParams.has("judet") && url.searchParams.get("role") === "PROIECTANT",
  );
  await expect(page.getByRole("button", { name: "Filtre, 1 active", exact: true })).toBeVisible();
});

// **Cautare avansata** (meniul „Filtre", 2026-10-28): „Oameni urmăriți", „Categorii urmărite", „Așteaptă ajutor", rolul autorului si judetul detaliului se combina cu cautarea si categoria; rezultatele si paginarea folosesc aceleasi conditii. Rolul urmeaza ceea ce se afiseaza, inclusiv snapshot-ul autorului retras. Judetul e optional la publicare, doar pentru detaliile din Romania; un detaliu fara judet apare doar cand nu e ales niciun judet.
test("filtrele fara rezultate spun ca nimic nu corespunde filtrelor", async ({ page }) => {
  await page.goto("/feed?cat=" + categoryId + "&role=BENEFICIAR");
  await expect(
    page.getByRole("heading", { name: "Niciun detaliu nu corespunde filtrelor", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Schimbă sau scoate filtrele ca să vezi mai multe detalii.", { exact: true }),
  ).toBeVisible();
});

// **Notificari la comentarii/reply:** autorul continutului, autorul radacinii firului si autorul comentariului caruia i se raspunde primesc notificarea o singura data fiecare; actorul nu se notifica singur. Exclusiv in-app, fara extras din comentariu; accesul se verifica si pentru destinatar. La citire, notificarile noi se omit daca discutia nu mai este vizibila ori comentariul/tinta a disparut.
test("comentariu real si reply genereaza notificare cu link la comentariu", async ({
  page,
  baseURL,
}) => {
  const url = new URL(baseURL!);
  const secure = url.protocol === "https:";
  const cookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
  const sid = crypto.randomUUID();
  const expires = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  await db
    .insert(sessions)
    .values({ sessionToken: sid, userId: authorId, expires: new Date(expires) });
  const token = await encode({
    secret: process.env.AUTH_SECRET!,
    salt: cookieName,
    maxAge: SESSION_MAX_AGE_SECONDS,
    token: { sid, sub: authorId, id: authorId, status: "ACTIVE", name: authorName },
  });
  await page.context().addCookies([
    {
      name: cookieName,
      value: token,
      domain: url.hostname,
      path: "/",
      expires: Math.floor(expires / 1000),
      httpOnly: true,
      secure,
      sameSite: "Lax",
    },
  ]);
  const body = "Comentariu " + title;
  await page.goto("/details/" + detailIds[0]);
  await page
    .getByPlaceholder("Adaugă la dezbatere — părerea ta apare cu rolul tău lângă nume…", {
      exact: true,
    })
    .fill(body);
  await page.getByRole("button", { name: "Comentează", exact: true }).click();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
  const [root] = await db
    .select()
    .from(comments)
    .where(and(eq(comments.targetId, detailIds[0]), eq(comments.body, body)));
  expect(root?.authorId).toBe(authorId);
  const replyBody = "Reply " + title;
  expect(
    await addComment({
      userId: getSeed().testerUserId,
      targetType: "DETAIL",
      targetId: detailIds[0],
      body: replyBody,
      parentCommentId: root.id,
    }),
  ).toEqual({ ok: true });
  const [reply] = await db
    .select()
    .from(comments)
    .where(and(eq(comments.targetId, detailIds[0]), eq(comments.body, replyBody)));
  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(eq(notifications.recipientUserId, authorId), eq(notifications.type, "COMMENT_REPLIED")),
    );
  const row = rows.find((r) => (r.payloadJson as { commentId?: string })?.commentId === reply.id)!;
  expect(row).toBeTruthy();
  await page.goto("/notifications");
  const notification = page.getByTestId("notification-" + row.id);
  await expect(
    notification.getByText("Ai un răspuns nou în discuția de la „" + title + "”.", { exact: true }),
  ).toBeVisible();
  await notification.getByRole("link").click();
  await expect(page).toHaveURL(
    (url) => url.pathname === "/details/" + detailIds[0] && url.hash === "#comment-" + reply.id,
  );
  await expect(page.locator("#comment-" + reply.id)).toContainText(replyBody);
});

// **Export PDF:** vizualizare autentificata pentru tiparire cu imaginea de baza, metadatele si resursele detaliului; userul alege salvarea PDF in dialogul browserului. Aceleasi reguli de acces si anonimizare ca la detaliu.
test("pagina PDF reda detaliul, butonul cere print si controalele dispar la tiparire", async ({
  page,
}) => {
  await page.goto("/details/" + detailIds[0] + "/pdf");
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(page.getByText("Descriere export Discovery", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.print = () => {
      document.documentElement.dataset.printRequested = "yes";
    };
  });
  await page.getByRole("button", { name: "Salvează PDF", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-print-requested", "yes");
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Salvează PDF", exact: true })).toBeHidden();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
});

// **PWA:** aplicatie instalabila pe telefon, cu acces online; fara continut privat salvat offline, push sau sincronizare in fundal.
test("manifest si worker instalabil fara Cache Storage", async ({ page }) => {
  await page.goto("/feed");
  const response = await page.request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192" }),
      expect.objectContaining({ sizes: "512x512" }),
    ]),
  );
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration("/");
        return registration?.active?.scriptURL.endsWith("/sw.js") ?? false;
      }),
    )
    .toBe(true);
  const sw = await page.request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-store");
  expect(await page.evaluate(() => caches.keys())).toEqual([]);
});

// **Cautare avansata** (meniul „Filtre", 2026-10-28): „Oameni urmăriți", „Categorii urmărite", „Așteaptă ajutor", rolul autorului si judetul detaliului se combina cu cautarea si categoria; rezultatele si paginarea folosesc aceleasi conditii. Rolul urmeaza ceea ce se afiseaza, inclusiv snapshot-ul autorului retras. Judetul e optional la publicare, doar pentru detaliile din Romania; un detaliu fara judet apare doar cand nu e ales niciun judet.
test("paginarea pastreaza follow, categorie, rol si judet", async ({ page }) => {
  const term = "Pagination " + crypto.randomUUID();
  const rows = await db
    .insert(details)
    .values(
      Array.from({ length: 51 }, (_, i) => ({
        authorId,
        title: term + " " + i,
        imageUrl: "/pwa-192.png",
        county: "Cluj",
      })),
    )
    .returning();
  const ids = rows.map((r) => r.id);
  detailIds.push(...ids);
  await db.insert(detailCategories).values(ids.map((detailId) => ({ detailId, categoryId })));
  await db
    .insert(userFollows)
    .values({ followerUserId: getSeed().testerUserId, followedUserId: authorId });
  const params = new URLSearchParams({
    q: term,
    cat: categoryId,
    role: "PROIECTANT",
    judet: "Cluj",
    following: "1",
  });
  await page.goto("/feed?" + params.toString());
  await expect(page.locator("main article")).toHaveCount(50);
  await page.getByRole("link", { name: "Pagina următoare", exact: true }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get("page") === "2" &&
      [...params].every(([k, v]) => url.searchParams.get(k) === v),
  );
  await expect(page.locator("main article")).toHaveCount(1);
});
