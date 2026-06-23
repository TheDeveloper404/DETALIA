// Date MOCK pentru preview-ul dev (fără DB). NU se folosesc nicăieri în producție —
// paginile din app/dev/* sunt gated pe non-producție (vezi proxy.ts + notFound() în pagini).
import type { FeedItem } from "@/server/repos/detailsRepo";

const IMG = "/preview/detail.svg";

export const MOCK_CATEGORIES = [
  { id: "cat-1", name: "Acoperișuri" },
  { id: "cat-2", name: "Fațade & termosistem" },
  { id: "cat-3", name: "Fundații & hidroizolații" },
  { id: "cat-4", name: "Tâmplărie" },
];

type MockSeed = {
  title: string;
  description: string;
  categoryName: string;
  authorName: string;
  authorRoleMain: FeedItem["authorRoleMain"];
  authorSubRole: string;
  authorVerification: FeedItem["authorVerification"];
  interactionCount: number;
};

const SEEDS: MockSeed[] = [
  {
    title: "Atic acoperiș terasă — racord șorț tablă",
    description: "Detaliu de racord la atic cu șorț de tablă și termoizolație. Discuție pe etanșare.",
    categoryName: "Acoperișuri",
    authorName: "M. Popa",
    authorRoleMain: "PROIECTANT",
    authorSubRole: "Arhitect",
    authorVerification: "VERIFIED",
    interactionCount: 12,
  },
  {
    title: "Buiandrug peste gol fereastră — termosistem",
    description: "Întreruperea punții termice la buiandrug. Variante de armare și fixare a plăcii.",
    categoryName: "Fațade & termosistem",
    authorName: "I. Radu",
    authorRoleMain: "EXECUTANT",
    authorSubRole: "Zidar",
    authorVerification: "DECLARED",
    interactionCount: 8,
  },
  {
    title: "Hidroizolație radier — racord perete subsol",
    description: "Racordul hidroizolației orizontale cu cea verticală la baza peretelui de subsol.",
    categoryName: "Fundații & hidroizolații",
    authorName: "A. Ionescu",
    authorRoleMain: "PROIECTANT",
    authorSubRole: "Inginer structurist",
    authorVerification: "VERIFIED",
    interactionCount: 6,
  },
  {
    title: "Prag ușă terasă — fără punte termică",
    description: "Soluție de prag cu profil de întrerupere termică și scurgere controlată a apei.",
    categoryName: "Tâmplărie",
    authorName: "D. Marin",
    authorRoleMain: "FURNIZOR",
    authorSubRole: "Furnizor tâmplărie",
    authorVerification: "DECLARED",
    interactionCount: 4,
  },
  {
    title: "Streașină — ventilare strat de aer",
    description: "Detaliu de streașină cu ventilarea stratului de aer sub învelitoare.",
    categoryName: "Acoperișuri",
    authorName: "C. Dumitru",
    authorRoleMain: "EXECUTANT",
    authorSubRole: "Dulgher",
    authorVerification: "DECLARED",
    interactionCount: 3,
  },
  {
    title: "Soclu — racord termosistem la hidroizolație",
    description: "Trecerea de la termosistemul fațadei la hidroizolația soclului, cu profil de soclu.",
    categoryName: "Fațade & termosistem",
    authorName: "E. Stan",
    authorRoleMain: "BENEFICIAR",
    authorSubRole: "Dezvoltator",
    authorVerification: "DECLARED",
    interactionCount: 1,
  },
];

const catIdByName = new Map(MOCK_CATEGORIES.map((c) => [c.name, c.id]));

export const MOCK_FEED: FeedItem[] = SEEDS.map((s, i) => ({
  id: `mock-${i + 1}`,
  title: s.title,
  description: s.description,
  imageUrl: IMG,
  climateZone: "",
  seismicZone: "",
  status: "PUBLISHED",
  createdAt: new Date(),
  categoryId: catIdByName.get(s.categoryName) ?? "cat-1",
  categoryName: s.categoryName,
  categorySlug: null,
  authorId: `author-${i + 1}`,
  authorName: s.authorName,
  authorImage: null,
  authorRoleMain: s.authorRoleMain,
  authorSubRole: s.authorSubRole,
  authorVerification: s.authorVerification,
  interactionCount: s.interactionCount,
}));
