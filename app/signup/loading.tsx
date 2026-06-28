import { AuthShell } from "@/components/auth-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Fallback dedicat pentru /signup — vezi nota din app/login/loading.tsx. Shell identic cu pagina,
// zona de formular ca schelet → tranziția din landing nu mai arată scheletul generic („ecran gol").
export default function SignupLoading() {
  return (
    <AuthShell mode="signup">
      <Card className="w-full gap-6 [--card-spacing:--spacing(8)] shadow-[0_22px_56px_-34px_rgba(33,29,24,0.35)]">
        <CardHeader>
          <CardTitle className="text-[27px] leading-tight tracking-tight">Creează cont</CardTitle>
          <CardDescription className="text-[15px]">
            Intră printre primii profesioniști. Cont gratuit, fără parolă — primești un link de acces
            pe email.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
