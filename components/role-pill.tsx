// Pastilă de rol — rolul afișat lângă nume, colorat pe rol principal + steluță galbenă dacă e VERIFICAT.
// Greutatea o judecă cititorul după rol; noi doar îl afișăm corect și transparent (fără scoring).
// Culorile sunt specifice acestui marker (nu tokeni shadcn), deci stau inline.
import { ROLE_MAIN_LABELS, type RoleMain } from "@/server/domain/roles";

const ROLE_STYLE: Record<RoleMain, { bg: string; fg: string }> = {
  PROIECTANT: { bg: "#a9573a", fg: "#ffffff" }, // teracotă
  EXECUTANT: { bg: "#7a8a3f", fg: "#ffffff" }, // oliv
  FURNIZOR: { bg: "#5e6f8a", fg: "#ffffff" }, // albastru
  BENEFICIAR: { bg: "#ece4d6", fg: "#5d564c" }, // neutru cald
};

export function RolePill({
  roleMain,
  verified,
}: {
  roleMain: string | null;
  verified: boolean;
}) {
  if (!roleMain) return null;
  const key = roleMain as RoleMain;
  const style = ROLE_STYLE[key] ?? ROLE_STYLE.BENEFICIAR;
  const label = ROLE_MAIN_LABELS[key] ?? roleMain;

  return (
    <span className="inline-flex items-center gap-1">
      {verified && (
        <span
          title="Rol verificat"
          aria-label="Rol verificat"
          className="text-[#d99a2b]"
        >
          ★
        </span>
      )}
      <span
        className="rounded-full px-2 py-0.5 font-mono text-[11.5px] leading-none"
        style={{ background: style.bg, color: style.fg }}
      >
        {label}
      </span>
    </span>
  );
}
