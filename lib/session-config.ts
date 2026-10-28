// Sesiune fixa: 7 zile de la login, fara prelungire la activitate. Modul separat fara initializarea Auth.js.
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

// TTL magic link (minute). Default prudent: 15 min dacă env lipsește. Tot aici, nu în `lib/auth.ts`,
// ca pagina `/verify-request` să-l poată afișa fără să tragă `next-auth` la import.
export const magicLinkTtlMinutes = Number(process.env.MAGIC_LINK_TTL_MINUTES) || 15;
