// Domain roluri — sursa unică pentru rolurile principale și subrolurile lor.
// Rolul clasifică OAMENII (credibilitate), distinct de taxonomia de categorii (clasifică detaliile).
//
// ⚠️ LISTE DRAFT de subroluri — de reconfirmat (taxonomia finală e o decizie de produs deschisă).
// Rolurile principale sunt confirmate (enum în DB: role_main). Subrolurile sunt provizorii.

export const ROLE_MAINS = ["PROIECTANT", "EXECUTANT", "FURNIZOR", "BENEFICIAR"] as const;

export type RoleMain = (typeof ROLE_MAINS)[number];

// Subroluri per rol principal (DRAFT). Cheia = RoleMain, valoarea = subroluri permise.
export const SUBROLES: Record<RoleMain, readonly string[]> = {
  PROIECTANT: [
    "Arhitect",
    "Inginer structurist",
    "Inginer instalații",
    "Urbanist",
    "Peisagist",
    "Verificator de proiect",
  ],
  EXECUTANT: [
    "Antreprenor general",
    "Șef de șantier",
    "Constructor",
    "Instalator",
    "Electrician",
    "Dulgher",
  ],
  FURNIZOR: ["Producător de materiale", "Distribuitor", "Comerciant"],
  BENEFICIAR: ["Investitor", "Dezvoltator", "Proprietar", "Administrator"],
} as const;

// Etichete prietenoase pentru UI.
export const ROLE_MAIN_LABELS: Record<RoleMain, string> = {
  PROIECTANT: "Proiectant",
  EXECUTANT: "Executant",
  FURNIZOR: "Furnizor",
  BENEFICIAR: "Beneficiar",
};

export function isValidRoleMain(value: string): value is RoleMain {
  return (ROLE_MAINS as readonly string[]).includes(value);
}

// Un subrol e valid DOAR dacă aparține rolului principal ales (enforce pe server).
export function isValidSubRole(roleMain: RoleMain, subRole: string): boolean {
  return SUBROLES[roleMain].includes(subRole);
}
