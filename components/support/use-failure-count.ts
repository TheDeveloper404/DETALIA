"use client";

import { useState } from "react";

// Numără eșecurile consecutive ale unui flux. `failure` = orice valoare nouă (obiectul de stare al lui
// useActionState, un mesaj de eroare setat după un null) înseamnă încă un eșec; null/undefined = nimic.
// Ajustare de stare în render (nu useEffect), tiparul React pentru „stare derivată din o valoare care se schimbă".
export function useFailureCount(failure: unknown): number {
  const [prev, setPrev] = useState<unknown>(failure);
  const [count, setCount] = useState(failure ? 1 : 0);
  if (failure !== prev) {
    setPrev(failure);
    if (failure) setCount(count + 1);
  }
  return count;
}
