import { expect, it } from "vitest";
import { weeklyDigestEmailHtml, weeklyDigestEmailText } from "./email";

// "daca la un user s-a raspuns la comentarii, schite etc,, atunci primeste"
it("descrie activitatea primita si pe comentarii/schite, pastrand dezabonarea si escaping-ul", () => {
  const data = {
    recipientName: "<img src=x>",
    mine: { comments: 1, sketches: 1, validations: 0 },
    community: [{ title: "<script>fixture</script>", url: "https://detalia.ro/details/fixture" }],
    unsubscribeUrl: "https://detalia.ro/api/digest/unsubscribe?token=fixture",
    profileUrl: "https://detalia.ro/profile",
  };
  const html = weeklyDigestEmailHtml(data);
  const text = weeklyDigestEmailText(data);
  for (const body of [html, text]) {
    expect(body).toContain("Activitate pentru tine");
    expect(body).toContain("comentariile sau schițele tale");
    expect(body).toContain(data.unsubscribeUrl);
  }
  expect(html).toContain("&lt;img src=x&gt;");
  expect(html).not.toContain("<script>fixture</script>");
});
