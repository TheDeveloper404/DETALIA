// Cookie de intenție pt link de referral — pus de `proxy.ts` la vizita `/signup?ref=<cod>`, citit
// (și șters) în `app/onboarding/actions.ts` (singurul punct cu Server Action, deci cu voie să scrie
// cookie-uri, la finalul fluxului de creare cont). Nu e secret — doar codul non-ghicibil al altcuiva,
// vezi server/domain/referral.ts.
export const REFERRAL_COOKIE_NAME = "detalia_ref";
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 zile — suficient pt „văd link, mă hotărăsc mai târziu"
