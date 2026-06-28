import { AuthShell } from "@/components/auth-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Fallback dedicat pentru /login: randează ACELAȘI shell de auth ca pagina (header + panou + card),
// cu zona de formular ca schelet. Fără el, tranziția `/` → `/login` ar afișa scheletul generic din
// `app/loading.tsx` (titlu + carduri) → flash de „ecran gol". Aici shell-ul e identic, deci imperceptibil.
export default function LoginLoading() {
  return (
    <AuthShell mode="login">
      <Card className="w-full gap-6 [--card-spacing:--spacing(8)] shadow-[0_22px_56px_-34px_rgba(33,29,24,0.35)]">
        <CardHeader>
          <CardTitle className="text-[27px] leading-tight tracking-tight">Autentificare</CardTitle>
          <CardDescription className="text-[15px]">
            Bine ai revenit. Îți trimitem un link de acces pe email — fără parolă.
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
