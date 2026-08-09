# Changelog

## 0.2.0

- **Database & Security**:
  - Added baseline database schema migration `20260809000000_baseline_schema.sql` for clean provisioning and `supabase db reset`.
  - Enabled RLS and granular policies on legacy social tables (`post_likes`, `post_rsvps`, `post_poll_votes`, `post_reports`, `user_saved_posts`, `user_hidden_posts`, `hood_messages`).
  - Hardened user PII and restricted self-service updates to reputation, account_type, and author tag verification fields.
  - Added `storage.objects` policies for bucket `tag-images`.
- **Infrastructure & API Proxies**:
  - Standardized Nominatim proxy parameters (`addressdetails=1`), sanitized coordinates (`encodeURIComponent`), added `AbortSignal.timeout`, and fixed error response cache headers.
  - Added `public/_headers` defining CSP, HSTS, rate-limiting, and security rules for Cloudflare Pages CSR deployment.
  - Implemented exponential backoff auto-retry strategy on WebSocket `CHANNEL_ERROR` in `RealtimeService`.
  - Lazy-loaded realtime subscriptions in `SocialInteractionsService` to eliminate boot overhead for unauthenticated sessions.
- **Frontend & Performance**:
  - Pre-computed comment reply maps in `PostDetailPage` to remove $O(N^2)$ template iteration.
  - Removed template side-effects from `trustScore()` and expanded `ChangeDetectionStrategy.OnPush` adoption.
  - Added generic `Database` types for Supabase client queries.
- **Tooling & Code Hygiene**:
  - Restored ESLint rule severities, added `e2e/**` to linting scope, and added `src/**/*.html` to Prettier checks.
  - Consolidated duplicate Playwright E2E spec suites and safeguarded URI decoding in `serve-e2e.mjs`.
  - Added Google Fonts to NGSW offline precache and added missing SEO/OpenGraph meta tags in `src/index.html`.

## 0.1.0

- Adds repository quality gates, coverage reporting, and continuous integration.
- Begins the production-hardening work for typed errors, browser persistence, and telemetry.
- Enforces the current coverage baseline (27% statements, 30% lines, 15% functions, 10% branches); CI will ratchet these to the 70/70/70/60 target as feature coverage is added.
