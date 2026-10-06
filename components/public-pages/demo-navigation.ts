// Navigație locală de prezentare; nu schimbă starea sau regulile produsului.
export function nextDemoTabId<T extends string>(
  ids: readonly T[],
  current: T,
  key: string,
): T | null {
  if (ids.length === 0) return null;
  const index = Math.max(0, ids.indexOf(current));
  if (key === "Home") return ids[0];
  if (key === "End") return ids[ids.length - 1];
  if (key === "ArrowRight" || key === "ArrowDown") return ids[(index + 1) % ids.length];
  if (key === "ArrowLeft" || key === "ArrowUp") return ids[(index + ids.length - 1) % ids.length];
  return null;
}
