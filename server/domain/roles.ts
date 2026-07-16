// Domain roluri — sursa unică pentru rolurile principale și subrolurile (meseriile) lor.
// Rolul clasifică OAMENII (credibilitate), distinct de taxonomia de categorii (clasifică detaliile).
//
// Listă finală confirmată de Edi (`lista_meserii.md`). roleMain rămâne enum-ul de grupare din DB
// (folosit la signup + ca ROLE_MAIN al lui subRole), dar NU se mai afișează în platformă — doar
// meseria (subRole) e vizibilă lângă nume (ex. „Eduard Nemeș · Arhitect", nu „Proiectant · Arhitect").

export const ROLE_MAINS = ["PROIECTANT", "EXECUTANT", "FURNIZOR", "BENEFICIAR"] as const;

export type RoleMain = (typeof ROLE_MAINS)[number];

// Meserii per rol principal — folosite ca meseria de bază (unică, obligatorie).
export const SUBROLES: Record<RoleMain, readonly string[]> = {
  PROIECTANT: [
    "Arhitect",
    "Inginer constructor",
    "Inginer instalații electrice",
    "Inginer instalații termice/HVAC",
    "Inginer instalații sanitare",
    "Inginer geotehnician",
    "Inginer topograf",
    "Verificator proiecte",
    "Expert tehnic",
    "Auditor energetic",
    "Peisagist",
    "Designer de interior",
    "BIM Manager",
  ],
  EXECUTANT: [
    "Constructor general",
    "Meșter",
    "Electrician",
    "Instalator",
    "Montator tâmplării",
    "Tâmplar mobilă",
    "Montator învelitori",
    "Montator hidroizolații",
  ],
  FURNIZOR: ["Producător materiale", "Distribuitor materiale", "Agent vânzări materiale"],
  BENEFICIAR: ["Beneficiar", "Dezvoltator imobiliar"],
} as const;

// Etichete prietenoase — folosite DOAR la signup (grupare), nu se mai afișează în platformă.
export const ROLE_MAIN_LABELS: Record<RoleMain, string> = {
  PROIECTANT: "Proiectare",
  EXECUTANT: "Execuție",
  FURNIZOR: "Achiziții materiale",
  BENEFICIAR: "Beneficiar",
};

// Rol secundar, ADITIV peste meseria de bază (câmp opțional separat, nu înlocuiește roleMain/subRole).
export const SECONDARY_ROLES = [
  "Specialist Case Pasive",
  "Specialist nZEB",
  "Student",
  "Cadru didactic",
  "Diriginte de șantier",
  "RTE",
  "Arhitect șef",
  "ISC",
  "OCPI",
  "ANCPI",
  "DSP",
  "ISU",
  "Protecția Mediului",
  "Urbanism",
  "Furnizor utilități",
] as const;

export function isValidRoleMain(value: string): value is RoleMain {
  return (ROLE_MAINS as readonly string[]).includes(value);
}

// Un subrol e valid DOAR dacă aparține rolului principal ales (enforce pe server).
export function isValidSubRole(roleMain: RoleMain, subRole: string): boolean {
  return SUBROLES[roleMain].includes(subRole);
}

export function isValidSecondaryRole(value: string): boolean {
  return (SECONDARY_ROLES as readonly string[]).includes(value);
}
