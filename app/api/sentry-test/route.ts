// Rută de DIAGNOSTIC pentru Sentry — aruncă intenționat o eroare ca să confirmăm că evenimentele
// ajung în Sentry Issues (util după setarea env-urilor / un redeploy). Accesezi `/api/sentry-test`
// în prod → apare o eroare în Sentry. NU e folosită de aplicație; se poate șterge după verificare.
export function GET(): never {
  throw new Error("Sentry test error — declanșat manual din /api/sentry-test");
}
