import type { ValidationPosition } from "@/server/domain/validation";

// Pură, izolată în fișier propriu (nu în feed-validation-actions.tsx) — acel fișier importă lanțul de
// server actions ("use server" → next-auth), care nu se poate rezolva curat sub Vitest. Count-ul afișat
// lângă iconiță se ajustează optimist doar la cele două tranziții posibile din UI (nu poți trece direct
// Aprob→Dezaprob, doar via Retrage): null→poziție (+1) sau poziție→null (-1).
export function computeOptimisticValidationCount(
  baseCount: number,
  originalPosition: ValidationPosition | null,
  optimisticPosition: ValidationPosition | null,
): number {
  if (originalPosition === null && optimisticPosition !== null) return baseCount + 1;
  if (originalPosition !== null && optimisticPosition === null) return baseCount - 1;
  return baseCount;
}
