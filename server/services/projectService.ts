// Service Proiecte — colaborare restrânsă (2026-08-09).
// Reguli NON-NEGOCIABILE (enforce pe SERVER, nu pe frontend):
//  - Doar 2 poziții: Autor (owner) și Invitați — Invitații se comportă identic cu owner-ul, în rest.
//  - Poarta de acces (canAccessProjectDetail) e SINGURUL punct de control pentru vizibilitatea
//    privată — orice service care citește un detaliu de proiect trece prin ea. Nu se duplică logica.
//  - „Scoate în comunitate" e ireversibilă — nicio cale de întoarcere prin cod.

import { generateInviteToken } from "@/lib/invite-token";
import { deleteBlobs, uploadProjectCanvasShare } from "@/lib/storage";
import {
  canReleaseToCommunity,
  hasProjectAccess,
  validateProjectName,
} from "@/server/domain/project";
import { isUuid } from "@/server/domain/ids";
import {
  deleteDetailCascade,
  listAllProjectDetails,
  listProjectDetails,
  listReleasedProjectDetails,
} from "@/server/repos/detailsRepo";
import { getCanvasById } from "@/server/repos/plansaRepo";
import {
  countCanvasSharesByProject,
  deleteCanvasShare as deleteCanvasShareRow,
  getCanvasShareById,
  insertCanvasShare,
  listCanvasSharesByProject,
} from "@/server/repos/projectCanvasSharesRepo";
import {
  countActiveMembers,
  isActiveMember,
  listActiveMembers,
  removeMembership,
  upsertActiveMembership,
} from "@/server/repos/projectMembersRepo";
import {
  countProjectsOwnedBy,
  deleteProject as deleteProjectRow,
  getProjectById,
  getProjectByInviteToken,
  insertProject,
  listProjectsForUser as listProjectsForUserRow,
  updateInviteToken,
  updateProjectName,
} from "@/server/repos/projectsRepo";
import { getUserWithRole } from "@/server/repos/usersRepo";

// SEC-010 (audit securitate 2026-08-11): plafoane anti-abuz — tunabile din env (niciodată hardcodate),
// generoase pentru uz real (comunitate mică), dar opresc flood-ul/costul nelimitat de storage.
const MAX_PROJECTS_PER_OWNER = Number(process.env.PROJECT_MAX_PER_OWNER ?? 50);
const MAX_MEMBERS_PER_PROJECT = Number(process.env.PROJECT_MAX_MEMBERS ?? 100);
const MAX_CANVAS_SHARES_PER_PROJECT = Number(process.env.PROJECT_MAX_CANVAS_SHARES ?? 100);

export type CreateProjectResult =
  | { ok: true; projectId: string; inviteToken: string }
  | { ok: false; error: "EMPTY" | "TOO_LONG" | "LIMIT_REACHED" };

export async function createProject(input: {
  ownerId: string;
  name: string;
}): Promise<CreateProjectResult> {
  const validated = validateProjectName(input.name);
  if (!validated.ok) return { ok: false, error: validated.error };

  if ((await countProjectsOwnedBy(input.ownerId)) >= MAX_PROJECTS_PER_OWNER) {
    return { ok: false, error: "LIMIT_REACHED" };
  }

  const inviteToken = generateInviteToken();
  const project = await insertProject({ ownerId: input.ownerId, name: validated.value, inviteToken });
  return { ok: true, projectId: project.id, inviteToken: project.inviteToken };
}

export type RenameProjectResult =
  | { ok: true }
  | { ok: false; error: "EMPTY" | "TOO_LONG" | "NOT_FOUND" | "FORBIDDEN" };

// Redenumire inline (dublu-click pe titlu, UI) — DOAR owner-ul.
export async function renameProject(input: {
  projectId: string;
  requesterId: string;
  name: string;
}): Promise<RenameProjectResult> {
  if (!isUuid(input.projectId)) return { ok: false, error: "NOT_FOUND" };
  const project = await getProjectById(input.projectId);
  if (!project) return { ok: false, error: "NOT_FOUND" };
  if (project.ownerId !== input.requesterId) return { ok: false, error: "FORBIDDEN" };

  const validated = validateProjectName(input.name);
  if (!validated.ok) return { ok: false, error: validated.error };

  await updateProjectName(input.projectId, validated.value);
  return { ok: true };
}

// Poarta de acces la un proiect (rândul lui, nu la un detaliu anume) — owner SAU membru activ.
export async function getProjectAccess(input: {
  projectId: string;
  userId: string;
}): Promise<{ isOwner: boolean; isActiveMember: boolean; hasAccess: boolean }> {
  // SEC-11: id malformat → „nu există" (nu eroare SQL pe coloana uuid). Poartă centrală — majoritatea
  // funcțiilor de mai jos trec prin asta, dar cele care citesc direct getProjectById au propria gardă.
  if (!isUuid(input.projectId)) return { isOwner: false, isActiveMember: false, hasAccess: false };
  const project = await getProjectById(input.projectId);
  if (!project) return { isOwner: false, isActiveMember: false, hasAccess: false };
  const isOwner = project.ownerId === input.userId;
  // Owner-ul nu are neapărat un rând în project_members (vezi db/schema.ts) — nu mai plătim query-ul
  // de membru dacă e deja owner.
  const member = isOwner ? false : await isActiveMember(input.projectId, input.userId);
  return { isOwner, isActiveMember: member, hasAccess: hasProjectAccess({ isOwner, isActiveMember: member }) };
}

// SINGURUL punct de control pentru vizibilitatea unui detaliu de proiect — apelat din
// detailService.getDetail. `projectId` vine din rândul detaliului (poate fi null → nu se apelează).
export async function canAccessProjectDetail(input: {
  projectId: string;
  userId: string;
}): Promise<boolean> {
  const access = await getProjectAccess(input);
  return access.hasAccess;
}

// Pagina unui proiect: rândul + membrii activi, DOAR dacă requester-ul are acces. `null` dacă nu are
// (anti-enumerare — aceeași formă ca „proiect inexistent", pagina face notFound() la fel).
export async function getProjectForViewer(input: { projectId: string; userId: string }) {
  const access = await getProjectAccess(input);
  if (!access.hasAccess) return null;
  const project = await getProjectById(input.projectId);
  if (!project) return null;
  const [members, owner] = await Promise.all([
    listActiveMembers(input.projectId),
    getUserWithRole(project.ownerId),
  ]);
  // SEC-004 (audit 2026-08-11): tokenul de invitație e un secret — poarta care-l apără trebuie să fie
  // AICI, nu doar disciplina fiecărui consumator (bug-ul de azi era exact asta: pagina afișa condiționat
  // butonul, dar DTO-ul purta tokenul mai departe către oricine avea acces la proiect). Non-owner primește
  // `null`, indiferent ce face UI-ul cu el.
  return {
    project: { ...project, inviteToken: access.isOwner ? project.inviteToken : null },
    members,
    owner,
    isOwner: access.isOwner,
  };
}

// Proiectele accesibile userului (owner SAU membru activ) — pentru /projects și selectorul de la
// creare detaliu.
export async function listProjectsForUser(userId: string) {
  return listProjectsForUserRow(userId);
}

export type JoinProjectResult =
  | { ok: true; projectId: string; projectName: string }
  | { ok: false; error: "INVALID_TOKEN" | "LIMIT_REACHED" };

// Alăturare prin link de invitație. Idempotent: userul deja membru care re-folosește linkul rămâne
// membru (upsertActiveMembership reactivează, nu duplică). Owner-ul care „se alătură" propriului
// proiect primește și el un rând de membru — inofensiv (poarta de acces oricum îl lasă prin ownerId).
export async function joinProjectByToken(input: {
  token: string;
  userId: string;
}): Promise<JoinProjectResult> {
  const project = await getProjectByInviteToken(input.token);
  if (!project) return { ok: false, error: "INVALID_TOKEN" };

  // SEC-010: plafonul nu blochează re-alăturarea (idempotent, deja membru) sau owner-ul.
  const alreadyActive =
    project.ownerId === input.userId || (await isActiveMember(project.id, input.userId));
  if (!alreadyActive && (await countActiveMembers(project.id)) >= MAX_MEMBERS_PER_PROJECT) {
    return { ok: false, error: "LIMIT_REACHED" };
  }

  await upsertActiveMembership(project.id, input.userId);
  return { ok: true, projectId: project.id, projectName: project.name };
}

// Previzualizare pentru /projects/join/[token] — DOAR numele, accesibil și fără sesiune (userul
// trebuie să vadă ÎN CE se alătură înainte de a se autentifica). Nu expune ownerId/membri.
export async function getProjectPreviewByToken(token: string) {
  const project = await getProjectByInviteToken(token);
  return project ? { id: project.id, name: project.name } : null;
}

export type RemoveMemberResult = { ok: true } | { ok: false; error: "NOT_FOUND" | "FORBIDDEN" };

// Eliminare membru — DOAR owner-ul proiectului. Nu se poate elimina pe SINE (owner-ul nu e membru în
// sensul ăsta — el ȘTERGE proiectul dacă vrea să iasă din el, vezi deleteProject mai jos).
export async function removeMember(input: {
  projectId: string;
  requesterId: string;
  targetUserId: string;
}): Promise<RemoveMemberResult> {
  if (!isUuid(input.projectId) || !isUuid(input.targetUserId)) return { ok: false, error: "NOT_FOUND" }; // SEC-11
  const project = await getProjectById(input.projectId);
  if (!project) return { ok: false, error: "NOT_FOUND" };
  if (project.ownerId !== input.requesterId) return { ok: false, error: "FORBIDDEN" };
  await removeMembership(input.projectId, input.targetUserId);
  return { ok: true };
}

export type RegenerateInviteResult =
  | { ok: true; inviteToken: string }
  | { ok: false; error: "NOT_FOUND" | "FORBIDDEN" };

// Regenerare link — DOAR owner. Vechiul link devine instant invalid (suprascris, nu mai există nicăieri).
export async function regenerateInviteLink(input: {
  projectId: string;
  requesterId: string;
}): Promise<RegenerateInviteResult> {
  if (!isUuid(input.projectId)) return { ok: false, error: "NOT_FOUND" }; // SEC-11
  const project = await getProjectById(input.projectId);
  if (!project) return { ok: false, error: "NOT_FOUND" };
  if (project.ownerId !== input.requesterId) return { ok: false, error: "FORBIDDEN" };
  const inviteToken = generateInviteToken();
  await updateInviteToken(input.projectId, inviteToken);
  return { ok: true, inviteToken };
}

export type DeleteProjectResult = { ok: true } | { ok: false; error: "NOT_FOUND" | "FORBIDDEN" };

// Ștergere proiect — DOAR owner. Membrii cad în cascada de FK, dar detaliile NU pot fi lăsate pe seama
// ei: validările și comentariile sunt POLIMORFICE (target_type/target_id, fără FK spre details/sketches)
// → ar rămâne orfane în DB, pointând spre UUID-uri moarte, iar imaginile, thumbnail-urile schițelor,
// resursele și pozele din comentarii ar rămâne în Blob, plătite la nesfârșit. Fiecare detaliu încă în
// proiect trece prin exact aceeași cascadă ca la ștergerea individuală (deleteDetailCascade). Detaliile
// deja scoase în comunitate au projectId=null → nu sunt atinse.
export async function deleteProject(input: {
  projectId: string;
  requesterId: string;
}): Promise<DeleteProjectResult> {
  if (!isUuid(input.projectId)) return { ok: false, error: "NOT_FOUND" }; // SEC-11
  const project = await getProjectById(input.projectId);
  if (!project) return { ok: false, error: "NOT_FOUND" };
  if (project.ownerId !== input.requesterId) return { ok: false, error: "FORBIDDEN" };

  const projectDetails = await listAllProjectDetails(input.projectId);
  const blobUrls: (string | null)[] = [];
  for (const detail of projectDetails) {
    blobUrls.push(...(await deleteDetailCascade(detail.id)), detail.imageUrl);
  }

  // Partajările de planșă cad în cascadă la DB (FK onDelete: cascade pe project_id) — dar fișierele lor
  // din Blob NU (capcana cunoscută: cascada de FK nu atinge storage-ul extern). Colectăm URL-urile ÎNAINTE
  // ca rândurile să dispară.
  const shares = await listCanvasSharesByProject(input.projectId);
  blobUrls.push(...shares.map((s) => s.imageUrl));

  await deleteProjectRow(input.projectId);
  // Blob-urile la final: dacă pică, rândurile sunt deja consistente (fișiere orfane > date orfane).
  await deleteBlobs(blobUrls);
  return { ok: true };
}

export type CanReleaseResult = { allowed: true } | { allowed: false; error: "FORBIDDEN" };

// Regula „orfan": poate `requesterId` scoate în comunitate un detaliu al cărui autor e `detailAuthorId`,
// dintr-un proiect al cărui owner e `projectOwnerId`? Vezi server/domain/project.ts (canReleaseToCommunity)
// pentru regula pură — aici doar rezolvăm „autorul mai e membru activ?" din DB.
export async function canReleaseDetailToCommunity(input: {
  projectId: string;
  detailAuthorId: string;
  projectOwnerId: string;
  requesterId: string;
}): Promise<CanReleaseResult> {
  // SEC-11: proiectId vine mereu dintr-un detail.projectId deja citit din DB (nu direct din client) —
  // gardă defensivă totuși, ca să nu depindă tacit de apelant.
  if (!isUuid(input.projectId)) return { allowed: false, error: "FORBIDDEN" };
  const isDetailAuthor = input.requesterId === input.detailAuthorId;
  const isProjectOwner = input.requesterId === input.projectOwnerId;
  // Owner-ul autor al propriului detaliu e mereu considerat „membru activ" (nu are neapărat rând în
  // project_members) — altfel regula „orfan" l-ar trata greșit ca plecat din propriul proiect.
  const authorIsActiveMember =
    input.detailAuthorId === input.projectOwnerId ||
    (await isActiveMember(input.projectId, input.detailAuthorId));

  const allowed = canReleaseToCommunity({ isDetailAuthor, isProjectOwner, authorIsActiveMember });
  return allowed ? { allowed: true } : { allowed: false, error: "FORBIDDEN" };
}

// Passthrough deliberat (nu logică de business) — expus ca alte servicii (detailService) să nu ocolească
// stratul de service citind direct din projectsRepo pentru un simplu lookup.
export async function getProject(projectId: string) {
  if (!isUuid(projectId)) return null; // SEC-11
  return getProjectById(projectId);
}

// ── Variante FĂRĂ re-verificare de acces (2026-08-11, /code-review) ──────────────────────────────
// Pagina de proiect verifică accesul O SINGURĂ DATĂ prin `getProjectForViewer` (redirect/notFound dacă
// eșuează), apoi are nevoie de 3 liste separate pentru ACELAȘI proiect — variantele „ForViewer" de mai
// sus ar repeta verificarea de 3 ori în plus, cu propriul query în DB fiecare (paralelizate prin
// Promise.all, deci fără impact de latență, dar interogări evitabile). Aceste variante presupun accesul
// DEJA verificat de apelant în ACEEAȘI cerere — NU le folosi dacă nu ai verificat accesul chiar înainte.
export async function listProjectDetailsUnchecked(projectId: string) {
  return listProjectDetails(projectId);
}
export async function listReleasedDetailsUnchecked(projectId: string) {
  return listReleasedProjectDetails(projectId);
}
export async function listCanvasSharesUnchecked(projectId: string) {
  return listCanvasSharesByProject(projectId);
}

// ───────────────────────── Partajare planșă în proiect (§6B, Faza B) ─────────────────────────
// Copie ÎNGHEȚATĂ, needitabilă — planșa NU se creează în proiect, e adusă din contul personal al
// membrului (decizie de produs). Sursa e `canvases.thumbnailUrl`, deja un PNG compus la fiecare
// salvare a planșei — re-descărcăm bytes-urile SERVER-SIDE (fetch) și le re-încărcăm ca blob NOU (nu
// doar referință, și NU un export proaspăt client-side): reflectă ultima salvare a planșei, nu
// eventualele modificări nesalvate din editor. Independența de blob-ul original contează pentru
// ștergerea/editarea ulterioară a planșei sursă, nu pentru prospețime.

export type ShareCanvasResult =
  | { ok: true; shareId: string }
  | { ok: false; error: "NOT_FOUND" | "FORBIDDEN" | "EMPTY_CANVAS" | "UPLOAD_FAILED" | "LIMIT_REACHED" };

export async function shareCanvasToProject(input: {
  canvasId: string;
  projectId: string;
  userId: string;
}): Promise<ShareCanvasResult> {
  if (!isUuid(input.canvasId) || !isUuid(input.projectId)) return { ok: false, error: "NOT_FOUND" };

  const canvas = await getCanvasById(input.canvasId);
  // NOT_FOUND și pentru „nu e a ta" (anti-enumerare, la fel ca restul planșelor — SEC-11/IDOR pattern
  // deja folosit peste tot în plansaService): o planșă a altcuiva nu trebuie să dezvăluie că există.
  if (!canvas || canvas.ownerId !== input.userId) return { ok: false, error: "NOT_FOUND" };

  const access = await getProjectAccess({ projectId: input.projectId, userId: input.userId });
  if (!access.hasAccess) return { ok: false, error: "FORBIDDEN" };

  if (!canvas.thumbnailUrl) return { ok: false, error: "EMPTY_CANVAS" };

  if ((await countCanvasSharesByProject(input.projectId)) >= MAX_CANVAS_SHARES_PER_PROJECT) {
    return { ok: false, error: "LIMIT_REACHED" };
  }

  let blob: Blob;
  try {
    const res = await fetch(canvas.thumbnailUrl);
    if (!res.ok) return { ok: false, error: "UPLOAD_FAILED" };
    blob = await res.blob();
  } catch {
    return { ok: false, error: "UPLOAD_FAILED" };
  }

  const uploaded = await uploadProjectCanvasShare(blob);
  if (!uploaded.ok) return { ok: false, error: "UPLOAD_FAILED" };

  const now = new Date();
  const stamp = now.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = now.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  const share = await insertCanvasShare({
    projectId: input.projectId,
    sharedByUserId: input.userId,
    name: `${canvas.name} — ${stamp} ${time}`,
    imageUrl: uploaded.url,
  });
  return { ok: true, shareId: share.id };
}

export type DeleteCanvasShareResult = { ok: true } | { ok: false; error: "NOT_FOUND" | "FORBIDDEN" };

// Ștergere: cine a partajat-o SAU owner-ul proiectului (moderare, la fel ca la orice conținut de
// proiect) — nu oricine cu acces la proiect.
export async function deleteCanvasShareForUser(input: {
  shareId: string;
  userId: string;
}): Promise<DeleteCanvasShareResult> {
  if (!isUuid(input.shareId)) return { ok: false, error: "NOT_FOUND" };
  const share = await getCanvasShareById(input.shareId);
  if (!share) return { ok: false, error: "NOT_FOUND" };

  // SEC-009 (audit 2026-08-11): fostul sharer NU mai poate șterge partajarea după ce a fost eliminat
  // din proiect — citirea era deja închisă la eliminare, scrierea pe conținutul propriu rămăsese
  // deschisă (inconsecvență a graniței). `isSharer` singur nu mai e suficient — trebuie ȘI acces activ.
  const access = await getProjectAccess({ projectId: share.projectId, userId: input.userId });
  const isSharer = share.sharedByUserId === input.userId && access.hasAccess;
  if (!isSharer && !access.isOwner) return { ok: false, error: "FORBIDDEN" };

  const imageUrl = await deleteCanvasShareRow(input.shareId);
  await deleteBlobs([imageUrl]);
  return { ok: true };
}
