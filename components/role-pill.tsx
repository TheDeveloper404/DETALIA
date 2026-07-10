// Pastilă de rol — MESERIA (subRole) afișată lângă nume, colorat pe rolul principal (grupare internă,
// invizibilă) + steluță galbenă dacă e VERIFICAT. Rolul principal NU se mai afișează (lista_meserii.md,
// decizie Edi): „Eduard Nemeș · Arhitect", nu „Proiectant · Arhitect" — se subînțelege din meserie.
// Greutatea o judecă cititorul după meserie; noi doar o afișăm corect și transparent (fără scoring).
// Culorile sunt specifice acestui marker (nu tokeni shadcn), deci stau inline.
import type { RoleMain } from "@/server/domain/roles";

const ROLE_STYLE: Record<RoleMain, { bg: string; fg: string }> = {
  PROIECTANT: { bg: "#a9573a", fg: "#ffffff" }, // teracotă
  EXECUTANT: { bg: "#7a8a3f", fg: "#ffffff" }, // oliv
  FURNIZOR: { bg: "#5e6f8a", fg: "#ffffff" }, // albastru
  BENEFICIAR: { bg: "#ece4d6", fg: "#5d564c" }, // neutru cald
};

export function RolePill({
  roleMain,
  subRole,
  verified,
}: {
  roleMain: string | null;
  subRole?: string | null;
  verified: boolean;
}) {
  if (!roleMain) return null;
  const key = roleMain as RoleMain;
  const style = ROLE_STYLE[key] ?? ROLE_STYLE.BENEFICIAR;
  const label = subRole ?? roleMain;

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
        className="whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[11.5px] leading-none"
        style={{ background: style.bg, color: style.fg }}
      >
        {label}
      </span>
    </span>
  );
}
