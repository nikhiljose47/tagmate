[33mcommit 17bb015f4c8fec857fabb221e5e233bada3f6612[m[33m ([m[1;36mHEAD[m[33m -> [m[1;32mmain[m[33m, [m[1;31morigin/main[m[33m, [m[1;31morigin/HEAD[m[33m)[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sat Oct 3 11:18:46 2026 +0530

    console issue fix

[33mcommit 477da824fa43be7016cd553b3391e6b971b0689f[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Fri Oct 2 17:40:45 2026 +0530

    Auto locate user location hood for not logged in and fix for clearing cached location

[33mcommit 18b5622428d1a4a60dae1cba2f26ef34e3fc40b0[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Thu Oct 1 13:54:20 2026 +0530

    Fix SSR crash from unguarded requestAnimationFrame in feed-beta
    
    requestAnimationFrame runs during server-side change detection
    (ngAfterViewInit, effects) but doesn't exist on the server, throwing
    on every SSR request to /feed-beta. Guard each call site the same
    way the existing IntersectionObserver check in this file does.
    
    Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

[33mcommit bcabda2b3b2553fbf3ea00d338389bef448238ed[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Thu Oct 1 13:45:32 2026 +0530

    UI revamp with designer

[33mcommit 83a78fec8d522f2a177850caca1b3aad3592da3c[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Wed Sep 30 16:43:58 2026 +0530

    auto update 1.1 and removed guest role like facebook

[33mcommit c7488a0104fc5ec4c8b5705c849ed78f505dc0d6[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sun Sep 27 19:48:10 2026 +0530

    Fixes: Scroll issue in profile page

[33mcommit 8b0e6f2898db6d7601db32cd85e1bbe06ee7fcb3[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sun Sep 27 15:11:42 2026 +0530

    Advertisment category added

[33mcommit aab4310a359d394bc6bd8ac845f90f8393d68cee[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sun Sep 27 13:52:58 2026 +0530

    Show only hood codes in mobile screens

[33mcommit 20ab7e33e4082d071674704ebcc2cdf8cbec28a5[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sun Sep 27 13:09:11 2026 +0530

    auto update on new app version

[33mcommit c2bf9333ed48f9c4b1ea76f9a6f29c5a731e848a[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sat Sep 26 16:58:56 2026 +0530

    Fixed dropdown issue

[33mcommit 0b3e8c6285cf99a876277534f80f7789531d0a3d[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sat Sep 26 16:35:13 2026 +0530

    Rename game tag

[33mcommit 76101be09252d9b6f10ac92843287a1b4d986e0e[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Thu Sep 24 13:21:27 2026 +0530

    Revamp the feed to make more service oriented and feed now more focused on specific tags

[33mcommit 26ef3ee00c32bbd75ebac38d105b8128b001bf44[m
Merge: e8fa08f 3059c1b
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Thu Sep 24 07:36:46 2026 +0530

    Merge branch 'main' of https://github.com/nikhiljose47/tagmate

[33mcommit e8fa08fb12e08895c3248f7f52de2b53a47376af[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Thu Sep 24 07:34:43 2026 +0530

    Revamp

[33mcommit 3059c1b5e1a646d7003f08528db7e7b1b65fe1a1[m
Author: jkresearch8 <jkresearch8@gmail.com>
Date:   Wed Sep 23 22:33:41 2026 +0530

    style: apply prettier formatting and resolve spec lint error

[33mcommit 6d769cad428a6f15a71d1ffdbfc341da2303e42f[m
Author: jkresearch8 <jkresearch8@gmail.com>
Date:   Wed Sep 23 21:52:10 2026 +0530

    fix: resolve QA bug reports TM-001 through TM-014 and harden UI/routing resilience
    
    - TM-001: Fix thread replies slice offset in post-detail.html so <= 3 replies render immediately
    - TM-002: Dynamic comment deletion confirmation copy in post-detail.ts based on nested reply presence
    - TM-003: Use maybeSingle() in tag-data.service.ts and handle PGRST116 gracefully on soft deletion
    - TM-004: Subscribe to route.paramMap in post-detail.ts to support component reuse in 'More from this neighbor'
    - TM-005 & TM-010: Prevent toast notification text truncation with word-break and theme variables in app.scss
    - TM-006: High contrast text (#ffffff) and distinct disabled styling for .name-confirm-btn in signup.scss
    - TM-007: Add 'Other' business category option with dynamic custom text input and validation in signup.html/ts
    - TM-008: Verify external OpenStreetMap registration form report as invalid
    - TM-009: Set color-scheme: dark and invert native calendar picker indicator in dark/midnight/forest themes
    - TM-011: Enable toggle-off and Home reset for Hot Now category filter with 'Show all posts' buttons in feed-beta
    - TM-012: Route business offer post 'Message' CTA to /messages with queryParams { user, name }
    - TM-013: Bind custom backgroundColor and contrastText to .fb-caption on posts with attached media
    - TM-014: Verify centered Forgot Password card structure aligned with login/signup suite
    - Docs: Update FEATURES.md with Bug Report #4 remediations and checklist items 14-20
    - Tests: Add unit tests for message CTA queryParams and custom business category (314/314 passing)

[33mcommit da7a73b76f85981d86f00adac29b3e6723d809f6[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Tue Sep 22 22:01:03 2026 +0530

    Bug fixes

[33mcommit cb2b465c2a28dac63bb6e79bd0fc4a4a16262e96[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Tue Sep 22 09:21:06 2026 +0530

    updates

[33mcommit 9032ac9346c2ef5ad51aace36678cf8cfa70090a[m
Author: jkresearch8 <jkresearch8@gmail.com>
Date:   Fri Sep 18 00:07:14 2026 +0530

    fix(auth): make password visibility toggle keyboard focusable in login form

[33mcommit aded29886648c0fddf099e1670d78c895c2fd55d[m
Author: jkresearch8 <jkresearch8@gmail.com>
Date:   Thu Sep 17 23:51:20 2026 +0530

    style: format codebase with prettier and resolve typescript-eslint any issues

[33mcommit ef32c09c6d5b8f5ff8d5ebc1e1fd581d24dbb50d[m
Author: jkresearch8 <jkresearch8@gmail.com>
Date:   Thu Sep 17 23:30:11 2026 +0530

    fix(auth,profile,post,feed): resolve Bug Report #3 items and update FEATURES.md
    
    - Fix invalid birthday selection with dynamic days computation and strict calendar validation (Bug #5)
    - Fix birthday select persistence across signup steps without reset to default (Bug #7)
    - Add confirmation link guidance subtip and user-friendly rate limit messaging (Bugs #1, #2, #6)
    - Disambiguate Display Name and unique @username handle in profile header, edit sheet, and user session (Bug #4)
    - Add explicit media size guidance hint under post composer file picker (Bug #8)
    - Restore themed vertical scrollbar on desktop feed while preserving borderless mobile Reels view (Bug #10)
    - Add signup and profile spec suites and update FEATURES.md verification checklist

[33mcommit fd8d7b64329a2133acfb1c940b1219b7ff9abc58[m
Author: N <nikhiljose47@github.com>
Date:   Sat Sep 5 11:19:23 2026 +0530

    reduces post.scss size

[33mcommit 42038a18a0a7a0586055e9a46650da0ebfba13da[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sat Sep 5 11:07:32 2026 +0530

    force build

[33mcommit 0c9ee3b7c6f6900418d3d8b8f6c87b226ce5e6f9[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sun Aug 30 18:11:51 2026 +0530

    Added instagram and whstapp service integration in app and bug fixes

[33mcommit 3df2d4baa3e5f7262e4a9579ab1e78115e66d06c[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sat Aug 29 10:04:40 2026 +0530

    Upgraded UI for posting, Step 1 for insta/whtsapp api connect for busienss accoint

[33mcommit 1984507fc1e7a65f85bfc739f8e1d16561356bf7[m
Merge: 54f438c 9f089ed
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sun Aug 23 09:27:46 2026 +0530

    Merge branch 'main' of https://github.com/nikhiljose47/tagmate

[33mcommit 54f438c36a6b753ad5465dfc7cd18e313306d619[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sun Aug 23 09:27:42 2026 +0530

    Adding social media links and more inputs from user

[33mcommit 9f089ed816a86a6a8a2d7e7141dd7f470a3c1937[m
Author: jkresearch8 <jkresearch8@gmail.com>
Date:   Sat Aug 22 11:57:04 2026 +0530

    fix: align template registry typing and enforce project formatting standards
    
    - Add explicit tuple return types `[TemplateField, TemplateField]` for helper
      functions (`priceGroup`, `eventGroup`, `appointmentGroup`) in `post-template-registry.ts`
      to satisfy TypeScript strict indexing and undefined-safety checks.
    - Add explicit type annotations to custom `validate` hooks in `post-template-registry.spec.ts`.
    - Remove redundant `eslint-disable-next-line` directive in `generate-website.js`.
    - Run Prettier across newly pulled business post components, template definitions,
      auth pages, and Cloudflare functions to ensure consistent formatting across the repository.
    - Ensure all 271 unit tests compile and pass cleanly under Chrome Headless.

[33mcommit 35ee0ee655f8d2fea5c2accbde5f0fcdfab12b94[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sat Aug 22 02:02:18 2026 +0530

    Updated business account ui, otp signout ui side add

[33mcommit d14189d6e8082aee1e1c3040c4d48d2798b86b93[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sun Aug 16 18:59:29 2026 +0530

    Fixes: logo, images not added to db, media also delter on delete account

[33mcommit 8c7e0a0c0d61a180dec4bdd204a2fc24def881c6[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sun Aug 16 14:31:41 2026 +0530

    Revamped business registration

[33mcommit 571f2cce5adf2fba2244c33fb70cb9e317cda193[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sun Aug 16 12:05:17 2026 +0530

    test: trigger build

[33mcommit 5bc367e07cb1b7bfb96ac86ad4db7e584dfdee1a[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sun Aug 16 11:36:26 2026 +0530

    updated lock file

[33mcommit 4ab953196fb61008a32c4435eb81c8a472c14f85[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sun Aug 16 11:33:50 2026 +0530

    test: trigger build

[33mcommit 52dcb672babc643949d93bbdeb68a8ceeb4186f9[m
Merge: b28afee 7c891a3
Author: Nikhil <33219597+nikhiljose47@users.noreply.github.com>
Date:   Sun Aug 16 11:27:22 2026 +0530

    Added templates, buiness url
    
    Added templates, buiness url

[33mcommit 7c891a3b56866e4217a134905c3beb30bddf0782[m[33m ([m[1;31morigin/business-app-r&d[m[33m, [m[1;32mbusiness-app-r&d[m[33m)[m
Merge: fb8966a b28afee
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sun Aug 16 11:17:45 2026 +0530

    Merge branch 'main' of https://github.com/nikhiljose47/tagmate into business-app-r&d

[33mcommit fb8966abee487867042987cf1c0f5feb488682ee[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sun Aug 16 11:06:10 2026 +0530

    Business signup now take images and project created urls

[33mcommit 9c4495f47d78a922ff3a8b4327ff6e8543741b2d[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sat Aug 15 20:41:23 2026 +0530

    business post templates with subtype-aware feed, drafts/scheduling, and usage analytics
    
    - Category-specific post templates with dynamic composer (template picker → short form → preview)
    - Subtype-aware rendering shared across FeedBeta/PostDetail/Profile, with safe fallback for legacy/unknown/disabled templates
    - Centralized feed-scope resolution (tag + postSubtype) replacing hardcoded category branching
    - Save Draft / Schedule / Publish Now, with RLS-private drafts and pg_cron auto-publish
    - Lightweight post_template_events analytics (selected/published/draft/scheduled)

[33mcommit efb8ce08231eb3cbf0c6c0a3cfd8ed36751b2d34[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Fri Aug 14 22:43:32 2026 +0530

    Added delete account fn

[33mcommit b28afee64993a3d52ea5a0732e83f809090043bd[m
Merge: 403d9c5 123cbd7
Author: jkresearch8 <jkresearch8@gmail.com>
Date:   Wed Aug 12 23:39:22 2026 +0530

    merge: harden auth and interaction integrity

[33mcommit 123cbd738f25a38f82d2a0c18534be3c11d64699[m
Author: jkresearch8 <jkresearch8@gmail.com>
Date:   Wed Aug 12 23:38:45 2026 +0530

    fix: close auth, storage, and interaction integrity gaps

[33mcommit 53ca453440cc673591a378ed395a2df3034c0eda[m[33m ([m[1;31morigin/fix/autonomous-hardening[m[33m, [m[1;32mfix/autonomous-hardening[m[33m)[m
Author: jkresearch8 <jkresearch8@gmail.com>
Date:   Mon Aug 10 12:48:35 2026 +0530

    fix: resolve reported auth and interaction issues

[33mcommit 075ab8ea6718fce9521f7e1fe5f53d43c7648ede[m
Author: jkresearch8 <jkresearch8@gmail.com>
Date:   Sun Aug 9 20:47:08 2026 +0530

    chore: harden app and track release TODOs

[33mcommit 403d9c512a7be1b7966ac67ca1246ace9c675955[m
Merge: 324509e 0120b81
Author: Nikhil <33219597+nikhiljose47@users.noreply.github.com>
Date:   Sun Aug 9 10:36:25 2026 +0530

    Merge pull request #3 from nikhiljose47/home-feed-r&d
    
    Temporoy showing all expired feeds

[33mcommit 0120b810cc15f9c2f26068eae673f1db36ac6f91[m[33m ([m[1;31morigin/home-feed-r&d[m[33m, [m[1;32mhome-feed-r&d[m[33m)[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sun Aug 9 10:35:37 2026 +0530

    Temporoy showing all expired feeds

[33mcommit 324509e156bc3b5c37261eab69f559cdbeff3945[m
Merge: dc3f778 c61520f
Author: Nikhil <33219597+nikhiljose47@users.noreply.github.com>
Date:   Sat Aug 8 21:46:24 2026 +0530

    Merge pull request #2 from nikhiljose47/home-feed-r&d
    
    Home feed r&d

[33mcommit c61520f1ead85fa9a96aaf120d135159b81b4db1[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sat Aug 8 21:44:23 2026 +0530

    scroll bar removal for post page

[33mcommit 55aab7d69b490020577a36f6333ff68178c41acc[m
Merge: 495df3c dc3f778
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sat Aug 8 21:00:04 2026 +0530

    Merge branch 'main' of https://github.com/nikhiljose47/tagmate into home-feed-r&d

[33mcommit 495df3c7841d61bc6f4968714ff0c08e266f5699[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sat Aug 8 20:53:21 2026 +0530

    Business app type added and home feed revamp

[33mcommit e9f0d1c014f16eb94bab0340946bf1cfc929ade7[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Tue Aug 4 23:53:55 2026 +0530

    update homepage with hot-new

[33mcommit fa9c83b1938a0748acdb1806c4d91cd0b81fbad7[m
Author: N <nikhiljose47@github.com>
Date:   Sun Aug 2 17:42:22 2026 +0530

    Updaetd db and added db design to readme

[33mcommit c58b0a95676ab64e1f2595ceecdc9fbf784ff229[m
Author: nikhiljose47 <nikhiljose47@gmail.com>
Date:   Sun Aug 2 14:51:54 2026 +0530

    updated post and top bar to state level

[33mcommit 425027d7c234de4a9fdd6947ab036eb200479cbf[m
Author: N <nikhiljose47@github.com>
Date:   Sun Aug 2 11:34:44 2026 +0530

    top bar and tag change

[33mcommit dc3f77874aac0d421845fbc6e6226ca493387226[m
Author: jkresearch8 <jkresearch8@gmail.com>
Date:   Sun Aug 2 00:08:45 2026 +0530

    style: format post.ts and post.spec.ts with Prettier

[33mcommit 58e5763e56f0767fcfee7a7a7bb46898150331a4[m
Author: jkresearch8 <jkresearch8@gmail.com>
Date:   Sun Aug 2 00:00:31 2026 +0530

    feat(media): implement browser-native GPU video compression via MediaRecorder API
    
    - Add compressVideo() in MediaCompressionService utilizing stream capture and MediaRecorder API.
    - Re-encode video files at a 2.0 Mbps bitrate ceiling before uploading.
    - Provide automatic fallback to original file if browser does not support stream capture or output size is unhelpful.
    - Update FEATURES.md documentation.

[33mcommit c9eaa948b277d996d9fcba28c0896807671e1c68[m
Author: jkresearch8 <jkresearch8@gmail.com>
Date:   Sat Aug 1 23:55:12 2026 +0530

    feat(post): add media upload validation rules and hermetic test suite
    
    - Enforce file size limits (max 15MB images, max 30MB videos) and video duration limit (max 30s) in PostPage composer.
    - Enforce strict MIME filtering for images and videos with user-friendly toast alerts.
    - Add Supabase storage migration (20260802000000_storage_bucket_limits.sql) configuring 50MB hard limit on tag-images bucket.
    - Create stateful InMemoryTagRepository for hermetic unit testing in testProviders.
    - Add Playwright network route mocks (e2e/helpers/network-mocks.ts) to intercept Nominatim, MapTiler, and Supabase endpoints for offline E2E runs.
    - Update FEATURES.md and SECURITY_DEPLOYMENT.md.
