import Link from "next/link";

import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">DETALIA</h1>
        <p className="max-w-md text-zinc-600 dark:text-zinc-400">
          Comunitatea profesională din construcții, organizată în jurul detaliului de execuție.
        </p>
      </div>

      {session?.user ? (
        <Link
          href="/feed"
          className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Mergi la feed
        </Link>
      ) : (
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Creează cont
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Autentificare
          </Link>
        </div>
      )}
    </main>
  );
}
