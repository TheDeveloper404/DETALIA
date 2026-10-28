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

// **Urmarire:** userul poate urmari/opri urmarirea unui user sau a unei categorii; setarea aceleiasi stari repetat nu o inverseaza. Filtrul „Urmariti” include detaliile unui autor urmarit SAU ale unei categorii urmarite, cu vizibilitatea si ordinea cronologica existente. Identitatea unui autor anonimizat nu poate fi dedusa prin filtrul de user urmarit.
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
  await page.getByRole("button", { name: /^Filtre/ }).click();
  await page.getByRole("checkbox", { name: "Doar ce urmăresc", exact: true }).check();
  await expect(page).toHaveURL((url) => url.searchParams.get("following") === "1");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: otherTitle, exact: true })).toBeVisible();
  await unfollow.click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toHaveCount(0);
});

// **Cautare avansata:** filtrele de rol al autorului, categorie, rol verificat si existenta schitelor se combina cu cautarea si „Urmariti”; rezultatele si paginarea folosesc aceleasi conditii. Rolul/verificarea urmeaza ceea ce se afiseaza, inclusiv snapshot-ul autorului retras; schitele ascunse si adnotarile nu satisfac filtrul „cu schite”.
test("cautarea avansata combina filtrele si le pastreaza la toggle/cautare", async ({ page }) => {
  await page.goto("/feed?cat=" + categoryId + "&q=" + encodeURIComponent(title));
  await page.getByRole("button", { name: "Filtre", exact: true }).click();
  await page.getByRole("combobox", { name: "Rol autor", exact: true }).selectOption("PROIECTANT");
  await expect(page).toHaveURL((url) => url.searchParams.get("role") === "PROIECTANT");
  await page.getByRole("checkbox", { name: "Autor verificat", exact: true }).check();
  await expect(page).toHaveURL((url) => url.searchParams.get("verified") === "1");
  await page.getByRole("checkbox", { name: "Cu schițe", exact: true }).check();
  await expect(page).toHaveURL((url) => url.searchParams.get("sketches") === "1");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: otherTitle, exact: true })).toHaveCount(0);
  await page
    .getByRole("searchbox", { name: "Caută detalii", exact: true })
    .fill(title + " inexistent");
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get("q") === title + " inexistent" &&
      url.searchParams.get("cat") === categoryId &&
      url.searchParams.get("verified") === "1" &&
      url.searchParams.get("sketches") === "1" &&
      url.searchParams.get("role") === "PROIECTANT",
  );
  await expect(page.getByRole("heading", { name: title, exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Scoate filtrul Cu schițe", exact: true }).click();
  await expect(page).toHaveURL(
    (url) =>
      !url.searchParams.has("sketches") &&
      url.searchParams.get("verified") === "1" &&
      url.searchParams.get("role") === "PROIECTANT",
  );
});

// **Cautare avansata:** filtrele de rol al autorului, categorie, rol verificat si existenta schitelor se combina cu cautarea si „Urmariti”; rezultatele si paginarea folosesc aceleasi conditii. Rolul/verificarea urmeaza ceea ce se afiseaza, inclusiv snapshot-ul autorului retras; schitele ascunse si adnotarile nu satisfac filtrul „cu schite”.
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

// **Cautare avansata:** filtrele de rol al autorului, categorie, rol verificat si existenta schitelor se combina cu cautarea si „Urmariti”; rezultatele si paginarea folosesc aceleasi conditii. Rolul/verificarea urmeaza ceea ce se afiseaza, inclusiv snapshot-ul autorului retras; schitele ascunse si adnotarile nu satisfac filtrul „cu schite”.
test("paginarea pastreaza follow, categorie, rol, verificat si cu schite", async ({ page }) => {
  const term = "Pagination " + crypto.randomUUID();
  const rows = await db
    .insert(details)
    .values(
      Array.from({ length: 51 }, (_, i) => ({
        authorId,
        title: term + " " + i,
        imageUrl: "/pwa-192.png",
      })),
    )
    .returning();
  const ids = rows.map((r) => r.id);
  detailIds.push(...ids);
  await db.insert(detailCategories).values(ids.map((detailId) => ({ detailId, categoryId })));
  await db.insert(sketches).values(
    ids.map((detailId) => ({
      detailId,
      authorId: getSeed().testerUserId,
      status: "PUBLISHED" as const,
    })),
  );
  await db
    .insert(userFollows)
    .values({ followerUserId: getSeed().testerUserId, followedUserId: authorId });
  const params = new URLSearchParams({
    q: term,
    cat: categoryId,
    role: "PROIECTANT",
    verified: "1",
    sketches: "1",
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
