import { AppHeader } from "@/components/app-header";

// Layout al zonei autentificate (feed, details, profile, sketches, notifications): aici trăiește
// header-ul global. Landing/login/signup/onboarding stau în root layout (au header propriu sau niciunul),
// ca să nu se dubleze bara — un user logat pe „/" vedea AppHeader peste header-ul propriu al landing-ului.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
