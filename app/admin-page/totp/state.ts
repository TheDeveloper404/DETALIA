// Stare partajată între server action (`actions.ts`, „use server") și formularul client
// (`totp-form.tsx`). NU stă în `actions.ts`: un fișier „use server" poate exporta DOAR funcții
// async — un `export const` obiect rupe randarea Server Component în producție.

export type TotpState = {
  error: string | null;
  /** Codurile de rezervă, întoarse O SINGURĂ dată, imediat după înrolare. */
  backupCodes: string[] | null;
};

export const INITIAL_TOTP_STATE: TotpState = { error: null, backupCodes: null };
