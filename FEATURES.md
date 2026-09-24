# Tagmate Features and Verification Guide

This document tracks all implemented core features of Tagmate, outlines proposed future updates, and defines the verification workflows required when making changes to the application.

> [!IMPORTANT] > **Developer Agent Instruction**: Whenever a new feature is added, modified, or verification routines change, developer agents **must** update this file to ensure the features log, roadmap, and test procedures remain perfectly accurate.

---

## 1. Current Core Features

### V1 Pre-Release MVP Scope & Feature Flags

To prevent channel fragmentation and ensure maximum activity around core location posts upon initial launch, secondary channels and extra customizations are managed by `FeatureFlagsService` ([feature-flags.service.ts](src/app/core/services/feature-flags.service.ts)):

- **Lean MVP Launch Defaults**:
  - `enableChatmateAi`: `false` (AI Concierge tab/drawer hidden for V1)
  - `enableGroupChatrooms`: `false` (Group chatroom tab hidden for V1)
  - `enableBulletinBoard`: `false` (Sticky bulletin board tab hidden for V1)
  - `enableCivicQuests`: `false` (Quests & leaderboards hidden for V1)
  - `enableExtraThemes`: `false` (Restricts themes to `Light` & `Dark` for V1 launch clarity)
- **Zero Code Destruction**: All secondary feature modules remain 100% intact and can be toggled on demand post-launch via signal flags.

### Security, Database RLS & Production Hardening (V0.2.0)

- **Database RLS & Schema Baseline**: Baseline schema migration `20260809000000_baseline_schema.sql` establishes core table definitions. All 7 legacy social tables (`post_likes`, `post_rsvps`, `post_poll_votes`, `post_reports`, `user_saved_posts`, `user_hidden_posts`, `hood_messages`) are protected with RLS and user ownership policies.
- **PII & Privilege Protection**: Restricted profile SELECT policies to protect user PII (`email`, `business_phone`, `home_lat/lng`). Added database triggers enforcing column-level update restrictions so users cannot self-update `reputation` or `account_type` directly via client REST calls, and authors cannot overwrite post `verified` status.
- **Storage Object Security**: Added `storage.objects` policies for bucket `tag-images` restricting upload/delete actions to authenticated object owners.
- **Edge API & Nominatim Hardening**: Standardized geocoding parameters (`addressdetails=1`), added query parameter sanitization (`encodeURIComponent`), enforced fetch request timeout (`AbortSignal.timeout(8000)`), and corrected `Cache-Control` response headers (`no-store` on errors).
- **PWA & Offline Asset Precache**: Configured Google Fonts domains precaching in `ngsw-config.json` and added complete HTML meta tags (`description`, `og:*`, `theme-color`, `apple-touch-icon`) to `src/index.html`.

### Location-Based Posting & Map (Hood)

- **Interactive Mapping**: Renders high-performance map styles (Streets, Satellite, Hybrid, Outdoor) powered by MapLibre GL JS and MapTiler.
- **Geographic Clustering**: Implements WebGL clustering for neighborhood posts with dynamic zoom expansion on click.
- **Boundary Rendering**: Dynamic fetching and visual polygon boundary outline of neighborhoods using OpenStreetMap Nominatim API place boundaries.
- **Draggable Location Picker**: A temporary pick marker with geocoding feedback for attaching precise coordinates to new posts.
- **Heatmap Mode**: Visualization of high-density post areas with adjustable circle paint weights.
- **Geospatial Query Caching**: Front-end geocoding, reverse-geocoding, and boundary polygons are persisted in `localStorage` to reduce OpenStreetMap API network requests and prevent rate-limiting.
- _Detailed Guide: [Mapping & Geospatial](docs/MAPPING_AND_GEOSPATIAL.md)_

### Neighborhood AI Concierge ("Chatmate AI")

- **Dynamic Assistant Panel**: A slide-over glassmorphic chatbot panel in the Neighborhood view.
- **Dynamic Context Parsing**: Analyzes active neighborhood posts in real-time to answer neighbor queries about traffic alerts, sales, event schedules, and local recommendations.
- **Smarter Synonym Phrase Mapping**: Uses conversational synonym dictionaries (e.g. road closures, dining, bargains) to route natural queries to appropriate category lookups.
- **Quick Action Prompts**: Preset query buttons to summarize activity, check traffic status, or find local bargains in one tap.
- **Interactive Map Highlights**: Provides recommended tag attachments in the chat flow with direct "Pin on Map" and "Details" action links.
- **Polished UX**: Smooth typing status animations and distinct user/AI message alignment.
- _Detailed Guide: [AI Concierge](docs/AI_CONCIERGE.md)_

### Hood Champion & Gamification

- **Reputation & Ranks**: Tracks user contribution points ("Reputation") and assigns status badges (`New`, `Rising`, `Helpful`, `Trusted`).
- **Weekly Civic Quests**: Interactive checklists that reward contribution with reputation (Civic Love, Chatty Neighbor, Active Citizen, Vocal Resident). Authenticated users have their quest progress synced to Supabase Auth metadata across devices, while guest users fallback to browser `localStorage`.
- **Top Contributors Leaderboard**: Dynamic ranking of top neighbors in each neighborhood based on their post counts and trust metrics.
- _Detailed Guide: [Gamification & Reputation](docs/GAMIFICATION.md)_

### Social Interaction Suite

- **Direct Messaging**: Private message threads initiated from individual tags, allowing direct peer-to-peer neighborhood coordinate discussions.
- **Neighborhood Group Chatrooms**: Real-time websocket-backed room chats for broad neighborhood discussion without requiring a specific post, synced via Supabase Realtime.
- **Threaded Comments**: Interactive comment sections supporting parent-reply trees, comment liking, and user mentions.
- **Event RSVPs**: Attending/declining status tracking for posts of kind `event`.
- **Question Polls**: Custom question creation with up to 5 poll options, live percentage updates, and singular vote lock-in.
- **Rich Notifications**: Local message center notifying users of replies, new alerts, RSVPs, likes, and direct messages.
- _Detailed Guide: [Social Suite](docs/SOCIAL_SUITE.md)_

### Virtual Sticky Bulletin Board

- **Non-Geolocated Announcements**: A dedicated space for quick neighborhood announcements, requests, and posts (e.g. "Found keys at the park") without attaching map coordinates.
- **Responsive Notes Grid**: Renders short text announcements in a grid layout resembling physical colored sticky notes.
- **Dynamic Content Composer**: Note editing field capped at 160 characters with remaining character counter.
- **Access Control Deletion**: Deletion permissions enforced to restrict note removal only to the post's author.
- _Detailed Guide: [Social Suite (includes Bulletin Board)](docs/SOCIAL_SUITE.md)_

### Aesthetics & Customizations

- **Curated Theme Modes**: Instant switching across custom color schemes: `Light`, `Dark`, `Midnight` (OLED black), `Forest`, and `Sepia`.
- **Dynamic Gradients**: Color-gradient headers mapping to different post category tags (Alert, Event, Sale, Food, Traffic, Market, Question).
- **Live Expiration Countdowns**: Active tags display a real-time visual countdown of the remaining minutes before expiration (e.g. "Expires in 42m"), updating every 15 seconds.
- _Detailed Guide: [Aesthetics & Visual System](docs/AESTHETICS.md)_

### Post Editing & DM Management

- **Post Editing**: Allows authors to update their active post headlines via `/post/edit/:id` routing, accessible directly from their profile page.
- **Master-Detail DM Inbox**: Live, unified direct message console under `/messages` routing featuring grouped chat threads, other-user name fetching in bulk, and real-time messaging replies.
- **Forgot & Reset Password**: Secure self-service account recovery flows via `/login/forgot-password` and `/login/update-password` paths.
- **Server-Side Optimized Queries**: Optimized repository querying via a `.getFiltered()` database mechanism, migrating away from slow front-end array filtering.
- **LRU Capped Cache Limiters**: Restricts front-end Nominatim geocoding and reverse-lookup Map caches to a 50-entry maximum to prevent unbounded memory growth.
- **Native Dialog Deprecations**: Migrates browser `confirm()` popups to the asynchronous app-wide `ConfirmDialogService` modal drawer.
- **Post Detail Live Updates Refactor**: Resolved RxJS subscription leak in `PostDetailPage` by relocating `liveTagUpdates()` subscription to `ngOnInit()`, eliminating duplicate subscriptions on thread toggle clicks.
- **Configurable Bounding Box**: Relocates hardcoded country bounding coordinates to an extensible `COUNTRY_BOUNDS` record structure in `hood.ts`.
- **Media Upload Restrictions & Native GPU Video Compression**: Enforces client-side WebP image compression and native GPU-accelerated video compression via `MediaRecorder` API (2.0 Mbps bitrate ceiling) alongside validation rules (max 15MB images, max 30MB & max 30s duration videos) backed by a 50MB Supabase storage policy migration (`20260802000000_storage_bucket_limits.sql`).
- **Audit & Bug Remediations**: Added client-side email format validation on login, password reset URL error fragment detection, WCAG field labels on signup, event date range validation (`eventStart <= eventEnd`), responsive category chips layout (`flex-wrap`), and icon element rendering in `EmptyStateComponent`.
- **Bug Report #2 Comprehensive Remediations**:
  - **Account Uniqueness (Bugs #1, #2)**: Enforced pre-signup validation for email and username uniqueness to prevent duplicate registrations.
  - **Sign Up Navigation (Bug #3)**: Added `resetSignupForm()` to clear residual error popups when clicking "Sign up again".
  - **Flexible Login (Bug #4)**: Enabled login via either username or email address with automatic username-to-email resolution.
  - **Email Preferences (Bug #5)**: Implemented clean `OptOutComponent` under `/login/opt-out` route to process email opt-out and spam reporting without errors.
  - **Comment & Reaction Resilience (Bugs #6, #7, #8, #9, #10, #14)**: Updated comment liking, nested reply reactions, comment editing, comment deletion, and location following to preserve resilient optimistic signal state without throwing disruptive toast errors.
  - **Media Upload Extension Support (Bug #11)**: Expanded video MIME/extension validation to support desktop/mobile video formats (`.mp4`, `.mov`, `.webm`, `.m4v`, `.mkv`, `.avi`).
  - **Poll Option Validation (Bug #12)**: Added client validation requiring at least 2 non-empty poll options before previewing or publishing a poll post.
  - **Idempotent Like Counting (Bug #13)**: Fixed double-incrementing like counts when opening post details or scrolling comments by reconciling optimistic like deltas against hydrated base counts.
- **Bug Report #3 Comprehensive Remediations**:
  - **Dynamic Birthday Days & Strict Calendar Validation (Bug #5)**: Converted `days` into a `computed` signal dynamically adjusting between 28, 29 (leap years via `(year % 4 === 0 && year % 100 !== 0) || year % 400 === 0`), 30, and 31 days based on `birthMonth()` and `birthYear()`, with an effect resetting out-of-range days, and strictly validating calendar date accuracy in `isOldEnough()` to reject non-existent calendar dates (e.g. 31 Feb) with "Please enter a valid calendar date."
  - **Date of Birth State Persistence (Bug #7)**: Added `[selected]` option bindings to birthday and business established year dropdowns in Step 5 (`birthMonth`, `birthDay`, `birthYear`) so selections are preserved without resetting to default values when navigating back and forth across wizard steps.
  - **Email Confirmation Subtip & Friendly Rate Limit Errors (Bug #6, Bugs #1 & #2)**: Added an informational tip in the confirmation email step advising users they can click the email confirmation link if no 6-digit code is provided (`.confirm-email-subtip`). Handled Supabase auth email rate limits in `signup()` and `resendConfirmationEmail()` with friendly, actionable messaging ("Too many email requests sent recently. Please wait a few minutes before trying again or check your inbox/spam folder.").
  - **Profile @handle vs Display Name Disambiguation (Bug #4, Bug #7)**: Disambiguated `@handle` (unique username) and display name across profile headers, edit sheets, and post author cards:
    - Profile header displays the user's Display Name as the main heading (`currentUser()?.name || user.username || 'My Profile'`) and displays the unique handle underneath (`@{{ currentUser()?.username || user.username }}`).
    - Profile edit card features an editable Display Name input with helper hint (`Your public display name shown on your posts and comments.`) alongside a read-only Username handle box with fixed badge (`Unique handle (cannot be changed)`).
    - Exposed `username?: string` on `AppUser` and preserved handle integrity across display name mutations and session restorations.
  - **Post Media Size & Format Guidance (Bug #8)**: Added explicit media size hint (`Photos up to 15 MB • Videos up to 30 MB (max 30s)`) in post composer media picker to avoid silent rejections or unexpected file failures.
  - **Post Composition & Form Usability (Bug #9)**: Streamlined post creation validation feedback and input responsiveness across compose steps.
  - **Desktop Feed Scrollbar Restoration (Bug #10)**: Restored subtle, themed vertical scrollbar (`thin`, 6px rounded thumb matching `--tm-text` opacity) on `.fb-scroller` for desktop viewports (`>= 761px`) while preserving the borderless, immersive Reels view on mobile (`< 761px`).
- **Bug Report #4 Comprehensive Remediations (TM-001 to TM-014)**:
  - **Thread Reply Visibility (TM-001)**: Fixed offset calculation in `post-detail.html` where `.slice(expandedThreads().has(comment.id) ? 0 : 3)` improperly hid replies on comments with $\le 3$ replies. Updated to `.slice(0, expandedThreads().has(comment.id) ? undefined : 3)` so replies are immediately visible up to 3 when collapsed and fully expanded on toggle.
  - **Comment Deletion Confirmation Copy (TM-002)**: Updated `deleteComment()` in `post-detail.ts` to dynamically distinguish whether a comment has nested replies. If replies exist, shows "Replies will remain visible as a preserved thread."; otherwise displays standard message "Are you sure you want to delete this comment? This action cannot be undone."
  - **Comment Soft Deletion Database Resilience (TM-003)**: Updated `updateRow()` in `tag-data.service.ts` to use `.maybeSingle()` instead of `.single()`, preventing PostgREST `PGRST116` error ("0 rows returned") when database RLS policies filter out soft-deleted records (`is_deleted = true`). Handled `PGRST116` gracefully in `social-interactions.service.ts`.
  - **Post Detail Neighbor Navigation (TM-004)**: Added reactive route parameter subscription in `post-detail.ts` using `route.paramMap.pipe(takeUntilDestroyed(this.destroyRef))` with extracted `loadPost(id)` and scroll-to-top, fixing Angular router component reuse when clicking cards in "More from this neighbor".
  - **Upload Limit & File Type Validation Visibility (TM-005, TM-010)**: Enforced media upload limits (15 MB photo, 30 MB / 30s video) and supported format restrictions. Resolved toast notification truncation in `app.scss` by removing `nowrap` and `text-overflow: ellipsis`, enabling responsive multi-line wrapping with theme background and border contrast.
  - **Name Confirm Button Contrast & States (TM-006)**: Polished `.name-confirm-btn` in `signup.scss` with high-contrast text (`#ffffff`), theme-aware hover states, and clear disabled opacity (`0.45`) with muted borders across light and dark themes.
  - **Custom Business Category Support ("Other") (TM-007)**: Added an "Other" option to the Step 3 business category grid in `signup.html` with an interactive custom text input, validated min-length, and persisted custom category strings in user metadata.
  - **External Registration Triage (TM-008)**: Audited and closed invalid bug report where tester was verifying OpenStreetMap's external signup form (`openstreetmap.org/user/new`) rather than Tagmate.
  - **Dark Mode Calendar Picker Contrast (TM-009)**: Configured `color-scheme: dark` for `.dark`, `.midnight`, and `.forest` themes in `styles.scss` and applied `filter: invert(0.85)` to `::-webkit-calendar-picker-indicator` across all native date/time pickers.
  - **Hot Now Filter Exits & Navigation (TM-011)**: Implemented toggle-off logic on the Hot Now chip in `app-topbar.ts` when already active, added `onHomeClick()` to clear the filter on logo/home click, and added "Show all posts" action buttons to both the Hot Now empty state and active feed banners in `feed-beta.html`.
  - **Offer Post "Message" CTA Routing (TM-012)**: Updated `business-post-content.component.ts` and `.html` to route `message` CTAs to `['/messages']` with `queryParams: { user: post.userId, name: post.businessName || post.username }`, directly initiating direct message conversations with the business.
  - **Preserved Custom Post Background with Attachments (TM-013)**: Extended custom `backgroundColor` and `contrastText` bindings to `.fb-caption` in `feed-beta.html` and styled `.fb-caption--custom-bg` in `feed-beta.scss` so selected background colors display accurately when photos/media are attached.
  - **Authentication Layout Verification (TM-014)**: Verified resolution of Forgot Password UI layout in commit `cb2b465` (`.signup-split` design), ensuring uniform centered card structure matching Login and Signup screens.

### Production Optimizations & Telemetry

- **Service Worker Caching**: Configures dynamic cache rules using `dataGroups` for Supabase API requests, utilizing a freshness strategy with cache fallbacks to support offline scenarios.
- **Dynamic Telemetry Integration**: Implements lightweight error capturing inside `GlobalErrorHandler` that safely forwards uncaught exceptions to Sentry and LogRocket if loaded globally, bypassing local bundle bloat.
- **HTTP Security Headers**: Configures and returns standard security headers (`CSP`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy`) on all static and proxy responses inside the request handler.
- **Geocoding API Rate Limiting**: Implements IP-based token-bucket rate limiting (15 requests/min) on `/api/nominatim/*` proxy routes.
- **Password Validation Hardening**: Enforces minimum length (8 characters), uppercase, lowercase, and numeric complexity constraints on account sign-up and update password forms.
- **Authorization & Data-Layer Hardening**: Session-aware route guards wait for persisted auth restoration, admin routes require trusted Supabase `app_metadata`, database errors propagate to callers, and non-idempotent post writes are no longer automatically retried.
- **Deployment Security Contract**: Adds a Supabase migration for case-insensitive username uniqueness and trusted-admin deletion, plus an operational checklist in `docs/SECURITY_DEPLOYMENT.md` for RLS, storage, Cloudflare rate limiting, and browser-key restrictions.

---

## 2. Proposed Future Updates

### Quality, Security & Delivery Baseline (0.1.0)

- **Automated Verification**: `npm run verify` checks Prettier formatting, ESLint, coverage-enabled unit tests, and the production build; GitHub Actions runs the same checks plus Chromium smoke tests for pull requests and `main`.
- **Coverage Ratchet**: The baseline is enforced at 27% statements, 30% lines, 15% functions, and 10% branches. Each feature/refactor must raise or preserve these levels until the 70/70/70/60 target is achieved.
- **Safe Map Cards**: Featured map markers build popup DOM with `textContent` and validate image URLs rather than interpolating user data through `innerHTML`.
- **Resilient Preferences**: Device preferences use SSR-safe, namespaced storage helpers that tolerate unavailable, malformed, expired, or quota-limited browser storage.
- **Safe Storage Lifecycle**: Legacy browser keys migrate to `tagmate:device:*` or `tagmate:user:<uid>:*`; signing out clears only the current user's cached values.
- **Configuration Guardrails**: Startup validates the required MapTiler and Supabase settings, and `environment.example.ts` documents the no-secret configuration shape.
- **Map Reliability Signals**: The Hood Island route cancels superseded place searches, respects reduced-motion preferences for featured-marker rotation, loads its inspector only in development, and records map-ready, first-marker, and boundary-ready timings.
- **Shared Marker Boundary**: `MarkerService` owns marker GeoJSON construction and MapLibre source updates, keeping map pages focused on feature behavior.
- **Activation Telemetry**: Selecting a neighborhood on the map records a privacy-safe hood-selection event without location coordinates.
- **Accessibility Smoke Coverage**: The login controls have explicit accessible names, its password visibility control is keyboard reachable, errors announce themselves, and Playwright checks that path.
- **Dialog Focus Restoration**: App-wide confirmations return focus to their invoking control after completion, making destructive actions usable by keyboard-only users.
- **Typed Message Queries**: Direct-message reads now return `DirectMessageRow` values rather than untyped query results at the service boundary.
- **Typed Social Aliases**: Shared `UserRow`, `CommentRow`, `DirectMessageRow`, `NotificationRow`, and `TagRow` aliases now describe the common social/query boundaries.
- **Privacy-Safe Activation Events**: Posting, liking, and commenting emit only event categories—never content, identity, or exact location.
- **Map Chunk Guardrail**: Production and staging builds enforce a 1.60 MB hard limit for every lazy script, preventing unnoticed map-route chunk growth.
- **Reliable E2E Preview**: Playwright serves the built browser files through a dependency-free Node static server rather than Wrangler, with Angular route fallback and a 30-second startup limit. Pull-request verification runs the backend-free accessibility smoke test; seeded multi-user Supabase suites remain explicit integration tests.
- **First-Run Hood Guidance**: New devices receive a concise, keyboard-accessible prompt to choose a hood before discovering nearby content.

* [x] **Neighborhood Group Chatrooms**: Real-time websocket-backed room chats for broad neighborhood discussion without requiring a specific post.
* [x] **Virtual Sticky Bulletin Board**: A fast announcement wall for short, non-geolocated notes (e.g. "Found keys at the park").
* [x] **Post Editing & Unified DM Inbox Console**: Integrated post modification routes and message hubs for easier interaction.
* [x] **Account Password Recovery**: Password reset and secure recovery options.
* [x] **Workspace Three-Zone Shell Redesign**: Connected WorkspaceStateService reactive signals for Feed & Map layouts.
* [x] **Specialized Supabase Architecture**: Decoupled monolithic backend service into focused AuthService, TagDataService, StorageService, RealtimeService, and SocialDataService.
* [x] **Rate Limiter TTL Eviction**: Hardened server rate limit maps with active-access sliding evictions.
* [ ] **External LLM Service Integration**: Upgrade the local rules-based Chatmate AI to use remote APIs (like Gemini or Llama) for fully open-ended local inquiries.
* [ ] **Advanced Geofencing Notifications**: Push alert notifications when a user enters a geographic bounding box containing active high-severity traffic alerts or emergencies.

---

## 3. Verification & Testing Guide

Every pull request or modification must pass both automated and manual verification check routines.

### Automated Verification

Run the unit test suite headless from the root workspace:

```bash
npm test -- --watch=false --browsers=ChromeHeadless
```

Ensure all tests compile and pass successfully. The unit suite uses a stateful in-memory repository (`InMemoryTagRepository`) in `testProviders` to guarantee 100% hermetic, isolated test runs without database dependencies.

Run the end-to-end (E2E) browser test suite using Playwright:

```bash
npm run test:e2e
```

The E2E suite uses Playwright network route mocking (`e2e/helpers/network-mocks.ts`) to intercept Nominatim geocoding, MapTiler vector tiles, and Supabase REST endpoints for network-free, hermetic execution.

### Manual UI Verification Checklist

Before deploying changes:

1. **Theme Switching**: Click the theme switcher button and verify styles render correctly in all modes, particularly dark/midnight.
2. **AI Chatmate Responses**: Open the Neighborhood Page, switch to the "Chatmate AI" tab, click the _"Summarize"_ chip, and confirm the AI lists correct active tag counts.
3. **Map Highlight Links**: Ask the AI to find an event or sale, click the resulting attachment's "Pin" button, and ensure the map flies to the correct coordinates.
4. **Quest Progress & Reputation**: Complete a quest (e.g. vote in a poll) and confirm:
   - The quest card updates to "Done" state.
   - The Weekly Quest progress bar increases.
   - The user's reputation score increases by 5.
   - The Rank badge adjusts if the new reputation score crosses a badge threshold.
5. **Post & Note Deletion**: Attempt to delete a post or sticky note. Verify that:
   - The delete option is only visible on posts/notes authored by the logged-in user.
   - Execution of the deletion flow is blocked if ownership checks are not satisfied.
6. **Neighborhood Group Chatroom**: Click the "Chatroom" tab on the Neighborhood page. Verify that:
   - Recent messages load from the database.
   - Typing a message and clicking Send adds it instantly (optimistically) and propagates it to Supabase.
   - Real-time updates automatically append incoming messages from other users and scroll the viewport to the bottom.
7. **Workspace Three-Zone Shell (Feed/Map selection)**:
   - Click a post on the Feed, verify that the right-hand details context panel expands dynamically on desktop.
   - Click a marker pin on the Map, verify that the inspector sidebar shows the clicked post's specific details and a "Details" routerLink button.
8. **NotFound (404) Redirects**:
   - Navigate to `/some-invalid-path` and confirm the glassmorphic "Lost in the Neighborhood? (404)" page is displayed.
   - Confirm clicking the CTA button routes back to `/feed` if logged in, or `/login` if logged out.
9. **Authorization hardening**:
   - Refresh a protected route with a valid persisted session and confirm it does not flash or redirect to `/login`.
   - Confirm a normal account and an account with only `user_metadata.role = "admin"` are redirected away from `/admin`.
   - Confirm an account with trusted `app_metadata.role = "admin"` can enter `/admin` and moderate a post under the deployed RLS policy.
10. **Post Media Size Guidance (Bug #8)**:
    - Open `/post` composer and verify that the helper text "Photos up to 15 MB • Videos up to 30 MB (max 30s)" renders clearly beneath the media grid with proper theme-adapted muted contrast.
11. **Desktop Feed Scrollbar (Bug #10)**:
    - On desktop viewports (>= 761px), verify a subtle themed vertical scrollbar is visible and draggable on `.fb-scroller` in Feed Beta.
    - On mobile viewports (< 761px), verify the scrollbar remains completely hidden (`scrollbar-width: none`) for an uninterrupted Reels experience.
12. **Profile Display Name vs Username Disambiguation (Bug #4)**:
    - Navigate to `/profile` as an authenticated user.
    - Confirm the main profile heading displays the user's Display Name and the unique `@username` handle is clearly shown beneath it.
    - Click "Edit profile" and confirm the Display Name input has helper hint "Your public display name shown on your posts and comments."
    - Confirm the Username is shown as a read-only field with the "Unique handle (cannot be changed)" badge matching all theme palettes.
    - Edit the Display Name and save; confirm the profile header updates the display name while the `@username` handle remains constant.
13. **Login & Signup Password Visibility Toggle Keyboard Accessibility**:
    - Navigate to `/login` or `/login/signup`.
    - Focus the Password field and press `Tab`.
    - Confirm keyboard focus smoothly advances to the password visibility toggle button (`Show password`).
    - Press `Space` or `Enter` to toggle visibility; confirm the button's accessible name switches between `Show password` and `Hide password` with updated `aria-pressed` state and the input type toggles between `password` and `text`.
    - Confirm the button receives high-contrast `:focus-visible` styling matching the active theme palette.
14. **Thread Reply Expansion (TM-001)**:
    - View a post with 1, 2, or 3 replies. Verify that replies are immediately visible.
    - View a post with > 3 replies. Confirm the first 3 are visible, and clicking "View all N replies" smoothly reveals the remainder.
15. **Comment Deletion Confirmation Copy (TM-002)**:
    - On a comment with no replies, trigger deletion and confirm the dialog warns "Are you sure you want to delete this comment? This action cannot be undone."
    - On a comment that has replies, trigger deletion and confirm the dialog explicitly notes "Replies will remain visible as a preserved thread."
16. **Post Detail Neighbor Links (TM-004)**:
    - In Post Details, click another post under "More from this neighbor".
    - Confirm the route transitions to the new post ID, the page scrolls to top, and the new post's content and comments load without reload failure.
17. **Date/Time Picker Contrast (TM-009)**:
    - Switch to Dark, Midnight, or Forest theme and navigate to `/post` (Event enabled).
    - Confirm the native calendar and clock picker indicators are crisp, inverted white/light icons with full visibility against the dark input background.
18. **Multi-line Toast Notifications (TM-010)**:
    - Attempt an invalid action (e.g. upload an unsupported file).
    - Confirm the toast alert wraps to multiple lines without truncation or ellipsis, preserving complete readability across all themes.
19. **Hot Now Feed Exits (TM-011)**:
    - Click the Hot Now fire chip to enter the Hot Now feed.
    - Click the active chip again, or click the Brand/Home icon, or click "Show all posts" in the feed banner or empty state.
    - Confirm the feed filter resets cleanly and all neighborhood posts reappear.
20. **Offer Post Message CTA (TM-012)**:
    - On an offer or business post in the feed with CTA "Message", click "Message".
    - Confirm the application opens `/messages` with query parameters pointing to the business owner, opening or staging a direct conversation thread.
