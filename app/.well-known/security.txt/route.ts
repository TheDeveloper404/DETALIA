// security.txt (RFC 9116) — canal standard de raportare responsabilă a vulnerabilităților.
// Public (adăugat în PUBLIC_PATHS din proxy.ts). Servit ca text/plain. `Expires` cere reînnoire
// periodică (RFC 9116) — de actualizat înainte de data de mai jos.

const CONTENT = `Contact: mailto:liviu@detalia.ro
Expires: 2027-07-09T00:00:00.000Z
Preferred-Languages: ro, en
Canonical: https://detalia.ro/.well-known/security.txt
`;

export const dynamic = "force-static";

export function GET(): Response {
  return new Response(CONTENT, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
