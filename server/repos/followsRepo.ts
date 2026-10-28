import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, categoryFollows, userFollows, users } from "@/db/schema";
export type FollowKind = "USER" | "CATEGORY";

export async function followTargetExists(kind: FollowKind, targetId: string) {
  if (kind === "USER") {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, targetId), eq(users.status, "ACTIVE")))
      .limit(1);
    return !!row;
  }
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, targetId), eq(categories.isGroup, false)))
    .limit(1);
  return !!row;
}

export async function isFollowing(userId: string, kind: FollowKind, targetId: string) {
  if (kind === "USER") {
    const [row] = await db
      .select({ id: userFollows.followedUserId })
      .from(userFollows)
      .where(and(eq(userFollows.followerUserId, userId), eq(userFollows.followedUserId, targetId)))
      .limit(1);
    return !!row;
  }
  const [row] = await db
    .select({ id: categoryFollows.categoryId })
    .from(categoryFollows)
    .where(and(eq(categoryFollows.userId, userId), eq(categoryFollows.categoryId, targetId)))
    .limit(1);
  return !!row;
}

export async function setFollowing(
  userId: string,
  kind: FollowKind,
  targetId: string,
  followed: boolean,
) {
  if (kind === "USER") {
    if (followed)
      await db
        .insert(userFollows)
        .values({ followerUserId: userId, followedUserId: targetId })
        .onConflictDoNothing();
    else
      await db
        .delete(userFollows)
        .where(
          and(eq(userFollows.followerUserId, userId), eq(userFollows.followedUserId, targetId)),
        );
  } else {
    if (followed)
      await db
        .insert(categoryFollows)
        .values({ userId, categoryId: targetId })
        .onConflictDoNothing();
    else
      await db
        .delete(categoryFollows)
        .where(and(eq(categoryFollows.userId, userId), eq(categoryFollows.categoryId, targetId)));
  }
}
