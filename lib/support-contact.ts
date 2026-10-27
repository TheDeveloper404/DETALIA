// Contactele de suport afișate în aplicație — sursă unică, folosită și pe server, și în client.
// WhatsApp-ul apare DOAR la blocaje (eșecuri repetate), niciodată în meniu — vezi components/support/.

export const SUPPORT_EMAIL = "support@detalia.ro";

const WHATSAPP_NUMBER = "40758154490";

// Numărul e al suportului ACL — conversația se deschide cu acest nume, nu cu DETALIA.
export const WHATSAPP_NOTE = "Îți răspunde echipa tehnică ACL Smart Software, care dezvoltă DETALIA.";

// Fluxurile din care se poate cere ajutor. Cheia ajunge în Slack; eticheta e ce citește omul de suport.
export const SUPPORT_FLOWS = {
  menu: "din meniu",
  general: "eroare neașteptată",
  login: "conectare",
  onboarding: "onboarding",
  detail_publish: "publicare detaliu",
  sketch_save: "salvare schiță",
  canvas_save: "salvare planșă",
} as const;

export type SupportFlow = keyof typeof SUPPORT_FLOWS;

// Prima eroare nu arată nimic în plus (de obicei reîncercarea merge); a doua aduce linkul de raportare;
// de la a treia apare și WhatsApp — canalul direct rămâne pentru blocaje reale.
export function supportLevel(failures: number): "none" | "report" | "whatsapp" {
  if (failures >= 3) return "whatsapp";
  if (failures >= 2) return "report";
  return "none";
}

// Mesaj precompletat cu pagina și eroarea, ca să nu fie nevoie de întrebări în plus pe WhatsApp.
export function whatsappUrl(context: { page: string; errorMessage?: string }): string {
  const lines = ["Salut, sunt utilizator DETALIA și am o problemă.", `Pagina: ${context.page}`];
  if (context.errorMessage) lines.push(`Eroare: ${context.errorMessage}`);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
}
