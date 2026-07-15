<wizard-report>
# PostHog post-wizard report

The wizard has completed a full PostHog integration for DETALIA. Client-side analytics are initialized via `instrumentation-client.ts` (alongside the existing Sentry init), with a reverse proxy through `/ingest` to avoid ad-blockers. Server-side tracking is handled by a singleton `lib/posthog-server.ts` (posthog-node) injected into the relevant Server Actions — each action flushes before returning so events are never dropped. Users are identified by their Auth.js session ID via a `PostHogIdentify` client component mounted in the authenticated layout. No PII appears in `capture()` event properties; all person-level data (name) is sent via `identify()`.

| Event name | Description | File |
|---|---|---|
| `onboarding_completed` | User completed profile setup and declared a professional role for the first time. | `app/onboarding/actions.ts` |
| `detail_published` | User published a new construction detail (the core content unit of the platform). | `app/(app)/details/new/actions.ts` |
| `sketch_published` | User published a sketch drawn over an existing detail, entering the detail's sketch stack. | `app/(app)/sketches/[id]/edit/sketch-actions.ts` |
| `detail_approved` | User approved a detail or sketch, recording their professional position. | `app/(app)/details/[id]/validation-actions.ts` |
| `detail_disapproved` | User disapproved a detail or sketch with a mandatory written justification. | `app/(app)/details/[id]/validation-actions.ts` |
| `comment_added` | User added a comment on a detail or sketch. | `app/(app)/details/[id]/comment-actions.ts` |
| `detail_saved` | User bookmarked a detail to their personal saved collection. | `app/(app)/details/[id]/save-actions.ts` |
| `account_deleted` | User permanently deleted their account (GDPR anonymisation flow). | `app/(app)/profile/actions.ts` |

## New files

| File | Purpose |
|---|---|
| `instrumentation-client.ts` | Extended with `posthog.init()` (EU host, `/ingest` proxy, exception capture) |
| `lib/posthog-server.ts` | Server-side PostHog singleton (posthog-node, flushAt 1) |
| `components/posthog-identify.tsx` | Client component that calls `posthog.identify()` on every authenticated page |
| `next.config.ts` | Added `/ingest/*` rewrites to `eu.i.posthog.com` and `eu-assets.i.posthog.com` |
| `lib/csp.ts` | Added `/ingest` and `eu-assets.i.posthog.com` to `connect-src` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://eu.posthog.com/project/224228/dashboard/820335)
- [Onboarding → content funnel (wizard)](https://eu.posthog.com/project/224228/insights/fQjdALPE) — conversion from role declaration to first detail published
- [Content published over time (wizard)](https://eu.posthog.com/project/224228/insights/hWX4m2rt) — details and sketches per week
- [Community engagement over time (wizard)](https://eu.posthog.com/project/224228/insights/ku54fWjm) — approvals, disapprovals, comments per week
- [Role breakdown of onboarding completions (wizard)](https://eu.posthog.com/project/224228/insights/XYmRZE37) — which professional roles are joining
- [Account deletions — churn signal (wizard)](https://eu.posthog.com/project/224228/insights/snnCORDt) — irreversible churn over time

## Verify before merging

- [ ] Run a full production build (`npm run build`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example` so collaborators know what to set.
- [ ] Wire source-map upload into CI so production stack traces de-minify (PostHog captures exceptions via `capture_exceptions: true`).
- [ ] Confirm the returning-visitor path also calls `identify` — `PostHogIdentify` mounts in the authenticated layout on every page load, so returning sessions should be covered; verify in PostHog's Person activity that repeat visits link to the same person.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
</wizard-report>
