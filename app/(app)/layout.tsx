import { AppHeader } from "@/components/app-header";

// Layout al zonei autentificate (feed, details, profile, sketches, notifications): aici trăiește
// header-ul global. Landing/login/signup/onboarding stau în root layout (au header propriu sau niciunul),
// ca să nu se dubleze bara — un user logat pe „/" vedea AppHeader peste header-ul propriu al landing-ului.
//
// GATING (deny-by-default auth + poarta de onboarding) trăiește acum în `proxy.ts` ca redirect 307 curat.
// NU îl reintroduce aici: un `redirect()` din layout în timpul streaming-ului RSC degenerează în
// meta-refresh → buclă de loading (onboarding ⇄ feed). Vezi comentariul din proxy.ts.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
