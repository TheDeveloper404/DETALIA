import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { auth } from "@/lib/auth";
import { userHasRole } from "@/server/services/roleService";

// Layout al zonei autentificate (feed, details, profile, sketches, notifications): aici trăiește
// header-ul global. Landing/login/signup/onboarding stau în root layout (au header propriu sau niciunul),
// ca să nu se dubleze bara — un user logat pe „/" vedea AppHeader peste header-ul propriu al landing-ului.
//
// GATING DE ONBOARDING: deny-by-default (auth) e în `proxy.ts`. Aici a doua poartă — un user logat dar
// FĂRĂ rol declarat NU poate intra în zona autentificată; e trimis să-și declare rolul întâi.
// (`/onboarding` e la root, nu sub `(app)`, deci nu se face buclă.)
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user?.id && !(await userHasRole(session.user.id))) {
    redirect("/onboarding");
  }

  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
