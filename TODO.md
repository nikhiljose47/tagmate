# Tagmate TODO and Release Checklist

This file tracks the 26-item hardening list. The implementation work is present on this branch; items marked as pending require a real Supabase environment, staging credentials, or release verification.

## Pending before publishing to production

- [ ] Apply and verify the Supabase migrations with `supabase db reset` in a disposable staging project, then run the RLS, PII, storage, cron, index, and reputation checks.
- [ ] Provide a separate staging Supabase URL and anon key. The staging build mode is distinct, but it currently points at the same backend as production because no separate staging backend was supplied.
- [ ] Run the seeded Playwright suite against staging with all five E2E accounts and review the generated report.
- [ ] Review and resolve the vulnerabilities reported by `npm audit` (the dependency sync currently reports 31 vulnerabilities).
- [ ] Perform a manual production smoke test for authentication, public profiles, posts, comments, likes, RSVPs, polls, uploads, messaging, notifications, and realtime reconnects.

## Original 26-item checklist

- [x] **#1 RLS Policies** — Added strict RLS and ownership policies for the seven legacy social tables. Pending live database verification.
- [x] **#2 Database Baseline** — Added an ordered baseline schema for users, tags, comments, social tables, messages, and notifications. Pending `db reset` verification.
- [x] **#3 PII and Contact Harvesting** — Added safe public/self profile views and private-column protections.
- [x] **#4 Self-Service Privilege** — Added trigger protections for reputation, account type, verification, counters, and status fields.
- [x] **#7 Nominatim Proxy** — Added input validation, URL encoding, request timeouts, method restrictions, and non-cacheable error responses.
- [x] **#8 Expiring Hot-Now Cron** — Made expiration scheduling idempotent and changed cleanup to soft-close all expiring tags.
- [x] **#9 Realtime Reconnect Strategy** — Added exponential backoff for channel errors/timeouts with continued retries.
- [x] **#10 Realtime Boot Overhead** — Realtime feeds are activated by mounted features and are skipped for anonymous users.
- [x] **#11 Express/Server Proxy Security** — Hardened proxy request handling, validation, headers, and upstream failure responses.
- [x] **#12 Template Performance and OnPush** — Added OnPush to all components, computed template state, and removed repeated nested/template work.
- [x] **#13 Reputation and Trust Score** — Moved reputation and first-action quest rewards into Postgres security-definer trigger functions.
- [x] **#14 Storage Bucket Policies** — Added bucket limits, MIME restrictions, public reads, and owner-scoped upload/delete policies.
- [x] **#15 Query and Index Performance** — Removed lower-case query expressions where possible and added functional/foreign-key indexes.
- [x] **#16 ESLint and Formatter Rules** — Re-enabled strict lint rules, Angular recommended rules, E2E linting, and formatting checks.
- [x] **#17 Dead Code Removal** — Removed the unused toggle store, legacy utility methods/tests, and unreferenced `tags.json`.
- [ ] **#18 Staging vs Production** — Added environment names and build replacements; separate staging backend credentials remain to be supplied.
- [x] **#19 Playwright Cleanup and Seeding** — Consolidated duplicate specs and added automatic deterministic seeding in global setup. Pending live E2E run.
- [x] **#20 TypeScript Strict Knobs** — Enabled unused-local, unused-parameter, and unchecked-index checks and fixed resulting errors.
- [x] **#21 Supabase Type Safety** — Wired the typed `Database` interface into `SupabaseClientService` and removed production untyped row assertions.
- [x] **#22 Node Modules Sync** — Ran `npm install --ignore-scripts` and synchronized the lockfile with the declared dependencies.
- [x] **#23 Documentation Drift** — Fixed dead absolute links, migration timestamp duplication, changelog drift, and stale legacy files.
- [x] **#24 Dependencies and Engine** — Removed the direct `xhr2` dependency, aligned Node 22 types, and aligned Cloudflare compatibility dates.
- [x] **#25 PWA and Meta Tags** — Added Google Fonts URL precaching and description, Open Graph, theme-color, and Apple touch icon metadata.
- [x] **#26 Script Hardening and Env Example** — Hardened malformed URI handling in the E2E server and documented `SUPABASE_SERVICE_ROLE_KEY`.

## Verification completed locally

- `npm run format:check`
- `npm run lint`
- `npm run test:ci` — 218 tests passed
- `npm run build`
- `git diff --check`
