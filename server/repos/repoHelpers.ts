// Fragmente SQL reutilizate în mai multe repo-uri (Drizzle `sql` compune fragmente imbricate).
import { sql } from "drizzle-orm";

import { roles } from "@/db/schema";

// Condiție „user verificat" (rol confirmat) — folosită peste tot unde afișăm nume+rol+verificare
// (steluța de lângă nume). Presupune un join/left join deja făcut pe `roles`.
export const verifiedCondition = sql`${roles.verificationStatus} = 'VERIFIED'`;
