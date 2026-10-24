// Sugestie de corectură pentru greșeli de tipar în domeniul emailului (ex. `gmail.con`, `yaho.com`).
// Doar avertizare în UI — nu blochează trimiterea. La expoziție (2026-10-23) două magic link-uri au
// ricoșat pe adrese greșite și userii n-au mai revenit.

const KNOWN_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "yahoo.ro",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "live.com",
  "ymail.com",
  "mail.com",
  "aol.com",
];
const PROVIDERS = [...new Set(KNOWN_DOMAINS.map((d) => d.split(".")[0]))];

// Terminații greșite frecvente pentru `.com`, valabile pe orice domeniu (inclusiv de firmă).
const COM_TLD_TYPOS = ["con", "cmo", "cpm", "xom", "vom", "comm"];

// Distanța de editare cu transpoziție (Damerau, varianta OSA): `gmial` → `gmail` = 1, nu 2.
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

// Numele furnizorului se compară separat de TLD, ca domeniile valide (`yahoo.fr`, `live.ro`) să nu fie
// „corectate". Potrivire aproximativă doar pe nume de minim 5 litere — `aol`/`live` sunt prea scurte.
function findProvider(name: string): string | undefined {
  return PROVIDERS.find(
    (p) => p === name || (p.length >= 5 && editDistance(name, p) <= (p.length > 5 ? 2 : 1)),
  );
}

// Întoarce adresa corectată dacă domeniul pare greșit, altfel `null`.
export function suggestEmailFix(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at <= 0) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain || KNOWN_DOMAINS.includes(domain)) return null;

  const dot = domain.lastIndexOf(".");
  const name = dot === -1 ? domain : domain.slice(0, dot);
  let tld = dot === -1 ? "" : domain.slice(dot + 1);
  if (COM_TLD_TYPOS.includes(tld)) tld = "com";

  let fixed: string | null = tld === "com" ? `${name}.com` : null;
  const provider = findProvider(name);
  if (provider) {
    if (KNOWN_DOMAINS.includes(`${provider}.${tld}`)) fixed = `${provider}.${tld}`;
    else if (provider !== name || tld === "" || editDistance(tld, "com") <= 1)
      fixed = `${provider}.com`;
  }

  return fixed && fixed !== domain ? `${local}@${fixed}` : null;
}
