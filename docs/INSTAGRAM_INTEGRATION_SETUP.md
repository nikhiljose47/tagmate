# Instagram integration — Meta Developer Dashboard setup

Covers the manual configuration needed for `functions/api/integrations/instagram/*`
(Step 2 of the business-integrations rollout — see `docs/` for the WhatsApp
equivalent once Step 3 lands). This document is deliberately kept separate
from the application code; nothing here should be hardcoded into the app.

> Meta's own product docs are the source of truth — this file summarizes what
> was true at the time this integration was built. Re-verify against
> [developers.facebook.com/docs/instagram-platform](https://developers.facebook.com/docs/instagram-platform)
> before relying on it, especially permission names and endpoint hosts, since
> Meta does change these between API versions.

## 1. Create/select a Meta app

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) → create an app (type: **Business**).
2. Add the **Instagram** product to the app (API setup with Instagram Login —
   _not_ the older Facebook Login for Business/Page-based Instagram flow;
   this app does not require the business to connect a Facebook Page).

## 2. Configure Instagram Login

In the Instagram product's API setup:

- **Business Login redirect URI**: set to exactly the value you put in
  `INSTAGRAM_REDIRECT_URI`, e.g. `https://<your-domain>/api/integrations/instagram/callback`.
  This must match byte-for-byte or the token exchange will be rejected.
- **Permissions** (this integration requests only these — nothing else):
  - `instagram_business_basic`
  - `instagram_business_content_publish`
- Do **not** add `instagram_business_manage_messages`, `instagram_business_manage_comments`,
  or any Insights permission — Step 2 doesn't use them.

## 3. App credentials → environment variables

From the app's Basic Settings / Instagram product settings:

| Env var                  | Where it comes from                                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INSTAGRAM_APP_ID`       | Instagram product → API setup with Instagram Login → App ID (Instagram-scoped, distinct from the top-level Facebook App ID)                                       |
| `INSTAGRAM_APP_SECRET`   | Same screen → App Secret. **Never** commit this or expose it to the frontend — it's only read server-side in `functions/api/integrations/instagram/_provider.js`. |
| `INSTAGRAM_REDIRECT_URI` | The exact callback URL you registered in step 2                                                                                                                   |
| `META_GRAPH_API_VERSION` | The Graph API version your app is pinned to (e.g. `v21.0`) — check the app dashboard's "API version" setting                                                      |

Set these as **Cloudflare Pages environment variables/secrets** (Pages project →
Settings → Environment variables), the same way `SUPABASE_SERVICE_ROLE_KEY`
is configured today — this repo's `wrangler.jsonc` intentionally declares no
`vars`, so there's nothing to edit there.

Also set `INTEGRATION_ENCRYPTION_KEY` if you haven't already (Step 1) — see
`.env.example`.

## 4. What works immediately in Development Mode

While the app is in Meta's **Development** mode, only **Instagram Testers**
(accounts you explicitly add under App Roles → Roles → Instagram Testers, who
then accept the invite from their own Instagram app settings) can complete
the OAuth flow. This is enough to fully test:

- Connect / disconnect
- Token exchange, long-lived token exchange, refresh
- Image and video publishing
- Retry / failure handling

Add a handful of real Instagram Business/Creator accounts (yours, teammates',
or dedicated test shop accounts) as Testers to develop against.

## 5. What's required before real, unrelated businesses can connect

Once you want _any_ business owner (not just your listed testers) to connect
their own Instagram account, the app must move out of Development mode:

1. **App Review**: submit for the `instagram_business_basic` and
   `instagram_business_content_publish` permissions under App Review →
   Permissions and Features. Meta will ask for a screen-recorded demo of the
   exact "Connect Instagram" → authorize → publish flow implemented here.
2. **Business verification**: Meta requires the app's associated Business
   Portfolio to complete Business Verification before Advanced Access is
   granted for these permissions.
3. **Privacy Policy URL**: must be set in the app's Basic Settings and be
   publicly reachable — required before submitting for review.
4. **Data Deletion**: Meta requires either a **Data Deletion Callback URL** or
   a **Data Deletion Instructions URL** configured in Basic Settings. This app
   doesn't yet implement a deletion callback endpoint for Instagram-specific
   data — at minimum, publish instructions describing how a user can request
   deletion of their stored Instagram connection (e.g. "disconnect from your
   Business Profile, or contact support@..."), and consider adding a proper
   callback endpoint (mirroring `functions/api/auth/delete-account.js`'s
   pattern) if Meta's reviewer requires it for approval.
5. **App icon, category, and other Basic Settings fields** Meta requires
   before submitting any permission for review.

Until App Review is approved, only your added Instagram Testers can connect —
this is expected and matches Meta's standard process for any app using these
permissions, not something specific to this implementation.
