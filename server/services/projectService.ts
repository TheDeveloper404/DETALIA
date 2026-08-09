// Service Proiecte — colaborare restrânsă (2026-08-09).
// Reguli NON-NEGOCIABILE (enforce pe SERVER, nu pe frontend):
//  - Doar 2 poziții: Autor (owner) și Invitați — Invitații se comportă identic cu owner-ul, în rest.
//  - Poarta de acces (canAccessProjectDetail) e SINGURUL punct de control pentru vizibilitatea
//    privată — orice service care citește un detaliu de proiect trece prin ea. Nu se duplică logica.
//  - „Scoate în comunitate" e ireversibilă — nicio cale de întoarcere prin cod.

import { generateInviteToken } from "@/lib/invite-token";
import { deleteBlobs } from "@/lib/storage";
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
} from "@/server/repos/detailsRepo";
import {
  isActiveMember,
  listActiveMembers,
  removeMembership,
  upsertActiveMembership,
} from "@/server/repos/projectMembersRepo";
import {
  deleteProject as deleteProjectRow,
  getProjectById,
  getProjectByInviteToken,
  insertProject,
  listProjectsForUser as listProjectsForUserRow,
  updateInviteToken,
} from "@/server/repos/projectsRepo";

export type CreateProjectResult =
  | { ok: true; projectId: string; inviteToken: string }
  | { ok: false; error: "EMPTY" | "TOO_LONG" };

export async function createProject(input: {
  ownerId: string;
  name: string;
}): Promise<CreateProjectResult> {
  const validated = validateProjectName(input.name);
  if (!validated.ok) return { ok: false, error: validated.error };

  const inviteToken = generateInviteToken();
  const project = await insertProject({ ownerId: input.ownerId, name: validated.value, inviteToken });
  return { ok: true, projectId: project.id, inviteToken: project.inviteToken };
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
  const members = await listActiveMembers(input.projectId);
  return { project, members, isOwner: access.isOwner };
}

// Proiectele accesibile userului (owner SAU membru activ) — pentru /projects și selectorul de la
// creare detaliu.
export async function listProjectsForUser(userId: string) {
  return listProjectsForUserRow(userId);
}

export type JoinProjectResult =
  | { ok: true; projectId: string; projectName: string }
  | { ok: false; error: "INVALID_TOKEN" };

// Alăturare prin link de invitație. Idempotent: userul deja membru care re-folosește linkul rămâne
// membru (upsertActiveMembership reactivează, nu duplică). Owner-ul care „se alătură" propriului
// proiect primește și el un rând de membru — inofensiv (poarta de acces oricum îl lasă prin ownerId).
export async function joinProjectByToken(input: {
  token: string;
  userId: string;
}): Promise<JoinProjectResult> {
  const project = await getProjectByInviteToken(input.token);
  if (!project) return { ok: false, error: "INVALID_TOKEN" };
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

// „Feed"-ul intern al unui proiect — DOAR dacă requester-ul are acces (aceeași poartă ca la pagina
// proiectului). `null` dacă nu are acces (anti-enumerare).
export async function listProjectDetailsForViewer(input: { projectId: string; userId: string }) {
  const access = await getProjectAccess(input);
  if (!access.hasAccess) return null;
  return listProjectDetails(input.projectId);
}
