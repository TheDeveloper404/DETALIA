import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/lib/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { id: "reader" } }) }));
vi.mock("@/server/services/notificationService", () => ({
  getNotifications: vi
    .fn()
    .mockResolvedValue([
      {
        id: "n",
        type: "COMMENT_REPLIED",
        readAt: new Date(),
        createdAt: new Date(),
        payloadJson: {
          detailId: "detail",
          sketchId: "sketch",
          commentId: "comment",
          detailTitle: "Titlu",
        },
      },
      {
        id: "r",
        type: "REFERRAL_JOINED",
        readAt: new Date(),
        createdAt: new Date(),
        payloadJson: { joinedUserId: "joined", joinedUserName: "Maria" },
      },
    ]),
}));
vi.mock("./mark-read-on-view", () => ({ MarkReadOnView: () => null }));
import Page from "./page";
// **Notificari la comentarii/reply:** autorul continutului, autorul radacinii firului si autorul comentariului caruia i se raspunde primesc notificarea o singura data fiecare; actorul nu se notifica singur. Exclusiv in-app, fara extras din comentariu; accesul se verifica si pentru destinatar. La citire, notificarile noi se omit daca discutia nu mai este vizibila ori comentariul/tinta a disparut.
it("linkul unui reply pe schita selecteaza schita inainte de ancora comentariului", async () => {
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain('href="/details/detail?sketch=sketch#comment-comment"');
});

it("referral pe pagina duce la profilul celui inscris, ca in clopotel", async () => {
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain('href="/profile/joined"');
});
