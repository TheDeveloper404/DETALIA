// SEC-11 — validare centralizată a formatului UUID. Un id extern malformat trebuie să dea „not found"
// (nu o eroare SQL): Postgres aruncă „invalid input syntax for type uuid" pe coloanele `uuid` → altfel 500.
// Pur, fără dependențe — folosit la fiecare graniță de serviciu care primește un id de la client.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
