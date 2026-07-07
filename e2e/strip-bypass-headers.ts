import type { Page } from "@playwright/test";

// `playwright.config.ts` atașează global (`extraHTTPHeaders`) headerul de bypass al Deployment
// Protection Vercel, ca Playwright să poată încărca paginile preview-ului. Dar acest header se
// propagă la TOATE cererile paginii — inclusiv la PUT-ul direct, cross-origin, către storage-ul
// Vercel Blob (`vercel.com/api/blob/...`), care nu-l așteaptă și eșuează CORS preflight-ul
// (`net::ERR_FAILED`). Doar sub Playwright: userii reali n-au acest header, upload-ul lor merge normal.
// Fix: pe cererile către Blob, scoatem cele două headere înainte să continue request-ul.
export async function stripBypassHeadersForBlobUploads(page: Page): Promise<void> {
  await page.context().route(/vercel-storage\.com|vercel\.com\/api\/blob/, async (route) => {
    const headers = { ...route.request().headers() };
    delete headers["x-vercel-protection-bypass"];
    delete headers["x-vercel-set-bypass-cookie"];
    await route.continue({ headers });
  });
}
