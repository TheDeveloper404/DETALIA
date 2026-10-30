import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/server/repos/notificationEmailsRepo", () => ({
  claimEmailDeliveries: vi.fn(), createDueEmailDeliveries: vi.fn(), finishEmailDelivery: vi.fn(),
  getEmailRecipient: vi.fn(), listDeliverableEmailEvents: vi.fn(), retryEmailDelivery: vi.fn(), saveEmailSnapshot: vi.fn(),
}));
vi.mock("@/server/repos/usersRepo", () => ({ disableActivityEmails: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(), activityEmailHtml: vi.fn(() => "<p>Activitate</p>"), activityEmailText: vi.fn(() => "Activitate") }));
vi.mock("@/lib/signed-token", () => ({ createSignedToken: vi.fn(() => "signed-link"), verifySignedToken: vi.fn() }));
import { sendEmail } from "@/lib/email";
import { claimEmailDeliveries, createDueEmailDeliveries, finishEmailDelivery, getEmailRecipient,
  listDeliverableEmailEvents, retryEmailDelivery, saveEmailSnapshot, type EmailDelivery } from "@/server/repos/notificationEmailsRepo";
import { processNotificationEmails } from "./notificationEmailService";
const now = new Date("2026-10-30T10:00:00Z");
const delivery: EmailDelivery = { id: "11111111-1111-4111-8111-111111111111", recipientUserId: "22222222-2222-4222-8222-222222222222", mode: "IMPORTANT", leaseToken: "33333333-3333-4333-8333-333333333333", firstAttemptAt: null, payloadJson: null };
const events = [{ id: "44444444-4444-4444-8444-444444444444", type: "COMMENT_ADDED" as const, detailId: "55555555-5555-4555-8555-555555555555", detailTitle: "Titlu", payload: { detailId: "55555555-5555-4555-8555-555555555555", commentId: "66666666-6666-4666-8666-666666666666" } }];
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now);
  vi.stubEnv("NOTIFICATION_EMAILS_ENABLED", "true"); vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("AUTH_RESEND_KEY", "fixture-only"); vi.stubEnv("EMAIL_FROM", "DETALIA <test@test.invalid>");
  vi.mocked(claimEmailDeliveries).mockResolvedValue([delivery]);
  vi.mocked(getEmailRecipient).mockResolvedValue({ email: "recipient@test.invalid", status: "ACTIVE", mode: "IMPORTANT" });
  vi.mocked(listDeliverableEmailEvents).mockResolvedValue(events);
  vi.mocked(saveEmailSnapshot).mockResolvedValue(true); vi.mocked(sendEmail).mockResolvedValue(true);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

// "Snapshot si ID stabil de livrare pentru retry cu aceeasi cheie Resend si acelasi payload."
it("persista snapshotul inainte de send si foloseste aceeasi cheie si acelasi mesaj la retry", async () => {
  vi.mocked(sendEmail).mockResolvedValueOnce(false);
  expect(await processNotificationEmails(now)).toMatchObject({ claimed: 1, failed: 1, sent: 0 });
  const snapshot = vi.mocked(saveEmailSnapshot).mock.calls[0][1];
  expect(vi.mocked(saveEmailSnapshot).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(sendEmail).mock.invocationCallOrder[0]);
  expect(retryEmailDelivery).toHaveBeenCalledWith(delivery, now);
  const first = vi.mocked(sendEmail).mock.calls[0][0];
  vi.mocked(claimEmailDeliveries).mockResolvedValue([{ ...delivery, payloadJson: snapshot, firstAttemptAt: now }]);
  vi.setSystemTime(new Date(now.getTime() + 300_000));
  await processNotificationEmails(new Date(now.getTime() + 300_000));
  const second = vi.mocked(sendEmail).mock.calls[1][0];
  expect(second).toMatchObject({ to: first.to, from: first.from, subject: first.subject, html: first.html, text: first.text, idempotencyKey: `notification-delivery/${delivery.id}` });
  expect(finishEmailDelivery).toHaveBeenLastCalledWith(expect.objectContaining({ id: delivery.id }), "SENT");
});

// "La trimitere se elimina evenimentele citite, disparute ori fara acces actual."
it("citirea sau revocarea accesului intre snapshot si send anuleaza emailul", async () => {
  vi.mocked(saveEmailSnapshot).mockImplementation(async () => { vi.mocked(listDeliverableEmailEvents).mockResolvedValue([]); return true; });
  expect(await processNotificationEmails(now)).toMatchObject({ sent: 0, skipped: 1 });
  expect(sendEmail).not.toHaveBeenCalled(); expect(finishEmailDelivery).toHaveBeenCalledWith(delivery, "CANCELLED");
});

// "Inainte de fiecare incercare: cont activ, preferinta actuala, acces curent, continut eligibil."
it.each(["IN_APP", "SUSPENDED", "DELETED"])("nu trimite pentru destinatar %s", async (value) => {
  vi.mocked(getEmailRecipient).mockResolvedValue(value === "IN_APP"
    ? { email: "recipient@test.invalid", status: "ACTIVE", mode: "IN_APP" }
    : { email: "recipient@test.invalid", status: value as "SUSPENDED" | "DELETED", mode: "IMPORTANT" });
  await processNotificationEmails(now); expect(sendEmail).not.toHaveBeenCalled();
});

// "Daca setul sau accesul s-a schimbat, anuleaza batch-ul inghetat; nu modifica payload-ul sub aceeasi cheie."
it("un retry cu continut schimbat este anulat, nu regenerat sub o alta cheie", async () => {
  vi.mocked(sendEmail).mockResolvedValueOnce(false); await processNotificationEmails(now);
  const snapshot = vi.mocked(saveEmailSnapshot).mock.calls[0][1];
  vi.mocked(claimEmailDeliveries).mockResolvedValue([{ ...delivery, payloadJson: snapshot, firstAttemptAt: now }]);
  vi.mocked(listDeliverableEmailEvents).mockResolvedValue([{ ...events[0], detailTitle: "Titlu schimbat" }]);
  await processNotificationEmails(now);
  expect(sendEmail).toHaveBeenCalledTimes(1);
  expect(finishEmailDelivery).toHaveBeenLastCalledWith(expect.objectContaining({ id: delivery.id }), "CANCELLED");
});

// "Dupa 24h de la prima incercare incerta: FAILED, fara retrimitere automata."
it("nu retrimite dupa expirarea idempotentei Resend", async () => {
  vi.mocked(claimEmailDeliveries).mockResolvedValue([{ ...delivery, firstAttemptAt: new Date(now.getTime() - 86_400_000) }]);
  await processNotificationEmails(now); expect(sendEmail).not.toHaveBeenCalled();
  expect(finishEmailDelivery).toHaveBeenCalledWith(expect.anything(), "FAILED");
});

// "Verific timpul curent si marja de timeout inainte de retry" — fix de review aprobat de Liviu.
it("asteptarea dupa claim poate depasi termenul sigur, desi la pornirea cronului mai era timp", async () => {
  vi.mocked(claimEmailDeliveries).mockResolvedValue([{ ...delivery, firstAttemptAt: new Date(now.getTime() - 86_400_000 + 30_000) }]);
  vi.mocked(saveEmailSnapshot).mockImplementation(async () => { vi.setSystemTime(new Date(now.getTime() + 25_000)); return true; });
  await processNotificationEmails(now);
  expect(sendEmail).not.toHaveBeenCalled();
  expect(finishEmailDelivery).toHaveBeenCalledWith(expect.anything(), "FAILED");
});

// "Tokenul impiedica un worker expirat sa finalizeze munca altuia."
it("workerul care pierde lease-ul inainte de snapshot nu trimite", async () => {
  vi.mocked(saveEmailSnapshot).mockResolvedValue(false);
  await processNotificationEmails(now); expect(sendEmail).not.toHaveBeenCalled();
});

// "Schimbarea IMPORTANT/DAILY inainte de prima incercare poate elibera asocierea si reprograma conform noului mod."
it("schimbarea modului reprogrameaza doar un batch care nu a avut nicio incercare", async () => {
  vi.mocked(getEmailRecipient).mockResolvedValue({ email: "recipient@test.invalid", status: "ACTIVE", mode: "DAILY" });
  await processNotificationEmails(now);
  expect(finishEmailDelivery).toHaveBeenCalledWith(delivery, "CANCELLED", true);
  expect(sendEmail).not.toHaveBeenCalled();
});

// "Cron activ numai in Production"; "Kill switch-ul opreste procesorul".
it.each([["VERCEL_ENV", "preview"], ["NOTIFICATION_EMAILS_ENABLED", "false"], ["AUTH_RESEND_KEY", ""]])("%s=%s opreste procesarea", async (name, value) => {
  vi.stubEnv(name, value); expect(await processNotificationEmails(now)).toEqual({ claimed: 0, sent: 0, skipped: 0, failed: 0 });
  expect(createDueEmailDeliveries).not.toHaveBeenCalled(); expect(sendEmail).not.toHaveBeenCalled();
});
