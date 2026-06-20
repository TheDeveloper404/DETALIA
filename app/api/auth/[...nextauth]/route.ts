// Route Handler Auth.js (App Router) — re-exportă handlerele din configul central.
// Toate rutele /api/auth/* (signin, callback magic link, signout, session) trec pe aici.
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
