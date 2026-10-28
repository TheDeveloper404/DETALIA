export type LoginSession = {
  country: string | null;
  failViews: number;
  appViews: number;
};

export type LoginSummary = {
  scanners: number;
  ok: number;
  recovered: number;
  blocked: number;
  noOutcome: number;
};

// Scanerele de email deschid linkul din datacentere din afara RO, dupa user, si nu intra in aplicatie.
export function isLinkScanner(s: LoginSession): boolean {
  return s.country !== "RO" && s.appViews === 0;
}

export function summarizeLogin(sessions: LoginSession[]): LoginSummary {
  const summary: LoginSummary = { scanners: 0, ok: 0, recovered: 0, blocked: 0, noOutcome: 0 };
  for (const s of sessions) {
    if (isLinkScanner(s)) summary.scanners++;
    else if (s.failViews > 0 && s.appViews > 0) summary.recovered++;
    else if (s.failViews > 0) summary.blocked++;
    else if (s.appViews > 0) summary.ok++;
    else summary.noOutcome++;
  }
  return summary;
}
