# Tagmate Features and Verification Guide

This document tracks all implemented core features of Tagmate, outlines proposed future updates, and defines the verification workflows required when making changes to the application.

> [!IMPORTANT]
> **Developer Agent Instruction**: Whenever a new feature is added, modified, or verification routines change, developer agents **must** update this file to ensure the features log, roadmap, and test procedures remain perfectly accurate.

---

## 1. Current Core Features

### Location-Based Posting & Map (Hood)
* **Interactive Mapping**: Renders high-performance map styles (Streets, Satellite, Hybrid, Outdoor) powered by MapLibre GL JS and MapTiler.
* **Geographic Clustering**: Implements WebGL clustering for neighborhood posts with dynamic zoom expansion on click.
* **Boundary Rendering**: Dynamic fetching and visual polygon boundary outline of neighborhoods using OpenStreetMap Nominatim API place boundaries.
* **Draggable Location Picker**: A temporary pick marker with geocoding feedback for attaching precise coordinates to new posts.
* **Heatmap Mode**: Visualization of high-density post areas with adjustable circle paint weights.
* **Geospatial Query Caching**: Front-end geocoding, reverse-geocoding, and boundary polygons are persisted in `localStorage` to reduce OpenStreetMap API network requests and prevent rate-limiting.
* *Detailed Guide: [Mapping & Geospatial](file:///d:/Coding/Web/tagmate/docs/MAPPING_AND_GEOSPATIAL.md)*

### Neighborhood AI Concierge ("Chatmate AI")
* **Dynamic Assistant Panel**: A slide-over glassmorphic chatbot panel in the Neighborhood view.
* **Dynamic Context Parsing**: Analyzes active neighborhood posts in real-time to answer neighbor queries about traffic alerts, sales, event schedules, and local recommendations.
* **Smarter Synonym Phrase Mapping**: Uses conversational synonym dictionaries (e.g. road closures, dining, bargains) to route natural queries to appropriate category lookups.
* **Quick Action Prompts**: Preset query buttons to summarize activity, check traffic status, or find local bargains in one tap.
* **Interactive Map Highlights**: Provides recommended tag attachments in the chat flow with direct "Pin on Map" and "Details" action links.
* **Polished UX**: Smooth typing status animations and distinct user/AI message alignment.
* *Detailed Guide: [AI Concierge](file:///d:/Coding/Web/tagmate/docs/AI_CONCIERGE.md)*

### Hood Champion & Gamification
* **Reputation & Ranks**: Tracks user contribution points ("Reputation") and assigns status badges (`New`, `Rising`, `Helpful`, `Trusted`).
* **Weekly Civic Quests**: Interactive checklists that reward contribution with reputation (Civic Love, Chatty Neighbor, Active Citizen, Vocal Resident). Authenticated users have their quest progress synced to Supabase Auth metadata across devices, while guest users fallback to browser `localStorage`.
* **Top Contributors Leaderboard**: Dynamic ranking of top neighbors in each neighborhood based on their post counts and trust metrics.
* *Detailed Guide: [Gamification & Reputation](file:///d:/Coding/Web/tagmate/docs/GAMIFICATION.md)*

### Social Interaction Suite
* **Direct Messaging**: Private message threads initiated from individual tags, allowing direct peer-to-peer neighborhood coordinate discussions.
* **Neighborhood Group Chatrooms**: Real-time websocket-backed room chats for broad neighborhood discussion without requiring a specific post, synced via Supabase Realtime.
* **Threaded Comments**: Interactive comment sections supporting parent-reply trees, comment liking, and user mentions.
* **Event RSVPs**: Attending/declining status tracking for posts of kind `event`.
* **Question Polls**: Custom question creation with up to 5 poll options, live percentage updates, and singular vote lock-in.
* **Rich Notifications**: Local message center notifying users of replies, new alerts, RSVPs, likes, and direct messages.
* *Detailed Guide: [Social Suite](file:///d:/Coding/Web/tagmate/docs/SOCIAL_SUITE.md)*

### Virtual Sticky Bulletin Board
* **Non-Geolocated Announcements**: A dedicated space for quick neighborhood announcements, requests, and posts (e.g. "Found keys at the park") without attaching map coordinates.
* **Responsive Notes Grid**: Renders short text announcements in a grid layout resembling physical colored sticky notes.
* **Dynamic Content Composer**: Note editing field capped at 160 characters with remaining character counter.
* **Access Control Deletion**: Deletion permissions enforced to restrict note removal only to the post's author.
* *Detailed Guide: [Social Suite (includes Bulletin Board)](file:///d:/Coding/Web/tagmate/docs/SOCIAL_SUITE.md)*

### Aesthetics & Customizations
* **Curated Theme Modes**: Instant switching across custom color schemes: `Light`, `Dark`, `Midnight` (OLED black), `Forest`, and `Sepia`.
* **Dynamic Gradients**: Color-gradient headers mapping to different post category tags (Alert, Event, Sale, Food, Traffic, Market, Question).
* **Live Expiration Countdowns**: Active tags display a real-time visual countdown of the remaining minutes before expiration (e.g. "Expires in 42m"), updating every 15 seconds.
* *Detailed Guide: [Aesthetics & Visual System](file:///d:/Coding/Web/tagmate/docs/AESTHETICS.md)*

### Post Editing & DM Management
* **Post Editing**: Allows authors to update their active post headlines via `/post/edit/:id` routing, accessible directly from their profile page.
* **Master-Detail DM Inbox**: Live, unified direct message console under `/messages` routing featuring grouped chat threads, other-user name fetching in bulk, and real-time messaging replies.
* **Forgot & Reset Password**: Secure self-service account recovery flows via `/login/forgot-password` and `/login/update-password` paths.
* **Server-Side Optimized Queries**: Optimized repository querying via a `.getFiltered()` database mechanism, migrating away from slow front-end array filtering.
* **LRU Capped Cache Limiters**: Restricts front-end Nominatim geocoding and reverse-lookup Map caches to a 50-entry maximum to prevent unbounded memory growth.
* **Native Dialog Deprecations**: Migrates browser `confirm()` popups to the asynchronous app-wide `ConfirmDialogService` modal drawer.
* **Configurable Bounding Box**: Relocates hardcoded country bounding coordinates to an extensible `COUNTRY_BOUNDS` record structure in `hood.ts`.
### Production Optimizations & Telemetry
* **Service Worker Caching**: Configures dynamic cache rules using `dataGroups` for Supabase API requests, utilizing a freshness strategy with cache fallbacks to support offline scenarios.
* **Dynamic Telemetry Integration**: Implements lightweight error capturing inside `GlobalErrorHandler` that safely forwards uncaught exceptions to Sentry and LogRocket if loaded globally, bypassing local bundle bloat.
* **HTTP Security Headers**: Configures and returns standard security headers (`CSP`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy`) on all static and proxy responses inside the request handler.
* **Geocoding API Rate Limiting**: Implements IP-based token-bucket rate limiting (15 requests/min) on `/api/nominatim/*` proxy routes.
* **Password Validation Hardening**: Enforces minimum length (8 characters), uppercase, lowercase, and numeric complexity constraints on account sign-up and update password forms.

---

## 2. Proposed Future Updates

- [x] **Neighborhood Group Chatrooms**: Real-time websocket-backed room chats for broad neighborhood discussion without requiring a specific post.
- [x] **Virtual Sticky Bulletin Board**: A fast announcement wall for short, non-geolocated notes (e.g. "Found keys at the park").
- [x] **Post Editing & Unified DM Inbox Console**: Integrated post modification routes and message hubs for easier interaction.
- [x] **Account Password Recovery**: Password reset and secure recovery options.
- [x] **Workspace Three-Zone Shell Redesign**: Connected WorkspaceStateService reactive signals for Feed & Map layouts.
- [x] **Specialized Supabase Architecture**: Decoupled monolithic backend service into focused AuthService, TagDataService, StorageService, RealtimeService, and SocialDataService.
- [x] **Rate Limiter TTL Eviction**: Hardened server rate limit maps with active-access sliding evictions.
- [ ] **External LLM Service Integration**: Upgrade the local rules-based Chatmate AI to use remote APIs (like Gemini or Llama) for fully open-ended local inquiries.
- [ ] **Advanced Geofencing Notifications**: Push alert notifications when a user enters a geographic bounding box containing active high-severity traffic alerts or emergencies.

---

## 3. Verification & Testing Guide

Every pull request or modification must pass both automated and manual verification check routines.

### Automated Verification
Run the unit test suite headless from the root workspace:
```bash
npm test -- --watch=false --browsers=ChromeHeadless
```
Ensure all tests compile and pass successfully. The suite now includes 54 tests covering nav, app-topbar, map-hood, post-detail, and inbox components.

### Manual UI Verification Checklist
Before deploying changes:
1. **Theme Switching**: Click the theme switcher button and verify styles render correctly in all modes, particularly dark/midnight.
2. **AI Chatmate Responses**: Open the Neighborhood Page, switch to the "Chatmate AI" tab, click the *"Summarize"* chip, and confirm the AI lists correct active tag counts.
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

