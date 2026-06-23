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
  validationCount: number;
  commentCount: number;
  sketchCount: number;
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
    validationCount: 14,
    commentCount: 9,
    sketchCount: 4,
  },
  {
    title: "Buiandrug peste gol fereastră — termosistem",
    description: "Întreruperea punții termice la buiandrug. Variante de armare și fixare a plăcii.",
    categoryName: "Fațade & termosistem",
    authorName: "I. Radu",
    authorRoleMain: "EXECUTANT",
    authorSubRole: "Zidar",
    authorVerification: "DECLARED",
    validationCount: 22,
    commentCount: 17,
    sketchCount: 6,
  },
  {
    title: "Hidroizolație radier — racord perete subsol",
    description: "Racordul hidroizolației orizontale cu cea verticală la baza peretelui de subsol.",
    categoryName: "Fundații & hidroizolații",
    authorName: "A. Ionescu",
    authorRoleMain: "PROIECTANT",
    authorSubRole: "Inginer structurist",
    authorVerification: "VERIFIED",
    validationCount: 31,
    commentCount: 12,
    sketchCount: 5,
  },
  {
    title: "Prag ușă terasă — fără punte termică",
    description: "Soluție de prag cu profil de întrerupere termică și scurgere controlată a apei.",
    categoryName: "Tâmplărie",
    authorName: "D. Marin",
    authorRoleMain: "FURNIZOR",
    authorSubRole: "Furnizor tâmplărie",
    authorVerification: "DECLARED",
    validationCount: 9,
    commentCount: 5,
    sketchCount: 2,
  },
  {
    title: "Streașină — ventilare strat de aer",
    description: "Detaliu de streașină cu ventilarea stratului de aer sub învelitoare.",
    categoryName: "Acoperișuri",
    authorName: "C. Dumitru",
    authorRoleMain: "EXECUTANT",
    authorSubRole: "Dulgher",
    authorVerification: "DECLARED",
    validationCount: 18,
    commentCount: 7,
    sketchCount: 3,
  },
  {
    title: "Soclu — racord termosistem la hidroizolație",
    description: "Trecerea de la termosistemul fațadei la hidroizolația soclului, cu profil de soclu.",
    categoryName: "Fațade & termosistem",
    authorName: "E. Stan",
    authorRoleMain: "BENEFICIAR",
    authorSubRole: "Dezvoltator",
    authorVerification: "DECLARED",
    validationCount: 11,
    commentCount: 14,
    sketchCount: 7,
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
  validationCount: s.validationCount,
  commentCount: s.commentCount,
  sketchCount: s.sketchCount,
  interactionCount: s.validationCount + s.commentCount + s.sketchCount,
}));

// Categorii + nr. de detalii (derivat din feed-ul mock) — pentru sidebar/rail.
export const MOCK_CATEGORIES_WITH_COUNTS = MOCK_CATEGORIES.map((c) => ({
  ...c,
  count: MOCK_FEED.filter((d) => d.categoryId === c.id).length,
}));

// Profil mock pentru cardul din sidebar (fără auth în preview).
export const MOCK_PROFILE = {
  name: "Andrei Munteanu",
  image: null as string | null,
  roleLabel: "Proiectant · Structuri",
  verified: true,
};
