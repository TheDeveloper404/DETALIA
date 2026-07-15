import { AddDetailFab } from "@/components/add-detail-fab";
import { AppHeader } from "@/components/app-header";
import { PostHogIdentify } from "@/components/posthog-identify";
import { auth } from "@/lib/auth";

// Layout al zonei autentificate (feed, details, profile, sketches, notifications): aici trăiește
// header-ul global. Landing/login/signup/onboarding stau în root layout (au header propriu sau niciunul),
// ca să nu se dubleze bara — un user logat pe „/" vedea AppHeader peste header-ul propriu al landing-ului.
//
// GATING (deny-by-default auth + poarta de onboarding) trăiește acum în `proxy.ts` ca redirect 307 curat.
// NU îl reintroduce aici: un `redirect()` din layout în timpul streaming-ului RSC degenerează în
// meta-refresh → buclă de loading (onboarding ⇄ feed). Vezi comentariul din proxy.ts.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <>
      <AppHeader />
      {session?.user?.id && <PostHogIdentify userId={session.user.id} name={session.user.name} />}
      {/* pb-24: rezervă spațiu sub conținut ca ultimele rânduri (ex. comentarii) să nu fie acoperite
          de AddDetailFab, care e `fixed` peste pagină indiferent de scroll. */}
      <div className="pb-24">{children}</div>
      <AddDetailFab />
    </>
  );
}
