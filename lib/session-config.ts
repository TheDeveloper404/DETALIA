// Fereastra maximă a unei sesiuni (JWT), în secunde — FIXĂ, nu culisantă (decizie de produs
// 2026-08-09): userul e delogat forțat la 7 zile de la ULTIMUL LOGIN, nu de la ultima activitate.
// Contextul complet (de ce fixă, de ce nu se rotește `exp`): `lib/auth.ts`.
//
// Trăiește separat de `lib/auth.ts` pentru că acela rulează `NextAuth({...})` la import (trage tot
// adapterul + `@/db`) — testul de regresie și `e2e/auth.setup.ts` au nevoie DOAR de numărul ăsta,
// fără dependențe. O singură sursă de adevăr; înainte, `e2e/auth.setup.ts` avea propriul `30` care
// diverga tăcut de `7`-le din prod (gol găsit la checkpoint-ul lunar de teste, 2026-09-01).
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
