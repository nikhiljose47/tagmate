# Tagmate — Current State Report
_Last updated: 2026-08-15. Read-only audit. No files were changed._
_Purpose: reference for AI agents designing or implementing new features._

---

## 1. Tech / Architecture

| Layer | Detail |
|---|---|
| Framework | Angular 21.2.17, standalone components, OnPush everywhere |
| Reactivity | Angular Signals (primary) + RxJS (repositories, session stream) |
| State | NgRx 21.1.1 — **only** UserPreference slice (theme, language, mapZoom, hood) |
| Styling | Tailwind CSS 4 + Bootstrap Icons |
| Maps | MapTiler SDK 3.4.3 / maplibre-gl 5.24.0 |
| Backend | Supabase (hosted Postgres + Auth + Realtime + Storage + RLS + pg_cron) |
| Supabase client | @supabase/supabase-js 2.110.0 |
| Deploy | Cloudflare Pages via Wrangler 4.22.0 |
| Tests | Playwright E2E |

### Relevant folder structure

```
src/app/
├── core/
│   ├── enums/          tag-category.enum.ts
│   ├── models/         app-user.model.ts, tag.model.ts, database.types.ts, social.model.ts
│   ├── repositories/   interfaces/tag.repository.ts
│   │                   implementations/supabase-tag.repository.ts
│   └── services/       supabase.service.ts, tag-data.service.ts, user-session.service.ts,
│                       social-interactions.service.ts, social-platform.service.ts,
│                       shared-state.service.ts, tag.mapper.ts, media.service.ts,
│                       media-compression.service.ts, realtime.service.ts
├── features/
│   ├── auth/pages/     login/, signup/
│   ├── post/
│   │   ├── pages/post/         post.ts, post.html  ← main 3-step composer
│   │   ├── pages/post-edit/    headline-only edit
│   │   ├── pages/post-detail/  detail view
│   │   └── data/               post-templates.ts   ← template system v1
│   ├── profile/pages/profile/  profile.ts, profile.html
│   ├── feed-beta/pages/feed-beta/  feed-beta.ts    ← primary feed
│   └── feed/                   legacy feed (still routed at /feed)
├── shared/
│   ├── constants/      business-tags.ts            ← category source of truth
│   ├── components/     avatar, tag-pill, lifespan-badge, confirm-dialog,
│   │                   notification-drawer, post-menu, empty-state
│   ├── pipes/          tag-emoji.pipe.ts, tag-gradient.pipe.ts, time-ago.pipe.ts
│   └── directives/     click-outside.directive.ts
└── store/user-preferences/  NgRx slice
```

---

## 2. Routes

```
/login            → AUTH_ROUTES (lazy)
/feed             → FeedPage (legacy, authGuard)
/feed-beta        → FeedBetaPage (authGuard) — PRIMARY feed
/post             → PostPage 3-step composer (authGuard)
/post/edit/:id    → PostEditComponent (headline only)
/posts/:id        → PostDetailPage
/profile          → ProfilePage
/users/:uid       → PublicProfilePage
/hood             → HoodPage (map + location pick)
/messages         → DmInboxPage
/reports, /analytics, /admin, /neighborhood/:id → respective feature modules
''                → rootRedirectGuard → /feed-beta (auth) or /login
```

---

## 3. User + Business Model

### One user = one optional business identity (no separate business table)

```typescript
// src/app/core/models/app-user.model.ts
interface AppUser {
  uid: string;
  name: string;           // username (unique, lowercase)
  isGuest: boolean;
  email?: string;
  bio?: string;
  accountType: 'personal' | 'business';
  businessName?: string;
  businessPhone?: string;
  businessWebsite?: string;
  businessCategory?: string;  // TagCategory string value, e.g. 'food'
  reputation?: number;
  hood?: Hood;
}
```

### DB: users table (relevant columns)

| Column | Type | Notes |
|---|---|---|
| uid | text PK | Supabase Auth UID |
| account_type | text CHECK('personal','business') | DEFAULT 'personal' |
| business_name | text | nullable |
| business_phone | text | nullable |
| business_website | text | nullable |
| business_category | text | nullable; TagCategory string; **no FK/CHECK** |
| home_state, home_district, home_place | text | user's neighbourhood |
| home_lat, home_lng | float8 | nullable |
| reputation | integer | trigger-maintained |

### Business category selection

- **Signup** (Step 2 of 3, business accounts only): chip grid of `BUSINESS_TAG_CATEGORIES`.
  Validation: both `businessName` and `businessCategory` required.
  Stored via `session.signup()` → Supabase Auth metadata → `handle_new_auth_user()` trigger → `users.business_category`.

- **Profile edit**: `SocialPlatformService.updateOwnProfile()` → direct UPDATE on `users` row.

- **Effect on posts**: business accounts with `businessCategory` set **skip the tag-selection step**
  in the composer. Their category is auto-applied as `tags.tag`. Enforced in `post.ts`.

---

## 4. Business Categories — Source of Truth

**Definition file:** `src/app/shared/constants/business-tags.ts`
**Enum file:** `src/app/core/enums/tag-category.enum.ts`

### BUSINESS_TAG_CATEGORIES (12 — selectable at signup/profile)

| Enum key | String id | Display label | Emoji |
|---|---|---|---|
| TagCategory.Shop | `shop` | Shop & retail | 🛍️ |
| TagCategory.Food | `food` | Food & dining | 🍜 |
| TagCategory.Service | `service` | Services & repair | 🛠️ |
| TagCategory.Beauty | `beauty` | Beauty & wellness | 💇 |
| TagCategory.Health | `health` | Health & care | 🏥 |
| TagCategory.Fitness | `fitness` | Fitness & sports | 💪 |
| TagCategory.Learn | `learn` | Education & classes | 📚 |
| TagCategory.Auto | `auto` | Automotive | 🚗 |
| TagCategory.Space | `space` | Property & spaces | 🏠 |
| TagCategory.Travel | `travel` | Travel & hospitality | ✈️ |
| TagCategory.Event | `event` | Events & entertainment | 🎉 |
| TagCategory.Biz | `biz` | Professional & business services | 🏢 |

### PERSONAL_TAG_CATEGORIES (7 — personal post picker only)

| Enum key | String id | Display label |
|---|---|---|
| TagCategory.Around | `around` | Local update |
| TagCategory.Dating | `dating` | Meet people |
| TagCategory.Game | `game` | Games & sports |
| TagCategory.Help | `help` | Ask for help |
| TagCategory.Notice | `notice` | Notice |
| TagCategory.Alert | `alert` | Alert |
| TagCategory.Poll | `poll` | Poll |

### Special / system tags

| String id | Notes |
|---|---|
| `hot-now` | Toggle-only in composer (top-right). Mutually exclusive with other tags. Never a registered category. |
| `job` | **Legacy.** Kept only for feed display. Not in any picker. Marked deprecated in enum comment. |

### Hard-coded category checks (locations that need updating when categories change)

- `src/app/features/feed-beta/pages/feed-beta/feed-beta.ts` — `mainCategoryFor(post)` switch
- `src/app/core/models/social.model.ts` — `ACTIONABLE_TAGS = new Set(['alert','help','event','shop','biz','health','poll'])`
- `src/app/features/post/pages/post/post.ts` — `if (user.businessCategory) skip tag step`
- `src/app/features/post/data/post-templates.ts` — `POST_TEMPLATES: Partial<Record<TagCategory, PostTemplate>>`

---

## 5. Post Database Model

**Table:** `public.tags` — all posts regardless of type in one table.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid PK | — | auto |
| user_id | uuid FK → users.uid | — | author |
| username | text | — | denormalised at post time |
| highlight | text | — | body / caption (no separate title field) |
| tag | text | — | TagCategory string |
| category | text | yes | legacy, ignored |
| post_type | text CHECK('personal','business') | DEFAULT 'personal' | |
| business_name | text | yes | denormalised from user at post time |
| business_phone | text | yes | |
| business_website | text | yes | |
| intent | text CHECK('offer','available_now','open_slot','happening','looking_for','sell_give') | yes | |
| price | numeric | yes | |
| original_price | numeric | yes | for discount display |
| availability_note | text | yes | |
| cta | text CHECK('message','call','whatsapp','directions','visit_shop','view_product','book','join','interested') | yes | |
| product_link | text | yes | |
| images | text[] | yes | public Storage URLs |
| poll_options | text[] | yes | 2–5 values |
| poll_votes | jsonb | DEFAULT '{}' | |
| event_start | text | yes | ⚠️ **never persisted — mapper bug** |
| event_end | text | yes | ⚠️ **never persisted — mapper bug** |
| lat | float8 | — | |
| lng | float8 | — | |
| state | text | yes | Admin-1 region |
| country | text | yes | |
| location_type | text CHECK('pinpoint','place') | DEFAULT 'pinpoint' | |
| location | text | yes | legacy |
| hood_id | text | yes | |
| expires_in | integer | — | minutes from created_at |
| current_status | text CHECK('active','resolved','cancelled','closed') | DEFAULT 'active' | trigger-maintained |
| status_updated_at | timestamptz | yes | trigger-maintained |
| verification_count | integer | yes | trigger-maintained |
| like_count | integer | — | trigger-maintained |
| comment_count | integer | — | trigger-maintained |
| rsvp_count | integer | — | trigger-maintained |
| created_at | timestamptz | — | no updated_at on tags |

**Expiry:** pg_cron runs every 15 min, sets `current_status='closed'` when `created_at + make_interval(mins=>expires_in) < now()`.

**No draft column. No published_at. All inserts are immediately live.**

### Planned concept coverage

| Concept | Status | How |
|---|---|---|
| Title | ❌ missing | `highlight` is single body; no separate title |
| Description / body | ✅ | `highlight` |
| Images / video | ✅ | `images text[]` + `tag-images` bucket |
| Price | ✅ | `price numeric` |
| Discount | ✅ | `original_price numeric` paired with `price` |
| Location | ✅ | `lat/lng`, `state/country`, `location_type`, `hood_id` |
| Contact info | ✅ | `business_phone`, `business_website` (denorm'd from user) |
| Date / time | ⚠️ partial | columns exist (`event_start/end`) but **never saved — mapper bug** |
| Availability / slots | ✅ | `availability_note` free text |
| Appointment / booking | ✅ | `cta='book'` + `intent='open_slot'` |
| Event | ⚠️ partial | `tag='event'`, `cta='join'`, `rsvp_count` — but dates broken |
| Product | ✅ | `intent='sell_give'`, `cta='view_product'`, `product_link` |
| Offer / discount | ✅ | `intent='offer'`, `price`, `original_price` |
| Expiry | ✅ | `expires_in` minutes + pg_cron auto-close |
| Draft / scheduled publish | ❌ missing | no visibility system |
| Poll | ✅ | `poll_options`, `poll_votes`, `post_poll_votes` table |
| Post subtype / template id | ❌ missing | no column — tag IS the type |

---

## 6. Create Post Flow

**Entry:** `/post` → `PostPage` (`src/app/features/post/pages/post/post.ts`)

### Steps

```
Step 1 — "tag"      SKIPPED for business accounts that have businessCategory set
Step 2 — "details"
Step 3 — "preview"  → submit
```

### formData fields (plain object, not FormGroup)

| Field | Shown when |
|---|---|
| headline | always |
| expiresIn (minutes) | always |
| intent | business posts |
| price / originalPrice | intent is offer / sell_give / available_now |
| availabilityNote | intent is open_slot / available_now |
| cta | business posts |
| productLink | cta is visit_shop / view_product |
| isEvent / eventStart / eventEnd | tag === Event |
| pollOptions | tag === Poll |
| templateValues | tag has a PostTemplate entry |
| media (up to 5) | always |

### Template system in composer

If `POST_TEMPLATES[formData.tag]` exists, the template's structured fields render.
`buildHighlight(templateValues)` auto-composes `formData.headline` as the user fills fields.
User can still manually override the headline.

### Media upload

- Max 5 items; images ≤15 MB, video ≤30 MB, ≤30 s
- `MediaCompressionService` compresses images client-side before upload
- `URL.createObjectURL()` for instant local preview
- Uploaded to `tag-images/{uid}/{timestamp}-{filename}` on submit

### Submit (`onSubmit()`)

1. Validate: headline non-empty, tag selected, location set
2. Upload each media item → `tag-images` bucket → collect public URLs
3. Build `Tag` object (all form fields)
4. `tagRepo.create(tag)` → `supabase-tag.repository.ts` → `tagToRow()` → `supabase.from('tags').insert()`
5. Success: clear draft, navigate to `/feed-beta`
6. Error: toast, stay on preview step

**No draft saving. No publish scheduling. Submit = immediate publish.**

---

## 7. Post Templates (v1 — existing system)

**File:** `src/app/features/post/data/post-templates.ts`

```typescript
export type TemplateFieldType = 'text' | 'select' | 'number';

export interface TemplateField {
  key: string;       // unique within template; used as key in buildHighlight()
  label: string;
  type: TemplateFieldType;
  placeholder?: string;
  options?: readonly string[];   // required for type:'select'
  required?: boolean;
}

export interface PostTemplate {
  intro: string;                              // nudge shown above fields
  fields: readonly TemplateField[];
  buildHighlight(values: Record<string, string>): string;
}

export const POST_TEMPLATES: Partial<Record<TagCategory, PostTemplate>>
```

**Tags with templates:** Help, Shop, Food, Service, Beauty, Health, Fitness, Game, Job, Event (**bug: two entries, second overwrites first**), Notice, Dating, Learn, Auto, Space, Travel, Biz, Alert, Around.

**Tags without templates:** HotNow, Poll.

Helper exports: `emptyTemplateValues(template)`, `isTemplateComplete(template, values)`.

---

## 8. Post Intent + CTA Values

### PostIntent (tags.intent CHECK)

| Value | Label in UI | Meaning |
|---|---|---|
| `offer` | Offer | Promotional / discount offer |
| `available_now` | Available Now | Service/product available immediately |
| `open_slot` | Open Slot | Appointment / booking slot free |
| `happening` | Happening | Something happening right now |
| `looking_for` | Looking For | Request / wanted |
| `sell_give` | Sell / Give | Item for sale or giveaway |

### PostCta (tags.cta CHECK)

`message` · `call` · `whatsapp` · `directions` · `visit_shop` · `view_product` · `book` · `join` · `interested`

---

## 9. Feed / Display

**Primary feed:** `FeedBetaPage` — `src/app/features/feed-beta/pages/feed-beta/feed-beta.ts`

- **Fetch:** `tagRepo.getPaginated(25, offset)` + IntersectionObserver pagination (sentinel at `rootMargin:600px`)
- **Realtime:** `tagRepo.liveTags()` (INSERT), `tagRepo.liveTagUpdates()` (UPDATE) on `tags` table
- **Category tabs:** `FEED_BETA_MAIN_CATEGORIES = ['hot-now','dating','game','job','around']`
- **Partitioning:** `mainCategoryFor(post.tag)` maps all 21 categories to one of these 5 scopes client-side. No server-side category filter.
- **No in-feed search** on FeedBeta currently.
- **Business display:** `post.postType === 'business'` → shows `businessName`, phone/website on card.
- **Card rendering:** `BetaSlide` objects — full-screen vertical scroll snap, raster mini-map (MapTiler 2×2 tile images, no WebGL), image carousel, like/rsvp/comment strip.
- **Expiry label:** `timeRemainingLabel(post)` → "Xh left" / "Xm left" / "Expired"

**Profile page posts:** `tagRepo.getByUserId(uid)` — user's own posts listed.

**Post detail:** `/posts/:id` → `PostDetailPage` → `tagRepo.getById(id)`.

---

## 10. Supabase Tables Overview

| Table | Purpose |
|---|---|
| tags | All posts (all types) |
| users | User + business profile |
| post_comments | Threaded comments (parent_id for nesting) |
| post_likes | Likes — trigger updates tags.like_count |
| post_rsvps | RSVPs — trigger updates tags.rsvp_count |
| post_poll_votes | Poll votes — UNIQUE(post_id, user_id) |
| post_confirmations | Community verifications — trigger updates tags.verification_count |
| post_status_history | Status changes — trigger updates tags.current_status |
| post_reports | Abuse reports |
| user_saved_posts | Bookmarks |
| user_hidden_posts | Hidden from feed |
| user_follows | Follow relationships |
| user_followed_hoods | Followed neighbourhoods |
| user_followed_topics | Followed tag topics |
| user_blocks | Block list |
| muted_threads | Muted DM threads |
| direct_messages | Direct messages (thread_id = post-context or profile-context) |
| notifications | In-app notifications |
| hood_messages | Neighbourhood chat |
| reputation_events | Reputation audit log (no client SELECT — SECURITY DEFINER only) |
| post_comment_reactions | Comment upvotes |

**Storage bucket:** `tag-images` — public read, owner-namespaced upload (`{uid}/`), 50 MB limit.

**Views:**
- `public_user_profiles` — hides email, business_phone, home coords
- `my_user_profile` — all columns, self-only (`WHERE uid = auth.uid()`)

**Key RPCs:**
- `fetch_tags_in_bounds(min_lng, min_lat, max_lng, max_lat)`
- `fetch_following_feed(limit, offset, query)`
- `award_reputation(target_user_id, reward_type, reward_source, reward_points)` — SECURITY DEFINER
- `delete_own_account()` — SECURITY DEFINER

---

## 11. Reusable UI Components

| Component / pipe | Selector / usage | Reuse for |
|---|---|---|
| TagPillComponent | `app-tag-pill` | Category chip on template picker |
| TagEmojiPipe | `tag \| tagEmoji` | Emoji in category grid |
| TagGradientPipe | `tag \| tagGradient` | Gradient styling |
| LifespanBadgeComponent | `app-lifespan-badge` | Expiry badge on quick-post preview |
| AvatarComponent | `app-avatar` | Author avatar on template cards |
| ConfirmDialogComponent | `app-confirm-dialog` | Discard / delete confirmation |
| EmptyStateComponent | `app-empty-state` | Empty template list |
| TimeAgoPipe | `date \| timeAgo` | Relative timestamps |

### In-composer UI patterns (not yet extracted to shared components)

| Pattern | Where defined |
|---|---|
| Intent chips (horizontal scroll strip) | `INTENT_OPTIONS` array in `post.ts` |
| CTA selector | `CTA_OPTIONS` in `post.ts` |
| Quick expiry chips | `QUICK_EXPIRY_OPTIONS` in `post.ts` |
| Category chip grid | Tag step in `post.html` |
| Media upload strip (preview + remove) | `mediaItems[]` in `post.ts` |
| Template field renderer | `POST_TEMPLATES[tag].fields` loop in `post.html` |
| Poll options builder | `pollOptions[]` dynamic list in `post.ts` |
| Event date fields | `isEvent` conditional section |
| Price / original-price pair | Numeric inputs, conditional on intent |

**No shared components yet for:** bottom sheets/modals, date/time pickers, location selector, price field, category selector — all inline in the composer.

---

## 12. Known Bugs / Issues

| Issue | File | Notes |
|---|---|---|
| event_start / event_end never persisted | `src/app/core/services/tag.mapper.ts` | Fields exist on `Tag` and in `tags` table but `tagToRow()` doesn't write them |
| POST_TEMPLATES Event duplicate key | `src/app/features/post/data/post-templates.ts` | Two `[TagCategory.Event]` entries — second silently overwrites first |
| database.types.ts out of sync | `src/app/core/models/database.types.ts` | Missing most columns added after baseline migration; runtime paperd over by `[table: string]: GenericTable` fallback |
| users.business_category has no CHECK | `users` table | Any string can be stored; no FK to category enum |
| mainCategoryFor() is a hardcoded switch | `feed-beta.ts` | New categories fall through to 'around'; should be a data-driven map |

---

## 13. Constraints for New Features

### DB CHECK constraints that require migration to extend

- `tags.intent` — add new intent values here
- `tags.cta` — add new CTA values here
- `tags.post_type`, `tags.current_status`, `tags.location_type` — stable, no expected changes

### RLS key rules

- Tags: authenticated read-all; author insert/update/delete own
- Trigger blocks direct author modification of `verified`, `verification_count`, `current_status`, `status_updated_at`
- Storage: insert only into `{own-uid}/` folder; public read

### Missing capabilities for a category-aware template system

| Gap | Impact |
|---|---|
| No `post_subtype` or `template_id` column on tags | Cannot distinguish sub-types within a category (e.g. 'menu-item' vs 'open-slot' within Food) |
| No `title` field | All content crammed into `highlight` |
| No draft / scheduled publish | All inserts are immediately live |
| event_start / event_end broken | Fix mapper before building Event templates |
| TemplateFieldType only: text / select / number | Missing: date, time, location, price, toggle, multi-select |
| No server-side template validation | Only `isTemplateComplete()` client-side |
| No category → allowed template types mapping in DB | All logic is purely client-side |

---

## 14. Recommended Reuse Points for Template System

### Extend these (do not replace)

| Asset | Action |
|---|---|
| `public.tags` table | Add nullable columns: `post_subtype text`, `title text`, `published_at timestamptz`, `slot_count int`, `slot_duration_minutes int` |
| `Tag` interface | Add `postSubtype?`, `title?`, `publishedAt?` |
| `tag.mapper.ts` | Fix event_start/end bug; add new fields here |
| `PostDraft` interface | Extend with new template field namespace |
| `POST_TEMPLATES` record | Extend with richer TemplateField types |
| `BUSINESS_TAG_CATEGORIES` + `tagCategoryLabel()` | Use as category picker source of truth |
| `tagRepo.create()` / `update()` | No change — extend mapper instead |
| `SocialInteractionsService` | Reuse for likes/RSVPs/comments on all new post types |
| `MediaService` + `MediaCompressionService` | Upload pipeline works for any post type |

---

## 15. Current Relationship Summary

```
User (users.uid)
  └─ account_type: 'personal' | 'business'
  └─ business_category: TagCategory string  (nullable, stored on users row)
  └─ business_name / business_phone / business_website  (nullable)

      ↓ (no separate business table)

Post (tags table)
  └─ tag: TagCategory string  ← auto-set from business_category for business accounts
  └─ post_type: 'personal' | 'business'
  └─ intent: PostIntent  (offer / available_now / open_slot / happening / looking_for / sell_give)
  └─ cta: PostCta
  └─ price / original_price / availability_note / product_link
  └─ images[]  (Storage URLs)
  └─ expires_in → pg_cron auto-closes

      ↓

Feed (FeedBetaPage)
  └─ tagRepo.getPaginated(25, offset)
  └─ partitioned client-side by mainCategoryFor(post.tag)
     into ['hot-now', 'dating', 'game', 'job', 'around'] tabs
```
