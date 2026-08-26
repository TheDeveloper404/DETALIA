// Conținutul panoului „Ce e nou" — de actualizat manual când apare ceva ce merită anunțat userilor
// (feature nou, nu fix/polish). Bump-uiește CURRENT_ANNOUNCEMENT_VERSION la orice schimbare de conținut,
// altfel userii care au văzut deja o versiune veche nu revăd panoul.
export const CURRENT_ANNOUNCEMENT_VERSION = "2026-08-26";

export type AnnouncementItem = {
  title: string;
  body: string;
};

export const ANNOUNCEMENT_ITEMS: AnnouncementItem[] = [
  {
    title: "Proiecte",
    body: "Poți grupa acum mai multe detalii sub un Proiect — cu planșă de schițare partajată între colaboratori, aprobări/dezaprobări pe fiecare detaliu, și control cine are acces.",
  },
  {
    title: "Schițare colaborativă — planșă pe straturi",
    body: "Planșa de schițare are acum un instrument de desen liber (creion) cu straturi (foi) suprapuse — poți schița peste o schiță existentă fără s-o pierzi.",
  },
  {
    title: "Profil îmbunătățit",
    body: "Profilul are acum badge-uri (puncte pentru activitate), afișează de când ești membru, iar zona de rol & verificare e reorganizată mai clar.",
  },
  {
    title: "Tur ghidat pentru cei noi",
    body: "Userii noi primesc acum un scurt tur ghidat al platformei la înregistrare.",
  },
  {
    title: "Ofertă de materiale",
    body: "Furnizorii pot trimite acum o ofertă reală pe un detaliu — mesaj + fișiere (PDF/Excel/CSV) — vizibilă strict autorului detaliului.",
  },
  {
    title: "Adu un prieten",
    body: "Ai acum un link de referral pe profil — dacă un prieten își face cont prin el, primești o notificare, iar la 10 useri aduși primești badge-ul „Creștem împreună”.",
  },
];
