import { isUuid } from "@/server/domain/ids";
import {
  followTargetExists,
  isFollowing,
  listFollowedUsersPage,
  setFollowing,
  type FollowKind,
} from "@/server/repos/followsRepo";

export type FollowedUsersPage = {
  users: Awaited<ReturnType<typeof listFollowedUsersPage>>;
  nextCursor: string | null;
};

export async function getFollowedUsers(userId: string, cursor: unknown = null) {
  if (cursor !== null && !isUuid(cursor)) return { ok: false as const };
  const rows = await listFollowedUsersPage(userId, cursor);
  const users = rows.slice(0, 20);
  return { ok: true as const, users, nextCursor: rows.length > 20 ? users[users.length - 1].id : null };
}

export async function getFollowState(userId: string, kind: FollowKind, targetId: string) {
  if (!isUuid(targetId) || userId === targetId) return false;
  return isFollowing(userId, kind, targetId);
}

export async function setFollow(input: {
  userId: string;
  kind: string;
  targetId: string;
  followed: unknown;
}) {
  if (
    (input.kind !== "USER" && input.kind !== "CATEGORY") ||
    !isUuid(input.targetId) ||
    typeof input.followed !== "boolean" ||
    (input.kind === "USER" && input.targetId === input.userId)
  )
    return { ok: false as const };
  if (input.followed && !(await followTargetExists(input.kind, input.targetId)))
    return { ok: false as const };
  await setFollowing(input.userId, input.kind, input.targetId, input.followed);
  return { ok: true as const, followed: input.followed };
}
