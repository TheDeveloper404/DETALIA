// Pașii turului ghidat de pe pagina de detaliu, ca date pure (testabile fără driver.js montat și fără
// să tragă lanțul de import al `detail-product-tour.tsx`, care importă o acțiune „use server" —
// module-ul acela nu poate fi importat direct din vitest, vezi detail-product-tour.test.ts).
import type { Config } from "driver.js";

// Fiecare `data-tour` trebuie să existe EXACT o dată în DOM-ul paginii de detaliu — vezi detail-workspace.tsx.
export const DETAIL_TOUR_STEPS: NonNullable<Config["steps"]> = [
  {
    element: '[data-tour="detail-tabs"]',
    popover: {
      title: "Tab-uri",
      description:
        "Tab-ul de bază arată detaliul original — fiecare schiță trimisă de comunitate peste el primește propriul tab, alături.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="detail-actions"]',
    popover: {
      title: "Schițează sau ofertă",
      description:
        "«Schițează» continuă dezbaterea cu un desen propriu peste imagine. Dacă furnizezi materiale, «Pot să ofertez materiale» anunță autorul.",
      side: "left",
      align: "end",
    },
  },
  {
    element: '[data-tour="detail-validation"]',
    popover: {
      title: "Validare pe roluri",
      description:
        "Fiecare meserie relevantă își dă avizul, pe detaliu sau pe o schiță anume — contextual, pe tab-ul activ.",
      side: "top",
      align: "start",
    },
  },
  {
    element: '[data-tour="detail-comments"]',
    popover: {
      title: "Dezbaterea",
      description: "Un singur fir de discuție pe toată postarea — @mentionezi o schiță ca să sari direct la tab-ul ei.",
      side: "top",
      align: "start",
    },
  },
];
